import {
  decodeCssEscapes,
  getCssPolicyValueVariants,
  normalizePolicyValue,
  visitCssUrlValues,
} from '../svg-policy-utils.internal';
import type { SvgInspectionPolicy } from './reference-attribute.internal';
import { pushCappedSample } from './sample-utils.internal';

const CSS_URL_PRESENTATION_ATTRIBUTES = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'fill',
  'filter',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);
const CSS_IMAGE_SET_FUNCTION_PATTERN = /(?:-webkit-)?image-set\s*\([^)]*\)/gi;

export interface SvgCssReferenceSignals {
  externalCssCount: number;
  externalCssSamples: string[];
}

export interface CollectSvgCssReferenceSignalsOptions {
  /**
   * CSS url() 참조 판정 정책.
   * lightweight는 렌더링 guard가 실제로 치환하는 명시적 외부 URL만 센다.
   * strict는 url(#id)를 제외한 모든 url() 참조를 제거 대상으로 센다.
   */
  policy?: SvgInspectionPolicy;
}

function isLightweightExternalCssUrl(urlValue: string): boolean {
  return getCssPolicyValueVariants(urlValue)
    .map(normalizePolicyValue)
    .some(
      (value) =>
        value.startsWith('//') ||
        value.startsWith('http://') ||
        value.startsWith('https://') ||
        value.startsWith('data:') ||
        value.startsWith('javascript:')
    );
}

function isStrictExternalCssUrl(urlValue: string): boolean {
  return getCssPolicyValueVariants(urlValue)
    .map(normalizePolicyValue)
    .some((value) => value !== '' && !value.startsWith('#'));
}

function hasExternalUrlLiteral(css: string): boolean {
  return /(?:https?:|file:|data:|blob:|ftp:|\/\/)/i.test(css);
}

function shouldInspectStrictCssAttribute(attrName: string, element: Element): boolean {
  const lowered = attrName.toLowerCase();
  const localName = element.getAttributeNode(attrName)?.localName.toLowerCase() ?? lowered;
  return (
    lowered === 'style' ||
    CSS_URL_PRESENTATION_ATTRIBUTES.has(lowered) ||
    CSS_URL_PRESENTATION_ATTRIBUTES.has(localName)
  );
}

function countStrictCssPolicyTriggersInPlainCss(cssText: string): number {
  let count = 0;
  let cssWithoutWholeConstructs = cssText;

  cssWithoutWholeConstructs = cssWithoutWholeConstructs
    .replace(/@import\b[^;]*(?:;|$)/gi, () => {
      count += 1;
      return '';
    })
    .replace(CSS_IMAGE_SET_FUNCTION_PATTERN, () => {
      count += 1;
      return '';
    })
    .replace(/expression\s*\([^)]*\)/gi, () => {
      count += 1;
      return '';
    })
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, () => {
      count += 1;
      return '';
    });

  count += countBlockedCssUrls(cssWithoutWholeConstructs, 'strict');
  if (count === 0 && hasExternalUrlLiteral(cssWithoutWholeConstructs)) {
    count = 1;
  }

  return count;
}

function countStrictCssPolicyTriggers(cssText: string): number {
  const decodedForPolicy = decodeCssEscapes(cssText);
  const hasDecodedDangerousCss =
    decodedForPolicy !== cssText &&
    (/@import\b/i.test(decodedForPolicy) ||
      /expression\s*\(/i.test(decodedForPolicy) ||
      /-moz-binding\s*:/i.test(decodedForPolicy) ||
      /url\s*\(/i.test(decodedForPolicy) ||
      /(?:-webkit-)?image-set\s*\(/i.test(decodedForPolicy) ||
      hasExternalUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return Math.max(1, countStrictCssPolicyTriggersInPlainCss(decodedForPolicy));
  }

  return countStrictCssPolicyTriggersInPlainCss(cssText);
}

/** CSS 텍스트에 정책상 차단되는 외부 url() 참조가 몇 번 등장하는지 센다. */
function countBlockedCssUrls(cssText: string, policy: SvgInspectionPolicy): number {
  let count = 0;
  visitCssUrlValues(cssText, (urlValue) => {
    const blocked = policy === 'strict' ? isStrictExternalCssUrl(urlValue) : isLightweightExternalCssUrl(urlValue);
    if (blocked) {
      count += 1;
    }
  });
  return count;
}

/** style 속성과 style 태그의 외부 CSS URL 참조를 수집한다. */
export function collectSvgCssReferenceSignals(
  doc: Document,
  options: CollectSvgCssReferenceSignalsOptions = {}
): SvgCssReferenceSignals {
  const policy = options.policy ?? 'lightweight';
  const signals: SvgCssReferenceSignals = {
    externalCssCount: 0,
    externalCssSamples: [],
  };
  let styleAttributeBlockedCount = 0;
  let styleTagBlockedCount = 0;
  const styleAttributeSamples: string[] = [];

  const elements = doc.getElementsByTagName('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element) continue;

    for (const attrName of element.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      if (policy === 'lightweight' && lowered !== 'style') continue;
      if (policy === 'strict' && !shouldInspectStrictCssAttribute(attrName, element)) continue;
      const styleValue = element.getAttribute(attrName);
      if (styleValue === null || styleValue === '') continue;
      const blockedCount =
        policy === 'strict' ? countStrictCssPolicyTriggers(styleValue) : countBlockedCssUrls(styleValue, policy);
      if (blockedCount > 0) {
        styleAttributeBlockedCount += blockedCount;
        pushCappedSample(styleAttributeSamples, lowered);
      }
    }

    if (element.tagName.toLowerCase() === 'style') {
      const cssText = element.textContent ?? '';
      const blockedCount =
        policy === 'strict' ? countStrictCssPolicyTriggers(cssText) : countBlockedCssUrls(cssText, policy);
      if (blockedCount > 0) {
        styleTagBlockedCount += blockedCount;
      }
    }
  }

  signals.externalCssCount = styleAttributeBlockedCount + styleTagBlockedCount;
  // lightweight는 style 속성만 검사하므로 styleAttributeSamples에 'style' 토큰만 들어 있고,
  // strict는 presentation attr명까지 들어 있다. 양쪽 모두 이 루프가 그대로 옮긴다.
  for (const sample of styleAttributeSamples) {
    pushCappedSample(signals.externalCssSamples, sample);
  }
  if (styleTagBlockedCount > 0) {
    pushCappedSample(signals.externalCssSamples, 'style-tag');
  }

  return signals;
}
