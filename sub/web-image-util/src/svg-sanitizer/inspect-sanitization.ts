/**
 * SVG sanitizer 정책 영향 진단 API.
 *
 * 입력 SVG 문자열 한 개와 정책 한 개를 받아 부수효과 없이 진단해
 * `InspectSvgSanitizationReport`를 반환한다. 네트워크 fetch, Canvas 렌더링,
 * DOMPurify의 초기화는 strict sanitizer core에 위임한다.
 *
 * 공개 표면은 `svg-sanitizer/index.ts`의 재export를 경유하며, 구현은 이 파일의
 * 부수효과 없는 진단 함수에 둔다.
 */

import { ImageProcessError } from '../errors.internal';
import { buildSvgBytesExceededFinding, MAX_SVG_BYTES } from '../svg-contract.internal';
import { detectRuntimeEnvironment } from '../utils/environment.internal';
import { parseAndClassifySvg } from '../utils/svg-document.internal';
import { sanitizeSvgForRendering } from '../utils/svg-sanitizer';
import { sanitizeSvgStrictCore } from './core.internal';
import { collectEmbeddedImageStages, collectGeneralStages } from './inspect-sanitization/stage-collectors.internal';
import type {
  InspectSvgSanitizationFailure,
  InspectSvgSanitizationImpact,
  InspectSvgSanitizationOptions,
  InspectSvgSanitizationReport,
  SvgSanitizerPolicy,
} from './inspect-sanitization/types.internal';

// 공개 타입의 정의는 스택의 타입 leaf(inspect-sanitization/types.internal.ts)에 있다.
// 이 재export가 공개 표면(svg-sanitizer/index.ts 경유)을 그대로 유지한다.
export type {
  InspectSvgSanitizationFailure,
  InspectSvgSanitizationFailureCode,
  InspectSvgSanitizationImpact,
  InspectSvgSanitizationLightweightImpact,
  InspectSvgSanitizationOptions,
  InspectSvgSanitizationReport,
  InspectSvgSanitizationSkipImpact,
  InspectSvgSanitizationStage,
  InspectSvgSanitizationStageCode,
  InspectSvgSanitizationStrictImpact,
  SvgSanitizerPolicy,
} from './inspect-sanitization/types.internal';

/** UTF-8 byte 길이 측정용 공용 인코더. 호출당 1회만 생성된다. */
const UTF8_ENCODER = new TextEncoder();

/**
 * DOMParser로 입력 SVG를 파싱한다. 파싱 실패(에러 노드) 또는 non-svg 루트는 null을 반환한다.
 *
 * 환경에 DOMParser가 없으면(unknown 환경) null을 반환한다. lightweight 경로에서도 정제는
 * 정규식 기반이라 파싱 실패와 무관하게 그대로 실행된다.
 */
function parseSvgDocument(svgString: string): Document | null {
  const parsed = parseAndClassifySvg(svgString);
  return parsed.root === 'svg' ? parsed.doc : null;
}

/** byte 초과 시 정책별로 반환할 fallback impact를 만든다. */
function buildBytesExceededImpact(policy: SvgSanitizerPolicy, actualBytes: number): InspectSvgSanitizationImpact {
  if (policy === 'skip') {
    return { kind: 'skip', status: 'not-applied', potentialStages: [] };
  }

  // byte 초과 failure는 진단 3 API 공유 계약(빌더)으로 조립한다.
  const failure: InspectSvgSanitizationFailure = buildSvgBytesExceededFinding(actualBytes, MAX_SVG_BYTES);

  if (policy === 'strict') {
    return {
      kind: 'strict',
      status: 'failed',
      outputBytes: null,
      outputNodeCount: null,
      stages: [],
      failure,
    };
  }

  return {
    kind: 'lightweight',
    status: 'failed',
    outputBytes: null,
    stages: [],
    failure,
  };
}

/**
 * `runStrictSanitization`의 반환 형태. 호출자는 `status`로 분기한다.
 */
type StrictSanitizationOutcome =
  | { status: 'ok'; sanitizedSvg: string; warnings: string[] }
  | { status: 'failed'; failure: InspectSvgSanitizationFailure };

/**
 * strict sanitizer를 실행한다.
 *
 * strict 내부에서 던진 `ImageProcessError`를 failure code로 매핑한다.
 *
 * 옵션은 `undefined`로 전달해 `removeMetadata=false`, `domPurifyConfig` 없음,
 * 기본 한도(`DEFAULT_MAX_BYTES`, `DEFAULT_MAX_NODE_COUNT`)를 그대로 사용한다.
 * 외부 호출이므로 recursionDepth는 0으로 둔다.
 */
async function runStrictSanitization(svgString: string): Promise<StrictSanitizationOutcome> {
  try {
    const result = sanitizeSvgStrictCore(svgString, undefined, 0);
    return { status: 'ok', sanitizedSvg: result.svg, warnings: result.warnings };
  } catch (error) {
    if (error instanceof ImageProcessError) {
      switch (error.code) {
        case 'SVG_INPUT_INVALID':
          return {
            status: 'failed',
            failure: {
              code: 'svg-input-invalid',
              message: 'Strict sanitizer received a non-string input.',
            },
          };
        case 'SVG_BYTES_EXCEEDED':
          return {
            status: 'failed',
            failure: {
              code: 'svg-bytes-exceeded',
              message: 'SVG input size exceeds the configured byte limit.',
            },
          };
        case 'SVG_NODE_COUNT_EXCEEDED':
          return {
            status: 'failed',
            failure: {
              code: 'svg-node-count-exceeded',
              message: 'Strict sanitizer node count exceeds the configured maximum.',
            },
          };
        case 'SVG_DOMPURIFY_INIT_FAILED':
          return {
            status: 'failed',
            failure: {
              code: 'svg-dompurify-init-failed',
              message: 'Strict sanitizer could not initialize DOMPurify in this environment.',
            },
          };
      }
    }
    return {
      status: 'failed',
      failure: {
        code: 'svg-strict-internal-error',
        message: 'Strict sanitizer raised an internal error while processing the input.',
      },
    };
  }
}

/**
 * sanitize된 SVG 문자열을 다시 파싱해 element 개수를 측정한다.
 *
 * strict의 `outputNodeCount`는 정제 결과의 element 수(`querySelectorAll('*').length`)로
 * 정의된다. DOMParser가 없거나 파싱 실패면 0을 반환한다.
 */
function countElementsInSanitizedSvg(sanitizedSvg: string): number {
  const parsed = parseAndClassifySvg(sanitizedSvg);
  const root = parsed.ok ? parsed.doc.documentElement : null;
  return root ? root.querySelectorAll('*').length : 0;
}

/**
 * strict 정책 경로. strict sanitizer를 실행하고 결과를 측정한다.
 *
 * stage 수집은 **원본 svgString**의 DOM 순회로 수행한다(sanitize 결과를 diff하지 않는다).
 * strict 정책 컨텍스트에서는 `doctype-removed`/`entity-removed`도 결과에 포함된다.
 */
async function runStrictImpact(svgString: string): Promise<InspectSvgSanitizationImpact> {
  const outcome = await runStrictSanitization(svgString);

  if (outcome.status === 'failed') {
    return {
      kind: 'strict',
      status: 'failed',
      outputBytes: null,
      outputNodeCount: null,
      stages: [],
      failure: outcome.failure,
    };
  }

  const outputBytes = UTF8_ENCODER.encode(outcome.sanitizedSvg).length;
  const outputNodeCount = countElementsInSanitizedSvg(outcome.sanitizedSvg);

  const doc = parseSvgDocument(svgString);
  const stages = collectGeneralStages(svgString, doc);
  if (doc !== null) {
    stages.push(...collectEmbeddedImageStages(doc));
  }

  return {
    kind: 'strict',
    status: 'ok',
    outputBytes,
    outputNodeCount,
    stages,
    failure: null,
  };
}

/**
 * lightweight 정책 경로. 입력 SVG에 `sanitizeSvgForRendering`을 동기 실행해 outputBytes를
 * 측정하고, 입력을 DOMParser로 파싱해 `collectGeneralStages`와
 * `collectEmbeddedImageStages`로 stage를 수집해 합친다.
 *
 * 파싱 실패 또는 non-svg 루트라도 sanitize는 그대로 수행(정규식 기반이므로 파싱과 무관)하며,
 * stages는 빈 배열을 반환하고 status는 'ok'를 유지한다.
 */
function runLightweightImpact(svgString: string): InspectSvgSanitizationImpact {
  const sanitized = sanitizeSvgForRendering(svgString);
  const outputBytes = UTF8_ENCODER.encode(sanitized).length;
  const doc = parseSvgDocument(svgString);
  const stages = collectGeneralStages(svgString, doc);
  if (doc !== null) {
    stages.push(...collectEmbeddedImageStages(doc));
  }

  return {
    kind: 'lightweight',
    status: 'ok',
    outputBytes,
    stages,
    failure: null,
  };
}

/**
 * skip 정책 경로. sanitizer를 실행하지 않고 DOMParser로 입력만 파싱한 뒤
 * `collectGeneralStages`와 `collectEmbeddedImageStages`로
 * "lightweight가 적용됐다면 발동했을" stage를 수집해 합친다.
 */
function runSkipImpact(svgString: string): InspectSvgSanitizationImpact {
  const doc = parseSvgDocument(svgString);
  const potentialStages = collectGeneralStages(svgString, doc);
  if (doc !== null) {
    potentialStages.push(...collectEmbeddedImageStages(doc));
  }
  return { kind: 'skip', status: 'not-applied', potentialStages };
}

/**
 * SVG 문자열에 sanitizer 정책을 적용했을 때 어떤 stage가 발동(또는 발동할)했는지 진단한다.
 *
 * 네트워크와 Canvas 렌더링을 수행하지 않는다.
 * 비문자열 입력과 잘못된 policy 값에만 throw하며, 그 외 모든 케이스(byte 초과, 파싱 실패,
 * strict 내부 실패)는 보고서로 답한다.
 *
 * @throws {ImageProcessError} code=`SVG_INPUT_INVALID`, details=`{ actualType }` — input is not a string.
 * @throws {ImageProcessError} code=`INVALID_SOURCE`, details=`{ policy }` — options.policy is not one of the supported values.
 */
export async function inspectSvgSanitization(
  svgString: string,
  options?: InspectSvgSanitizationOptions
): Promise<InspectSvgSanitizationReport> {
  // 비문자열 입력 검증 (D10)
  if (typeof svgString !== 'string') {
    const actualType = svgString === null ? 'null' : typeof svgString;
    throw new ImageProcessError(
      `inspectSvgSanitization expects a string input, but received ${actualType}.`,
      'SVG_INPUT_INVALID',
      { details: { actualType } }
    );
  }

  // 옵션 정책 검증. undefined는 기본값 'lightweight'.
  const policyOption = options?.policy;
  if (
    policyOption !== undefined &&
    policyOption !== 'lightweight' &&
    policyOption !== 'strict' &&
    policyOption !== 'skip'
  ) {
    throw new ImageProcessError(`Unsupported SVG sanitizer policy: ${String(policyOption)}.`, 'INVALID_SOURCE', {
      details: { policy: policyOption },
    });
  }

  const policy: SvgSanitizerPolicy = policyOption ?? 'lightweight';

  const bytes = UTF8_ENCODER.encode(svgString).length;
  const environment = detectRuntimeEnvironment();

  // byte 초과 → 정책별 fallback
  if (bytes > MAX_SVG_BYTES) {
    const report: InspectSvgSanitizationReport = {
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      policy,
      impact: buildBytesExceededImpact(policy, bytes),
    };
    return report;
  }

  // 정상 경로 — 정책별 분기.
  // - lightweight: sanitizer 동기 실행 + outputBytes 측정 + 일반 stage 수집
  // - skip: sanitizer 미실행, 일반 stage를 potentialStages로 수집
  // - strict: sanitizer 실행 + outputBytes/outputNodeCount 측정 +
  //   원본 DOM 순회 기반 stage 수집(strict 컨텍스트에서는 doctype/entity 포함)
  let impact: InspectSvgSanitizationImpact;
  if (policy === 'lightweight') {
    impact = runLightweightImpact(svgString);
  } else if (policy === 'skip') {
    impact = runSkipImpact(svgString);
  } else {
    impact = await runStrictImpact(svgString);
  }

  const report: InspectSvgSanitizationReport = {
    bytes,
    byteLimit: MAX_SVG_BYTES,
    environment,
    policy,
    impact,
  };
  return report;
}
