import { classifyUriRef, isEventHandlerAttributeName, type UriRefReason } from '../svg-threat-policy.internal';
import { isReferenceAttribute, readReferenceAttribute } from './reference-attribute.internal';
import { pushCappedSample } from './sample-utils.internal';

export interface SvgDomSecuritySignals {
  scriptElementCount: number;
  foreignObjectElementCount: number;
  eventHandlerAttributeCount: number;
  eventHandlerAttributeSamples: string[];
  externalHrefCount: number;
  externalHrefSamples: string[];
}

/**
 * 이 진단 축이 외부 참조 신호로 집계하는 reason 집합.
 *
 * `sanitizeUriValue()`가 실제로 제거하는 5종(`empty`·`normalized-empty`·
 * `boundary-quote`·`unsafe-data`·`external`)과는 다르다 — 이 집합은 "sanitizer가
 * 제거하는 것"이 아니라 "이 진단 축이 세는 것"이다. `data:` 계열(`unsafe-data`
 * 포함)은 embedded image 단계가 별도로 처리하므로 제외해 이중 카운트를 막는다.
 * `normalized-empty`(문자참조 공백 등)는 원본이 비어 있지 않아 이 축의
 * "빈 참조"에 해당하지 않는다.
 */
const COUNTED_REFERENCE_REASONS: ReadonlySet<UriRefReason> = new Set<UriRefReason>([
  'empty',
  'boundary-quote',
  'external',
]);

/**
 * `href`/`xlink:href`/`src` 값을 이 진단 축에서 집계할지 판정한다.
 *
 * 판정은 위협 정책이 소유하고, 이 모듈은 어떤 근거를 집계할지만 고른다.
 */
function isCountedSvgReference(value: string): boolean {
  return COUNTED_REFERENCE_REASONS.has(classifyUriRef(value, 'lightweight').reason);
}

/** DOM 기반 SVG 보안 신호를 한 번의 순회로 수집한다. */
export function collectSvgDomSecuritySignals(doc: Document): SvgDomSecuritySignals {
  const signals: SvgDomSecuritySignals = {
    scriptElementCount: 0,
    foreignObjectElementCount: 0,
    eventHandlerAttributeCount: 0,
    eventHandlerAttributeSamples: [],
    externalHrefCount: 0,
    externalHrefSamples: [],
  };

  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;

    const tagName = element.tagName.toLowerCase();
    if (tagName === 'script') {
      signals.scriptElementCount += 1;
    } else if (tagName === 'foreignobject') {
      signals.foreignObjectElementCount += 1;
    }

    for (const attrName of element.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      if (isEventHandlerAttributeName(attrName)) {
        signals.eventHandlerAttributeCount += 1;
        pushCappedSample(signals.eventHandlerAttributeSamples, lowered);
      }
      if (isReferenceAttribute(element, attrName)) {
        const value = readReferenceAttribute(element, attrName) ?? '';
        if (isCountedSvgReference(value)) {
          signals.externalHrefCount += 1;
          pushCappedSample(signals.externalHrefSamples, lowered);
        }
      }
    }
  }

  return signals;
}
