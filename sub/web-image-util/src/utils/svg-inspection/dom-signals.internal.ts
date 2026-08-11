import { isBlockedSvgPolicyRef } from '../../core/source-converter/url/policy.internal';
import { getCssPolicyValueVariants, normalizePolicyValue } from '../svg-policy-utils.internal';
import { isReferenceAttribute, readReferenceAttribute, type SvgInspectionPolicy } from './reference-attribute.internal';
import { pushCappedSample } from './sample-utils.internal';

const EVENT_HANDLER_ATTR_PATTERN = /^on[a-z0-9:-]+$/i;

export interface SvgDomSecuritySignals {
  scriptElementCount: number;
  foreignObjectElementCount: number;
  eventHandlerAttributeCount: number;
  eventHandlerAttributeSamples: string[];
  externalHrefCount: number;
  externalHrefSamples: string[];
}

export interface CollectSvgDomSecuritySignalsOptions {
  /**
   * href/src 참조 판정 정책.
   * lightweight는 렌더링 guard가 실제로 제거하는 명시적 외부 URL만 센다.
   * strict는 내부 fragment와 data:image 단계 위임 대상을 제외한 모든 참조를 제거 대상으로 센다.
   */
  policy?: SvgInspectionPolicy;
}

/**
 * `href`/`xlink:href`/`src` 값이 외부 참조(네트워크 트리거 대상)인지 판정한다.
 *
 * 내부 fragment(`#...`)와 모든 `data:` 값은 제외한다. `data:` 값은 embedded image 단계가
 * 별도로 처리하므로 본 판정에서 제외해 이중 카운트를 막는다.
 *
 * lightweight 정책에서는 일반 상대 경로(`./`, `../`)와 절대 경로(`/path`)를 보존 대상으로
 * 제외한다. strict 정책에서는 내부 fragment와 `data:`를 제외한 모든 참조를 제거 대상으로 센다.
 */
function isExternalSvgReference(value: string, policy: SvgInspectionPolicy): boolean {
  if (value === '') return false;

  const normalized = normalizePolicyValue(value);
  if (normalized === '') return false;
  // 모든 data: 값은 embedded image 단계가 처리하므로 제외
  if (normalized.startsWith('data:')) return false;
  // 내부 fragment 참조 제외
  if (normalized.startsWith('#')) return false;
  if (policy === 'strict') return true;
  // 일반 상대 경로(./, ../) 제외
  if (normalized.startsWith('./') || normalized.startsWith('../')) return false;
  // 절대 경로(/path)는 보존 대상. protocol-relative(//host)는 차단 대상이므로 분리한다.
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return false;

  return getCssPolicyValueVariants(value).some(isBlockedSvgPolicyRef);
}

/** DOM 기반 SVG 보안 신호를 한 번의 순회로 수집한다. */
export function collectSvgDomSecuritySignals(
  doc: Document,
  options: CollectSvgDomSecuritySignalsOptions = {}
): SvgDomSecuritySignals {
  const policy = options.policy ?? 'lightweight';
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
      if (EVENT_HANDLER_ATTR_PATTERN.test(attrName)) {
        signals.eventHandlerAttributeCount += 1;
        pushCappedSample(signals.eventHandlerAttributeSamples, lowered);
      }
      if (isReferenceAttribute(element, attrName)) {
        const value = readReferenceAttribute(element, attrName) ?? '';
        if (isExternalSvgReference(value, policy)) {
          signals.externalHrefCount += 1;
          pushCappedSample(signals.externalHrefSamples, lowered);
        }
      }
    }
  }

  return signals;
}
