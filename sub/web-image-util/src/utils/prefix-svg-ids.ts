import { MAX_SVG_BYTES } from '../core/source-converter/options';
import { ImageProcessError } from '../errors';

/** rewrite를 보류한 사유. 같은 호출에서 여러 사유가 중복 누적될 수 있다. */
export type SvgIdPrefixDeoptReason =
  | 'byte-limit-exceeded'
  | 'parse-failed'
  | 'domparser-unavailable'
  | 'style-tag-present'
  | 'style-attribute-present';

/** rewrite를 부분적으로 생략한 사유. 정상 경로에서만 등장한다(deopt 경로에서는 빈 배열). */
export type SvgIdPrefixWarningCode =
  | 'id-rewrite-skipped-idempotent'
  | 'id-rewrite-skipped-collision'
  | 'reference-skipped-dangling'
  | 'reference-skipped-external';

export interface SvgIdPrefixWarning {
  code: SvgIdPrefixWarningCode;
  /** 발생 횟수. count > 0 일 때만 warnings 배열에 포함된다. */
  count: number;
}

export interface SvgIdPrefixReport {
  /** style/parse 실패/byte 초과로 rewrite를 보류했는지. true면 svg는 입력 원본 그대로. */
  deoptimized: boolean;
  /** deoptimized=true일 때 사유 배열. false일 때 빈 배열. */
  deoptReasons: SvgIdPrefixDeoptReason[];
  /** 입력 UTF-8 byte 수. */
  bytes: number;
  /** byte 한도(`MAX_SVG_BYTES`). */
  byteLimit: number;
  /** 실행 환경 표시. inspectSvg의 environment와 동일 규칙. */
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  /** prefix 접두를 실제로 붙인 id 개수(idempotent/collision 생략 제외). */
  prefixedIdCount: number;
  /** rewrite한 fragment reference 개수(dangling/external 생략 제외). */
  rewrittenReferenceCount: number;
  /** structured warning 목록. 각 code는 최대 1개. */
  warnings: SvgIdPrefixWarning[];
}

export interface SvgIdPrefixResult {
  /** 정상 경로: prefix가 적용된 svg. deopt 경로: 입력 원본 svg. */
  svg: string;
  report: SvgIdPrefixReport;
}

/** prefix 허용 패턴. XML id / CSS selector / URL fragment 세 표준의 교집합(D1). */
const PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/** fragment reference를 담을 수 있는 attribute 이름 집합(소문자 기준). */
const REF_ATTR_NAMES = new Set<string>(['href', 'xlink:href', 'src']);

/**
 * element에서 reference attribute 값을 읽는다.
 * xlink:href는 getAttributeNS를 우선 시도하고, 없으면 getAttribute로 폴백한다.
 */
function readReferenceAttribute(element: Element, attrName: string, lowered: string): string | null {
  if (lowered === 'xlink:href') {
    const nsVal = element.getAttributeNS(XLINK_NAMESPACE, 'href');
    if (nsVal !== null) return nsVal;
    return element.getAttribute(attrName);
  }
  return element.getAttribute(attrName);
}

/**
 * element의 reference attribute를 새 값으로 쓴다.
 * xlink:href는 setAttributeNS를 사용해 namespace를 보존한다.
 */
function writeReferenceAttribute(element: Element, attrName: string, lowered: string, newValue: string): void {
  if (lowered === 'xlink:href') {
    element.setAttributeNS(XLINK_NAMESPACE, attrName, newValue);
  } else {
    element.setAttribute(attrName, newValue);
  }
}

/** classifyFragmentReference 반환 — internal은 token까지 함께 노출해 호출부 trim 중복을 제거한다. */
type ClassifiedReference = { kind: 'internal'; token: string } | { kind: 'external' } | { kind: 'non-fragment' };

/**
 * attribute 값이 내부 fragment 참조인지, 외부 fragment 참조인지, 비fragment인지 분류한다.
 * - `#token` (token 비어있지 않음) → 'internal' + token(trim된 값)
 * - `prefix#frag` (# 앞에 비어있지 않은 prefix) → 'external'
 * - 그 외 → 'non-fragment'
 */
function classifyFragmentReference(value: string): ClassifiedReference {
  const trimmed = value.trim();
  if (trimmed.startsWith('#')) {
    if (trimmed.length > 1) return { kind: 'internal', token: trimmed.slice(1) };
    return { kind: 'non-fragment' };
  }
  if (trimmed.indexOf('#') > 0) return { kind: 'external' };
  return { kind: 'non-fragment' };
}

/**
 * doc 내 모든 요소의 href/xlink:href/src attribute에서 fragment 참조를 찾아 rewrite한다.
 * idSet은 rewrite 전 doc의 원본 id 집합으로 dangling 판정 기준이다.
 */
function rewriteFragmentReferences(
  doc: Document,
  rewrites: Map<string, string>,
  idSet: Set<string>
): { rewrittenCount: number; danglingCount: number; externalCount: number } {
  let rewrittenCount = 0;
  let danglingCount = 0;
  let externalCount = 0;

  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    for (const attrName of el.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      if (!REF_ATTR_NAMES.has(lowered)) continue;

      const value = readReferenceAttribute(el, attrName, lowered);
      if (value === null) continue;

      const classification = classifyFragmentReference(value);
      if (classification.kind === 'non-fragment') continue;
      if (classification.kind === 'external') {
        externalCount += 1;
        continue;
      }

      // internal
      const token = classification.token;
      if (!idSet.has(token)) {
        danglingCount += 1;
        continue;
      }
      const newId = rewrites.get(token);
      if (newId !== undefined) {
        writeReferenceAttribute(el, attrName, lowered, `#${newId}`);
        rewrittenCount += 1;
      }
      // idSet에 있지만 rewrites에 없으면(idempotent 등) 아무것도 하지 않음
    }
  }

  return { rewrittenCount, danglingCount, externalCount };
}

/** 텍스트인코더 싱글턴 — UTF-8 바이트 측정에 사용한다. */
const encoder = new TextEncoder();

/**
 * 현재 실행 환경을 감지한다. inspectSvg와 동일 규칙을 인라인으로 둔다(D11).
 * 평가 순서: happyDOM → browser → node → unknown.
 */
function detectPrefixEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
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

/**
 * SVG 문자열의 모든 `[id]` 요소에 prefix를 붙이고 같은 문서 안의 attribute fragment reference만 rewrite한다.
 *
 * 신뢰할 수 없는 SVG는 먼저 `sanitizeSvgStrict()`로 정제한 뒤 본 함수를 호출한다.
 * 본 함수는 sanitizer가 아니며 보안 경계가 되지 않는다.
 *
 * `<style>` 요소 또는 `style` 속성이 있는 입력은 rewrite를 전면 보류하고 입력 svg를 그대로 반환한다.
 * CSS 내부 `url(#id)` rewrite는 본 함수 비범위다.
 *
 * @throws {ImageProcessError} code=`SVG_INPUT_INVALID` — svgString이 string이 아님.
 * @throws {ImageProcessError} code=`OPTION_INVALID` — prefix가 string이 아니거나 허용 패턴(D1)을 위반.
 */
export function prefixSvgIds(svgString: string, prefix: string): SvgIdPrefixResult {
  // svgString 타입 검증
  if (typeof svgString !== 'string') {
    const actualType = svgString === null ? 'null' : typeof svgString;
    throw new ImageProcessError(
      `prefixSvgIds expects a string svgString, but received ${actualType}.`,
      'SVG_INPUT_INVALID',
      {
        details: { actualType },
      }
    );
  }

  // prefix 타입 검증
  if (typeof prefix !== 'string') {
    const actualType = prefix === null ? 'null' : typeof prefix;
    throw new ImageProcessError(`prefixSvgIds expects a string prefix, but received ${actualType}.`, 'OPTION_INVALID', {
      details: { option: 'prefix', actualType },
    });
  }

  // prefix 형식 검증 (D1)
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new ImageProcessError('prefixSvgIds prefix must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.', 'OPTION_INVALID', {
      details: { option: 'prefix', reason: 'invalid-format' },
    });
  }

  // UTF-8 바이트 측정
  const bytes = encoder.encode(svgString).byteLength;
  const environment = detectPrefixEnvironment();

  // byte 초과 deopt (D10)
  if (bytes > MAX_SVG_BYTES) {
    return buildDeoptResult(svgString, bytes, environment, ['byte-limit-exceeded']);
  }

  // DOMParser 파싱 시도
  const parseResult = parseSvgDocument(svgString);
  if ('failure' in parseResult) {
    return buildDeoptResult(svgString, bytes, environment, [parseResult.failure]);
  }

  // style deopt 사전 감지 (D5)
  const styleReasons = detectStyleDeoptReasons(parseResult);
  if (styleReasons.length > 0) {
    return buildDeoptResult(svgString, bytes, environment, styleReasons);
  }

  // ID rewrite
  const elements = collectIdElements(parseResult);
  // 원본 id 집합을 applyIdRewrites 이전에 확보해 dangling 판정 기준으로 사용한다
  const originalIdSet = new Set(
    elements.map((el) => el.getAttribute('id')).filter((id): id is string => id !== null && id !== '')
  );
  const { rewrites, warnings: rewriteWarnings } = planIdRewrites(elements, prefix);
  const prefixedIdCount = applyIdRewrites(elements, rewrites);
  const { rewrittenCount, danglingCount, externalCount } = rewriteFragmentReferences(
    parseResult,
    rewrites,
    originalIdSet
  );

  const serialized = serializeSvgDocument(parseResult);
  if (serialized === null) {
    return buildDeoptResult(svgString, bytes, environment, ['parse-failed']);
  }

  // warnings 조합 (count > 0인 항목만)
  const warnings: SvgIdPrefixWarning[] = [];
  if (rewriteWarnings.idempotent > 0) {
    warnings.push({ code: 'id-rewrite-skipped-idempotent', count: rewriteWarnings.idempotent });
  }
  if (rewriteWarnings.collision > 0) {
    warnings.push({ code: 'id-rewrite-skipped-collision', count: rewriteWarnings.collision });
  }
  if (danglingCount > 0) {
    warnings.push({ code: 'reference-skipped-dangling', count: danglingCount });
  }
  if (externalCount > 0) {
    warnings.push({ code: 'reference-skipped-external', count: externalCount });
  }

  return {
    svg: serialized,
    report: {
      deoptimized: false,
      deoptReasons: [],
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      prefixedIdCount,
      rewrittenReferenceCount: rewrittenCount,
      warnings,
    },
  };
}

/**
 * SVG 문자열을 DOMParser로 파싱한다.
 * DOMParser/XMLSerializer 미가용, parsererror, root가 svg가 아닌 경우 failure를 반환한다.
 */
function parseSvgDocument(svgString: string): Document | { failure: SvgIdPrefixDeoptReason } {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return { failure: 'domparser-unavailable' };
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return { failure: 'parse-failed' };
    }
    if (!doc.documentElement || doc.documentElement.tagName.toLowerCase() !== 'svg') {
      return { failure: 'parse-failed' };
    }
    return doc;
  } catch {
    return { failure: 'parse-failed' };
  }
}

/**
 * doc에 style deopt 사유가 있는지 검사한다.
 * `<style>` 요소 존재 → 'style-tag-present', style 속성 존재 → 'style-attribute-present'.
 * 두 사유 모두 가능하다.
 */
function detectStyleDeoptReasons(doc: Document): SvgIdPrefixDeoptReason[] {
  const reasons: SvgIdPrefixDeoptReason[] = [];
  if (doc.getElementsByTagName('style').length > 0) {
    reasons.push('style-tag-present');
  }
  const allElements = doc.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    if (allElements[i].getAttribute('style') !== null) {
      reasons.push('style-attribute-present');
      break;
    }
  }
  return reasons;
}

/**
 * doc 내 id 속성이 있는(빈 문자열 제외) 모든 요소를 수집한다. 순회 순서 보존.
 */
function collectIdElements(doc: Document): Element[] {
  const all = doc.getElementsByTagName('*');
  const result: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    const id = all[i].getAttribute('id');
    if (id !== null && id !== '') {
      result.push(all[i]);
    }
  }
  return result;
}

/**
 * 1차 패스: idempotent 분류. 2차 패스: collision 검사.
 * 결정론적 처리를 위해 수집 순서대로 후보를 등록하고, 이미 결정된 후보 또는 기존 doc id와 충돌하면 제외한다.
 */
function planIdRewrites(
  elements: Element[],
  prefix: string
): { rewrites: Map<string, string>; warnings: { idempotent: number; collision: number } } {
  const warnings = { idempotent: 0, collision: 0 };
  const rewrites = new Map<string, string>();

  // 원본 doc의 전체 id 집합
  const existingIds = new Set<string>(elements.map((el) => el.getAttribute('id') as string));

  // 이미 결정된 후보 결과 id 집합(충돌 검사용)
  const assignedCandidates = new Set<string>();

  for (const el of elements) {
    const originalId = el.getAttribute('id') as string;
    const prefixedId = `${prefix}-${originalId}`;

    // idempotent: 이미 prefix가 붙어 있음
    if (originalId.startsWith(`${prefix}-`)) {
      warnings.idempotent += 1;
      continue;
    }

    // collision: 후보 결과 id가 기존 doc id 또는 이미 결정된 후보와 충돌
    if (existingIds.has(prefixedId) || assignedCandidates.has(prefixedId)) {
      warnings.collision += 1;
      continue;
    }

    rewrites.set(originalId, prefixedId);
    assignedCandidates.add(prefixedId);
  }

  return { rewrites, warnings };
}

/**
 * rewrites에 등재된 id를 가진 요소의 id attribute를 새 값으로 변경한다. 변경한 요소 개수 반환.
 * 같은 originalId가 두 요소에 등장하는 비정상 입력에서는 첫 요소만 rewrite하고 나머지는 건너뛴다
 * (planIdRewrites가 후속 요소를 이미 collision으로 분류한다 — D12).
 */
function applyIdRewrites(elements: Element[], rewrites: Map<string, string>): number {
  let count = 0;
  const processed = new Set<string>();
  for (const el of elements) {
    const originalId = el.getAttribute('id') as string;
    if (processed.has(originalId)) continue;
    const newId = rewrites.get(originalId);
    if (newId !== undefined) {
      el.setAttribute('id', newId);
      processed.add(originalId);
      count += 1;
    }
  }
  return count;
}

/**
 * doc을 XMLSerializer로 직렬화한다. 예외 발생 시 null 반환(fail-safe D13).
 */
function serializeSvgDocument(doc: Document): string | null {
  try {
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return null;
  }
}

/** deopt 응답을 일관된 shape으로 생성한다. */
function buildDeoptResult(
  svgString: string,
  bytes: number,
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown',
  deoptReasons: SvgIdPrefixDeoptReason[]
): SvgIdPrefixResult {
  return {
    svg: svgString,
    report: {
      deoptimized: true,
      deoptReasons,
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      prefixedIdCount: 0,
      rewrittenReferenceCount: 0,
      warnings: [],
    },
  };
}
