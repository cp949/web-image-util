import { isDataURLString } from '../data-url';
import { isBlockedPipelineUriRef, isEventHandlerAttributeName } from '../svg-threat-policy.internal';
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
 * `href`/`xlink:href`/`src` 값이 제거 대상 참조인지 판정한다.
 *
 * 위협 정책의 URI allowlist가 두 모드에서 동일해진 뒤로 이 판정은 모드 무관이다 —
 * 내부 fragment(`#...`)와 모든 `data:` 값만 제외하고 나머지(빈 값, 상대 경로,
 * 미지 스킴 포함)를 제거 대상으로 센다. `data:` 값은 embedded image 단계가
 * 별도로 처리하므로 본 판정에서 제외해 이중 카운트를 막는다.
 */
function isRemovedSvgReference(value: string): boolean {
  // 모든 data: 값은 embedded image 단계가 처리하므로 제외
  if (isDataURLString(value)) return false;
  return value.trim() === '' || isBlockedPipelineUriRef(value);
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
        if (isRemovedSvgReference(value)) {
          signals.externalHrefCount += 1;
          pushCappedSample(signals.externalHrefSamples, lowered);
        }
      }
    }
  }

  return signals;
}
