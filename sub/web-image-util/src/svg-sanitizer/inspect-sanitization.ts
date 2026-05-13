/**
 * SVG sanitizer 정책 영향 진단 API.
 *
 * 입력 SVG 문자열 한 개와 정책 한 개를 받아 부수효과 없이 진단해
 * `InspectSvgSanitizationReport`를 반환한다. 네트워크 fetch, Canvas 렌더링,
 * DOMPurify의 top-level import를 수행하지 않는다. strict 경로만 `await import('./core')`로
 * DOMPurify에 동적 접근한다.
 *
 * 본 모듈은 TASK-01 시점에 외부로 노출되지 않는다. `svg-sanitizer/index.ts` 추가와
 * contract 픽스처 갱신은 TASK-04에서 한 번에 수행한다.
 */

import { MAX_SVG_BYTES } from '../core/source-converter/options';
import { isBlockedSvgPolicyRef } from '../core/source-converter/url/policy';
import { ImageProcessError } from '../errors';
import { getCssPolicyValueVariants, normalizePolicyValue, visitCssUrlValues } from '../utils/svg-policy-utils';
import { sanitizeSvgForRendering } from '../utils/svg-sanitizer';

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

/**
 * 현재 실행 환경을 감지한다.
 *
 * inspectSvg의 `detectInspectEnvironment`와 동일한 평가 순서지만, `utils ↔ svg-sanitizer`
 * 서브패스 간 의존성 추가를 피하기 위해 본 모듈에 인라인으로 둔다.
 *
 * 1. globalThis.happyDOM 이 존재하면 'happy-dom'
 * 2. window / document / DOMParser 모두 존재하면 'browser'
 * 3. process.versions.node 이 존재하면 'node'
 * 4. 그 외 'unknown'
 */
function detectSanitizationEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
  if ((globalThis as unknown as Record<string, unknown>).happyDOM != null) {
    return 'happy-dom';
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof DOMParser !== 'undefined') {
    return 'browser';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  return 'unknown';
}

/** samples 토큰 최대 길이. 모든 고정 토큰은 32자 이하이며 동적 식별자는 잘라낸다. */
const MAX_SAMPLE_LENGTH = 32;
/** stage 당 samples 배열 최대 길이. */
const MAX_SAMPLES_PER_STAGE = 3;

/** event handler 속성 이름 패턴. `on=` 단독은 매치되지 않도록 접미사 1자 이상을 요구한다. */
const EVENT_HANDLER_ATTR_PATTERN = /^on[a-z0-9:-]+$/i;
/** doctype 선언 정규식. */
const DOCTYPE_PATTERN = /<!DOCTYPE\b/gi;
/** entity 선언 정규식. */
const ENTITY_PATTERN = /<!ENTITY\b/gi;
/** xlink namespace. happy-dom과 브라우저 모두에서 동일하다. */
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/**
 * stage 단위 누적 상태. count는 발생 수, samples는 발생 순서 중복 제거(Set) 후 최대 3개.
 */
interface StageAccumulator {
  count: number;
  samples: Set<string>;
}

function createAccumulator(): StageAccumulator {
  return { count: 0, samples: new Set<string>() };
}

/** samples Set에 토큰을 추가한다. 32자 초과는 잘라낸다. */
function addSample(acc: StageAccumulator, sample: string): void {
  if (acc.samples.size >= MAX_SAMPLES_PER_STAGE) return;
  const normalized = sample.length > MAX_SAMPLE_LENGTH ? sample.slice(0, MAX_SAMPLE_LENGTH) : sample;
  acc.samples.add(normalized);
}

/** count > 0 이면 stage를 결과 배열에 추가한다. */
function pushStage(
  stages: InspectSvgSanitizationStage[],
  code: InspectSvgSanitizationStageCode,
  acc: StageAccumulator
): void {
  if (acc.count <= 0) return;
  stages.push({
    code,
    count: acc.count,
    samples: Array.from(acc.samples).slice(0, MAX_SAMPLES_PER_STAGE),
  });
}

/**
 * `href`/`xlink:href`/`src` 속성값이 `external-href-removed` stage에 카운트되어야 하는지 판정한다.
 *
 * lightweight sanitizer는 외부 URL(http/https/data/javascript/protocol-relative)만 제거하며,
 * 내부 fragment(`#...`)와 일반 상대 경로(`./`, `../`, `/path`)는 보존한다. 본 stage는
 * lightweight 동작과 일관성을 유지하기 위해 동일한 경로들을 카운트에서 제외한다.
 *
 * `data:`로 시작하는 값은 TASK-03의 embedded image stage(`data-image-preserved` /
 * `data-image-blocked` / `nested-svg-resanitized`)가 일괄 처리한다. 미허용 MIME / 크기 초과 등
 * 정책상 차단되는 `data:` 값도 본 stage에서는 제외해 중복 카운트를 방지한다.
 */
function shouldCountExternalHref(value: string): boolean {
  if (value === '') return false;

  const normalized = normalizePolicyValue(value);
  if (normalized === '') return false;
  // 모든 data: 값은 embedded image stage가 처리하므로 본 stage에서 제외
  if (normalized.startsWith('data:')) return false;
  // 내부 fragment 참조는 제외
  if (normalized.startsWith('#')) return false;
  // 일반 상대 경로(./, ../) 제외
  if (normalized.startsWith('./') || normalized.startsWith('../')) return false;
  // 절대 경로(/path)는 보존 대상. protocol-relative(//host)는 차단 대상이므로 분리한다.
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return false;

  return getCssPolicyValueVariants(value).some(isBlockedSvgPolicyRef);
}

/**
 * `script-removed` 카운트와 samples를 수집한다.
 */
function collectScriptStage(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const acc = createAccumulator();
  const scripts = doc.getElementsByTagName('script');
  if (scripts.length > 0) {
    acc.count = scripts.length;
    addSample(acc, 'script');
  }
  pushStage(stages, 'script-removed', acc);
}

/**
 * `foreign-object-removed` 카운트와 samples를 수집한다.
 */
function collectForeignObjectStage(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const acc = createAccumulator();
  const elements = doc.getElementsByTagName('foreignObject');
  if (elements.length > 0) {
    acc.count = elements.length;
    addSample(acc, 'foreignobject');
  }
  pushStage(stages, 'foreign-object-removed', acc);
}

/**
 * `event-handler-removed`, `external-href-removed` 카운트를 한 번의 DOM 순회로 수집한다.
 */
function collectAttributeStages(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const eventHandler = createAccumulator();
  const externalHref = createAccumulator();

  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;

    const attrNames = element.getAttributeNames();
    for (const attrName of attrNames) {
      const lowered = attrName.toLowerCase();

      // event handler 속성
      if (EVENT_HANDLER_ATTR_PATTERN.test(attrName)) {
        eventHandler.count += 1;
        addSample(eventHandler, lowered);
      }

      // href / xlink:href / src 속성값 검사
      if (lowered === 'href' || lowered === 'xlink:href' || lowered === 'src') {
        let rawValue: string | null;
        if (lowered === 'xlink:href') {
          rawValue = element.getAttributeNS(XLINK_NAMESPACE, 'href');
          if (rawValue === null) {
            rawValue = element.getAttribute(attrName);
          }
        } else {
          rawValue = element.getAttribute(attrName);
        }
        const value = rawValue ?? '';
        if (shouldCountExternalHref(value)) {
          externalHref.count += 1;
          addSample(externalHref, lowered);
        }
      }
    }
  }

  pushStage(stages, 'event-handler-removed', eventHandler);
  pushStage(stages, 'external-href-removed', externalHref);
}

/**
 * `external-css-removed` 카운트를 수집한다. style 속성과 `<style>` 본문 양쪽을 검사한다.
 */
function collectExternalCssStage(doc: Document, stages: InspectSvgSanitizationStage[]): void {
  const acc = createAccumulator();

  // style attribute 검사
  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;
    const styleValue = element.getAttribute('style');
    if (styleValue === null || styleValue === '') continue;
    visitCssUrlValues(styleValue, (urlValue) => {
      if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
        acc.count += 1;
        addSample(acc, 'style');
      }
    });
  }

  // <style> 태그 본문 검사
  const styleTags = doc.getElementsByTagName('style');
  for (let i = 0; i < styleTags.length; i++) {
    const tag = styleTags[i];
    if (!tag) continue;
    const text = tag.textContent ?? '';
    if (text === '') continue;
    visitCssUrlValues(text, (urlValue) => {
      if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
        acc.count += 1;
        addSample(acc, 'style-tag');
      }
    });
  }

  pushStage(stages, 'external-css-removed', acc);
}

/**
 * 원본 svgString의 `<!DOCTYPE>` / `<!ENTITY>` 매치 수로 stage를 수집한다.
 *
 * lightweight sanitizer는 DOCTYPE/ENTITY를 제거하지 않으므로 호출 정책 컨텍스트가
 * `'lightweight'` 또는 `'skip'`이면 본 함수는 어떤 stage도 추가하지 않는다. 두 stage는
 * 향후 strict 정책 컨텍스트에서만 등장한다.
 */
function collectDoctypeAndEntityStages(
  svgString: string,
  policy: 'lightweight' | 'skip' | 'strict',
  stages: InspectSvgSanitizationStage[]
): void {
  if (policy !== 'strict') return;

  const doctypeMatches = svgString.match(DOCTYPE_PATTERN);
  if (doctypeMatches && doctypeMatches.length > 0) {
    const acc = createAccumulator();
    acc.count = doctypeMatches.length;
    addSample(acc, 'doctype');
    pushStage(stages, 'doctype-removed', acc);
  }

  const entityMatches = svgString.match(ENTITY_PATTERN);
  if (entityMatches && entityMatches.length > 0) {
    const acc = createAccumulator();
    acc.count = entityMatches.length;
    addSample(acc, 'entity');
    pushStage(stages, 'entity-removed', acc);
  }
}

/**
 * 일반 정책 stage 7개를 수집한다(`script-removed` / `foreign-object-removed` /
 * `event-handler-removed` / `external-href-removed` / `external-css-removed` /
 * `doctype-removed` / `entity-removed`).
 *
 * DOM 기반 수집은 doc이 non-null일 때만 수행한다. 파싱 실패 또는 non-svg 루트 입력은
 * 빈 stages를 반환한다(doctype/entity는 호출 정책 컨텍스트로 분기되며 lightweight/skip에서는
 * 어차피 결과에서 제외된다).
 *
 * embedded image stage(`data-image-*`, `nested-svg-resanitized`)는 본 헬퍼 범위 밖이며,
 * TASK-03이 별도 헬퍼로 추가한다.
 */
function collectGeneralStages(
  svgString: string,
  doc: Document | null,
  policy: 'lightweight' | 'skip' | 'strict'
): InspectSvgSanitizationStage[] {
  const stages: InspectSvgSanitizationStage[] = [];

  if (doc !== null) {
    collectScriptStage(doc, stages);
    collectForeignObjectStage(doc, stages);
    collectAttributeStages(doc, stages);
    collectExternalCssStage(doc, stages);
  }

  collectDoctypeAndEntityStages(svgString, policy, stages);

  return stages;
}

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

/** strict 정책의 placeholder impact. strict 실제 실행은 TASK-04에서 채운다. */
function buildStrictPlaceholderImpact(bytes: number): InspectSvgSanitizationImpact {
  return {
    kind: 'strict',
    status: 'ok',
    outputBytes: bytes,
    outputNodeCount: 0,
    stages: [],
    failure: null,
  };
}

/**
 * lightweight 정책 경로. 입력 SVG에 `sanitizeSvgForRendering`을 동기 실행해 outputBytes를
 * 측정하고, 입력을 DOMParser로 파싱해 `collectGeneralStages('lightweight')`로 stage를 수집한다.
 *
 * 파싱 실패 또는 non-svg 루트라도 sanitize는 그대로 수행(정규식 기반이므로 파싱과 무관)하며,
 * stages는 빈 배열을 반환하고 status는 'ok'를 유지한다.
 */
function runLightweightImpact(svgString: string): InspectSvgSanitizationImpact {
  const sanitized = sanitizeSvgForRendering(svgString);
  const outputBytes = new TextEncoder().encode(sanitized).length;
  const doc = parseSvgDocument(svgString);
  const stages = collectGeneralStages(svgString, doc, 'lightweight');

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
 * `collectGeneralStages('skip')`으로 "lightweight가 적용됐다면 발동했을" stage를 수집한다.
 */
function runSkipImpact(svgString: string): InspectSvgSanitizationImpact {
  const doc = parseSvgDocument(svgString);
  const potentialStages = collectGeneralStages(svgString, doc, 'skip');
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

  // UTF-8 바이트 측정 + 환경 감지
  const bytes = new TextEncoder().encode(svgString).length;
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
  // - strict: TASK-04에서 동적 실행으로 교체. 현재는 placeholder.
  let impact: InspectSvgSanitizationImpact;
  if (policy === 'lightweight') {
    impact = runLightweightImpact(svgString);
  } else if (policy === 'skip') {
    impact = runSkipImpact(svgString);
  } else {
    impact = buildStrictPlaceholderImpact(bytes);
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
