/**
 * SVG DOM 기반 분석 경계.
 *
 * DOMParser 파싱 성공 + svg 루트 경로에서만 호출한다. dimension 읽기,
 * complexity 래퍼, DOM 기반 보안 finding 수집을 캡슐화한다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

import { isBlockedSvgPolicyRef } from '../../core/source-converter/url/policy';
import type { ComplexityAnalysisResult } from '../../core/svg-complexity-analyzer';
import { analyzeSvgComplexity } from '../../core/svg-complexity-analyzer';
import type { InspectSvgDimensions, InspectSvgFinding } from '../inspect-svg';
import {
  collectSvgDomSecuritySignals,
  isReferenceAttribute,
  pushCappedSample,
  readReferenceAttribute,
} from '../svg-inspection';
import { getCssPolicyValueVariants, visitCssUrlValues } from '../svg-policy-utils';

const DIM_ATTR_REGEX = /^(\d+(?:\.\d+)?)\s*([a-z%]*)$/;
const COMPLEXITY_FALLBACK_SENTINEL = 'Using default values due to analysis failure';

function parseAttrValue(raw: string | null): { raw: string | null; numeric: number | null; unit: string | null } {
  if (raw === null) {
    return { raw: null, numeric: null, unit: null };
  }
  const match = DIM_ATTR_REGEX.exec(raw);
  if (match) {
    return { raw, numeric: parseFloat(match[1]), unit: match[2] };
  }
  return { raw, numeric: null, unit: raw };
}

/** svg 루트 요소에서 width/height/viewBox를 읽어 effective dimension을 도출한다. */
export function readInspectDimensions(svgElement: Element): InspectSvgDimensions {
  const widthRaw = svgElement.getAttribute('width');
  const heightRaw = svgElement.getAttribute('height');
  const viewBoxRaw = svgElement.getAttribute('viewBox');

  const widthAttr = parseAttrValue(widthRaw);
  const heightAttr = parseAttrValue(heightRaw);

  let viewBoxParsed: { x: number; y: number; width: number; height: number } | null = null;
  if (viewBoxRaw !== null) {
    const parts = viewBoxRaw.trim().split(/\s+/);
    if (parts.length === 4) {
      const nums = parts.map(Number);
      if (nums.every((n) => !Number.isNaN(n))) {
        viewBoxParsed = { x: nums[0], y: nums[1], width: nums[2], height: nums[3] };
      }
    }
  }

  const viewBox: InspectSvgDimensions['viewBox'] = { raw: viewBoxRaw, parsed: viewBoxParsed };

  let effective: InspectSvgDimensions['effective'];
  if (widthAttr.numeric !== null && widthAttr.numeric > 0 && heightAttr.numeric !== null && heightAttr.numeric > 0) {
    effective = { width: widthAttr.numeric, height: heightAttr.numeric, source: 'explicit' };
  } else if (viewBoxParsed !== null) {
    effective = { width: viewBoxParsed.width, height: viewBoxParsed.height, source: 'viewBox' };
  } else {
    effective = { width: 100, height: 100, source: 'fallback' };
  }

  return { widthAttr, heightAttr, viewBox, effective };
}

/**
 * complexity 분석을 호출하고 fallback sentinel을 감지한다.
 * fallback이면 complexity를 null로 두고 finding을 반환한다.
 */
export function callComplexityWrapper(svgString: string): [ComplexityAnalysisResult | null, InspectSvgFinding[]] {
  const result = analyzeSvgComplexity(svgString);
  if (result.reasoning[0] === COMPLEXITY_FALLBACK_SENTINEL) {
    return [
      null,
      [
        {
          code: 'complexity-analysis-failed',
          message: 'SVG complexity analysis returned fallback values; result is unavailable.',
        },
      ],
    ];
  }
  return [result, []];
}

/**
 * DOM 기반으로 보안 finding을 수집한다.
 * DOMParser 파싱 성공 + svg 루트 경로에서만 호출한다.
 *
 * script / foreignObject / event handler 신호는 공통 helper `collectSvgDomSecuritySignals`로
 * 위임한다. external-href와 CSS url() 참조 finding은 inspectSvg 고유 의미(embedded-image 단계
 * 부재로 data:/상대 경로도 보고)를 지켜야 하므로 본 함수가 직접 수집한다. 그 결과 helper가
 * element+attribute를 한 번 순회하고 본 함수가 다시 한 번 순회하지만(총 2회), 입력 크기가
 * `MAX_SVG_BYTES`로 제한되므로 helper 재사용으로 신호 의미를 지키는 쪽을 택한다.
 */
export function collectDomFindings(doc: Document): InspectSvgFinding[] {
  const findings: InspectSvgFinding[] = [];
  const signals = collectSvgDomSecuritySignals(doc);

  if (signals.scriptElementCount > 0) {
    findings.push({
      code: 'has-script-element',
      message: 'Input contains <script> element(s); strict sanitizer is recommended.',
      details: { count: signals.scriptElementCount },
    });
  }

  if (signals.foreignObjectElementCount > 0) {
    findings.push({
      code: 'has-foreign-object',
      message: 'Input contains <foreignObject> element(s); strict sanitizer is recommended.',
      details: { count: signals.foreignObjectElementCount },
    });
  }

  if (signals.eventHandlerAttributeCount > 0) {
    findings.push({
      code: 'has-event-handler',
      message: 'Input contains on* event handler attribute(s); strict sanitizer is recommended.',
      details: { count: signals.eventHandlerAttributeCount, samples: signals.eventHandlerAttributeSamples },
    });
  }

  // external href/src 참조와 style attribute url() 검사.
  // external-href와 CSS finding은 DOM 보안 신호 helper 범위 밖이다. helper의 lightweight 판정
  // (isExternalSvgReference)은 data:·내부 fragment에 더해 상대(./, ../)·절대(/path) 경로까지
  // 제외하지만, inspectSvg는 embedded-image 단계가 없으므로 isBlockedSvgPolicyRef 기준으로
  // data:·상대·절대 경로도 정책 차단 대상이면 그대로 보고한다(sanitizer의 external-href stage가
  // data:를 embedded-image로 위임하는 것과 의미가 다르다). 두 의미 축(data: 포함, 상대/절대
  // 경로 포함)이 달라 helper의 externalHrefCount를 재사용하지 않고 직접 수집한다.
  const allElements = doc.getElementsByTagName('*');
  let externalHrefCount = 0;
  const externalHrefSamples: string[] = [];
  let styleAttrExternalUrlCount = 0;
  let styleTagExternalUrlCount = 0;
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    if (!el) continue;

    // external href/src와 style attribute url()은 같은 element의 서로 다른 속성이므로
    // 두 검사를 한 attribute 순회에서 모두 수행한다. external-href는 element당 한 번만
    // 카운트하되(elementHrefCounted 플래그), 순회를 조기 종료(break)하지 않아야 뒤에 오는
    // style 속성 검사가 누락되지 않는다.
    let elementHrefCounted = false;
    for (const attrName of el.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      const localName = el.getAttributeNode(attrName)?.localName.toLowerCase() ?? lowered;

      // style attribute 내부 url() 검사
      if (lowered === 'style' || localName === 'style') {
        const styleAttr = el.getAttribute(attrName);
        if (styleAttr) {
          visitCssUrlValues(styleAttr, (urlValue) => {
            if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
              styleAttrExternalUrlCount++;
            }
          });
        }
      }

      // external href/xlink:href/src 검사 (element당 한 번만 카운트)
      if (!elementHrefCounted && isReferenceAttribute(el, attrName)) {
        const value = readReferenceAttribute(el, attrName);
        if (value !== null && getCssPolicyValueVariants(value).some(isBlockedSvgPolicyRef)) {
          externalHrefCount++;
          pushCappedSample(externalHrefSamples, lowered);
          elementHrefCounted = true;
        }
      }
    }

    // <style> 태그 내부 url() 검사
    if (el.tagName.toLowerCase() === 'style') {
      const cssText = el.textContent ?? '';
      visitCssUrlValues(cssText, (urlValue) => {
        if (getCssPolicyValueVariants(urlValue).some(isBlockedSvgPolicyRef)) {
          styleTagExternalUrlCount++;
        }
      });
    }
  }

  if (externalHrefCount > 0) {
    findings.push({
      code: 'external-href',
      message: 'Input contains element(s) with external href/src references; strict sanitizer is recommended.',
      details: { count: externalHrefCount, samples: externalHrefSamples },
    });
  }

  if (styleAttrExternalUrlCount > 0) {
    findings.push({
      code: 'style-attribute-external-url',
      message: 'Input contains style attribute(s) with external url() references; strict sanitizer is recommended.',
      details: { count: styleAttrExternalUrlCount },
    });
  }

  if (styleTagExternalUrlCount > 0) {
    findings.push({
      code: 'style-tag-external-url',
      message: 'Input contains <style> tag(s) with external url() references; strict sanitizer is recommended.',
      details: { count: styleTagExternalUrlCount },
    });
  }

  return findings;
}
