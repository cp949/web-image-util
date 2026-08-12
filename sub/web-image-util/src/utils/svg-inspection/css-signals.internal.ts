import { decodeCssEscapes, visitCssUrlValues } from '../svg-policy-utils.internal';
import {
  CSS_URL_PRESENTATION_ATTRIBUTES,
  createCssImageSetFunctionPattern,
  hasExternalCssUrlLiteral,
  isAllowedCssUrl,
} from '../svg-threat-policy.internal';
import { pushCappedSample } from './sample-utils.internal';

export interface SvgCssReferenceSignals {
  externalCssCount: number;
  externalCssSamples: string[];
}

/**
 * CSS 정책 대상 속성인지 판정한다 — style 또는 presentation 속성 목록.
 *
 * 위협 정책의 CSS 판정이 모드 무관으로 통일된 뒤로 두 sanitizer가 같은
 * 속성 집합을 정제하므로 진단도 같은 집합을 검사한다.
 */
function shouldInspectCssAttribute(attrName: string, element: Element): boolean {
  const lowered = attrName.toLowerCase();
  const localName = element.getAttributeNode(attrName)?.localName.toLowerCase() ?? lowered;
  return (
    lowered === 'style' ||
    CSS_URL_PRESENTATION_ATTRIBUTES.has(lowered) ||
    CSS_URL_PRESENTATION_ATTRIBUTES.has(localName)
  );
}

function countCssPolicyTriggersInPlainCss(cssText: string): number {
  let count = 0;
  let cssWithoutWholeConstructs = cssText;

  cssWithoutWholeConstructs = cssWithoutWholeConstructs
    .replace(/@import\b[^;]*(?:;|$)/gi, () => {
      count += 1;
      return '';
    })
    .replace(createCssImageSetFunctionPattern(), () => {
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

  count += countBlockedCssUrls(cssWithoutWholeConstructs);
  if (count === 0 && hasExternalCssUrlLiteral(cssWithoutWholeConstructs)) {
    count = 1;
  }

  return count;
}

function countCssPolicyTriggers(cssText: string): number {
  const decodedForPolicy = decodeCssEscapes(cssText);
  const hasDecodedDangerousCss =
    decodedForPolicy !== cssText &&
    (/@import\b/i.test(decodedForPolicy) ||
      /expression\s*\(/i.test(decodedForPolicy) ||
      /-moz-binding\s*:/i.test(decodedForPolicy) ||
      /url\s*\(/i.test(decodedForPolicy) ||
      /(?:-webkit-)?image-set\s*\(/i.test(decodedForPolicy) ||
      hasExternalCssUrlLiteral(decodedForPolicy));

  if (hasDecodedDangerousCss) {
    return Math.max(1, countCssPolicyTriggersInPlainCss(decodedForPolicy));
  }

  return countCssPolicyTriggersInPlainCss(cssText);
}

/** CSS 텍스트에 정책상 차단되는 url() 참조가 몇 번 등장하는지 센다. */
function countBlockedCssUrls(cssText: string): number {
  let count = 0;
  visitCssUrlValues(cssText, (urlValue) => {
    if (!isAllowedCssUrl(urlValue)) {
      count += 1;
    }
  });
  return count;
}

/** style·presentation 속성과 style 태그의 위험 CSS 참조를 수집한다. */
export function collectSvgCssReferenceSignals(doc: Document): SvgCssReferenceSignals {
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
      if (!shouldInspectCssAttribute(attrName, element)) continue;
      const styleValue = element.getAttribute(attrName);
      if (styleValue === null || styleValue === '') continue;
      const blockedCount = countCssPolicyTriggers(styleValue);
      if (blockedCount > 0) {
        styleAttributeBlockedCount += blockedCount;
        pushCappedSample(styleAttributeSamples, lowered);
      }
    }

    if (element.tagName.toLowerCase() === 'style') {
      const cssText = element.textContent ?? '';
      const blockedCount = countCssPolicyTriggers(cssText);
      if (blockedCount > 0) {
        styleTagBlockedCount += blockedCount;
      }
    }
  }

  signals.externalCssCount = styleAttributeBlockedCount + styleTagBlockedCount;
  for (const sample of styleAttributeSamples) {
    pushCappedSample(signals.externalCssSamples, sample);
  }
  if (styleTagBlockedCount > 0) {
    pushCappedSample(signals.externalCssSamples, 'style-tag');
  }

  return signals;
}
