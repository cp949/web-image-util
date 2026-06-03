/**
 * SVG sanitizer 정책 영향 진단 API.
 *
 * 입력 SVG 문자열 한 개와 정책 한 개를 받아 부수효과 없이 진단해
 * `InspectSvgSanitizationReport`를 반환한다. 네트워크 fetch, Canvas 렌더링,
 * DOMPurify의 top-level import를 수행하지 않는다. strict 경로만 `await import('./core.internal')`로
 * DOMPurify에 동적 접근한다.
 *
 * 본 모듈은 TASK-01 시점에 외부로 노출되지 않는다. `svg-sanitizer/index.ts` 추가와
 * contract 픽스처 갱신은 TASK-04에서 한 번에 수행한다.
 */

import { MAX_SVG_BYTES } from '../core/source-converter/options.internal';
import { ImageProcessError } from '../errors.internal';
import { detectSvgInspectionEnvironment } from '../utils/svg-inspection';
import { sanitizeSvgForRendering } from '../utils/svg-sanitizer';
import { collectEmbeddedImageStages, collectGeneralStages } from './inspect-sanitization/stage-collectors.internal';

/** sanitizer 정책. processImage()의 `svgSanitizer` 옵션과 동일한 3개 값을 받는다. */
export type SvgSanitizerPolicy = 'lightweight' | 'strict' | 'skip';

/** 정책 발동(또는 발동했을) 사건을 식별하는 코드. inspectSvg finding 코드와 1:1 의미 호응. */
export type InspectSvgSanitizationStageCode =
  | 'script-removed'
  | 'foreign-object-removed'
  | 'event-handler-removed'
  | 'external-href-removed'
  | 'external-css-removed'
  | 'doctype-removed'
  | 'entity-removed'
  | 'data-image-preserved'
  | 'data-image-blocked'
  | 'nested-svg-resanitized';

/** strict 실행 실패 또는 byte 초과 사유. lightweight/strict failure 필드와 진단 함수 throw에 사용. */
export type InspectSvgSanitizationFailureCode =
  | 'svg-input-invalid'
  | 'svg-bytes-exceeded'
  | 'svg-node-count-exceeded'
  | 'svg-dompurify-init-failed'
  | 'svg-strict-internal-error';

export interface InspectSvgSanitizationStage {
  code: InspectSvgSanitizationStageCode;
  /** 정책 발동(또는 발동했을) 횟수. count > 0 일 때만 stage가 배열에 포함된다. */
  count: number;
  /**
   * count > 0 일 때 1~3개 짧은 식별자. tagName(소문자) / attrName / 'style-tag' / 'doctype' /
   * 'entity' / MIME 문자열 중 하나. 원본 URL/속성값/SVG 원문은 담지 않는다. 각 항목 최대 32자.
   */
  samples: string[];
}

export interface InspectSvgSanitizationFailure {
  code: InspectSvgSanitizationFailureCode;
  /** 영어 자연문. 호출자 분기 대상이 아니며 patch에서도 자유롭게 다듬을 수 있다. */
  message: string;
}

export interface InspectSvgSanitizationLightweightImpact {
  kind: 'lightweight';
  status: 'ok' | 'failed';
  /** sanitize 완료 후 UTF-8 byte 수. failed이면 null. */
  outputBytes: number | null;
  stages: InspectSvgSanitizationStage[];
  failure: InspectSvgSanitizationFailure | null;
}

export interface InspectSvgSanitizationStrictImpact {
  kind: 'strict';
  status: 'ok' | 'failed';
  outputBytes: number | null;
  outputNodeCount: number | null;
  stages: InspectSvgSanitizationStage[];
  failure: InspectSvgSanitizationFailure | null;
}

export interface InspectSvgSanitizationSkipImpact {
  kind: 'skip';
  /** sanitizer가 실행되지 않았음을 타입으로 못박는다. */
  status: 'not-applied';
  /** lightweight가 적용됐다면 발동했을 정책 stage 카운트. 실제 정제는 수행하지 않는다. */
  potentialStages: InspectSvgSanitizationStage[];
}

export type InspectSvgSanitizationImpact =
  | InspectSvgSanitizationLightweightImpact
  | InspectSvgSanitizationStrictImpact
  | InspectSvgSanitizationSkipImpact;

export interface InspectSvgSanitizationReport {
  /** strict의 failure가 있어도 보고서 객체 자체는 항상 반환된다. impact.kind / impact.status로 분기. */
  bytes: number;
  byteLimit: number;
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  policy: SvgSanitizerPolicy;
  impact: InspectSvgSanitizationImpact;
}

export interface InspectSvgSanitizationOptions {
  /** 진단할 sanitizer 정책. 기본값: 'lightweight'. */
  policy?: SvgSanitizerPolicy;
}

/** 현재 실행 환경을 감지한다. 평가 순서는 happy-dom -> browser -> node -> unknown이다. */
function detectSanitizationEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
  return detectSvgInspectionEnvironment();
}

/** UTF-8 byte 길이 측정용 공용 인코더. 호출당 1회만 생성된다. */
const UTF8_ENCODER = new TextEncoder();

/**
 * DOMParser로 입력 SVG를 파싱한다. 파싱 실패(에러 노드) 또는 non-svg 루트는 null을 반환한다.
 *
 * 환경에 DOMParser가 없으면(unknown 환경) null을 반환한다. lightweight 경로에서도 정제는
 * 정규식 기반이라 파싱 실패와 무관하게 그대로 실행된다.
 */
function parseSvgDocument(svgString: string): Document | null {
  if (typeof DOMParser === 'undefined') return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return null;
    }
    const root = doc.documentElement;
    if (!root) return null;
    if (root.tagName.toLowerCase() !== 'svg') return null;
    return doc;
  } catch {
    return null;
  }
}

/** byte 초과 시 정책별로 반환할 fallback impact를 만든다. */
function buildBytesExceededImpact(policy: SvgSanitizerPolicy): InspectSvgSanitizationImpact {
  if (policy === 'skip') {
    return { kind: 'skip', status: 'not-applied', potentialStages: [] };
  }

  const failure: InspectSvgSanitizationFailure = {
    code: 'svg-bytes-exceeded',
    message: 'SVG input size exceeds the configured byte limit.',
  };

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
 * strict sanitizer를 동적 import로 실행한다.
 *
 * lazy 경계 유지를 위해 본 함수만 `await import('./core.internal')`를 수행한다(D4 / D1).
 * strict 내부에서 던진 `ImageProcessError`는 catch해 failure code로 매핑하며,
 * 동적 import 자체가 실패하면 `svg-dompurify-init-failed`로 변환한다(D6).
 *
 * 옵션은 `undefined`로 전달해 `removeMetadata=false`, `domPurifyConfig` 없음,
 * 기본 한도(`DEFAULT_MAX_BYTES`, `DEFAULT_MAX_NODE_COUNT`)를 그대로 사용한다.
 * 외부 호출이므로 recursionDepth는 0으로 둔다.
 */
async function runStrictSanitization(svgString: string): Promise<StrictSanitizationOutcome> {
  let sanitizeSvgStrictCore: typeof import('./core.internal').sanitizeSvgStrictCore;
  try {
    ({ sanitizeSvgStrictCore } = await import('./core.internal'));
  } catch {
    return {
      status: 'failed',
      failure: {
        code: 'svg-dompurify-init-failed',
        message: 'Strict sanitizer could not initialize DOMPurify in this environment.',
      },
    };
  }

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
  if (typeof DOMParser === 'undefined') return 0;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedSvg, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return 0;
    const root = doc.documentElement;
    if (!root) return 0;
    return root.querySelectorAll('*').length;
  } catch {
    return 0;
  }
}

/**
 * strict 정책 경로. 동적 import로 strict sanitizer를 실행하고 결과를 측정한다.
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
  const stages = collectGeneralStages(svgString, doc, 'strict');
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
 * 측정하고, 입력을 DOMParser로 파싱해 `collectGeneralStages('lightweight')`와
 * `collectEmbeddedImageStages`로 stage를 수집해 합친다.
 *
 * 파싱 실패 또는 non-svg 루트라도 sanitize는 그대로 수행(정규식 기반이므로 파싱과 무관)하며,
 * stages는 빈 배열을 반환하고 status는 'ok'를 유지한다.
 */
function runLightweightImpact(svgString: string): InspectSvgSanitizationImpact {
  const sanitized = sanitizeSvgForRendering(svgString);
  const outputBytes = UTF8_ENCODER.encode(sanitized).length;
  const doc = parseSvgDocument(svgString);
  const stages = collectGeneralStages(svgString, doc, 'lightweight');
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
 * `collectGeneralStages('skip')`와 `collectEmbeddedImageStages`로
 * "lightweight가 적용됐다면 발동했을" stage를 수집해 합친다.
 */
function runSkipImpact(svgString: string): InspectSvgSanitizationImpact {
  const doc = parseSvgDocument(svgString);
  const potentialStages = collectGeneralStages(svgString, doc, 'skip');
  if (doc !== null) {
    potentialStages.push(...collectEmbeddedImageStages(doc));
  }
  return { kind: 'skip', status: 'not-applied', potentialStages };
}

/**
 * SVG 문자열에 sanitizer 정책을 적용했을 때 어떤 stage가 발동(또는 발동할)했는지 진단한다.
 *
 * 네트워크, Canvas 렌더링, DOMPurify top-level import를 수행하지 않는다.
 * strict 정책은 동적 import로만 DOMPurify에 접근한다.
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
  const environment = detectSanitizationEnvironment();

  // byte 초과 → 정책별 fallback
  if (bytes > MAX_SVG_BYTES) {
    const report: InspectSvgSanitizationReport = {
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      policy,
      impact: buildBytesExceededImpact(policy),
    };
    return report;
  }

  // 정상 경로 — 정책별 분기.
  // - lightweight: sanitizer 동기 실행 + outputBytes 측정 + 일반 stage 수집
  // - skip: sanitizer 미실행, 일반 stage를 potentialStages로 수집
  // - strict: 동적 import로 sanitizer 실행 + outputBytes/outputNodeCount 측정 +
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
