/**
 * SVG 문자열 fallback 분석 경계.
 *
 * DOMParser 미가용 또는 파싱 실패 경로에서만 호출한다. DOM을 사용할 수 없으므로
 * 정규식으로 script/foreignObject/event-handler 신호를 수집한다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

import type { InspectSvgFinding } from './types.internal';

/**
 * 정규식으로 script/foreignObject/event-handler finding을 수집한다.
 * DOMParser 미가용 또는 파싱 실패 경로에서만 호출한다.
 */
export function collectRegexFindings(svgString: string): InspectSvgFinding[] {
  const findings: InspectSvgFinding[] = [];

  // script 요소 카운트
  const scriptCount = (svgString.match(/<script\b[^>]*>/gi) ?? []).length;
  if (scriptCount > 0) {
    findings.push({
      code: 'has-script-element',
      message: 'Input contains <script> element(s); strict sanitizer is recommended.',
      details: { count: scriptCount },
    });
  }

  // foreignObject 요소 카운트
  const foreignObjectCount = (svgString.match(/<foreignObject\b[^>]*>/gi) ?? []).length;
  if (foreignObjectCount > 0) {
    findings.push({
      code: 'has-foreign-object',
      message: 'Input contains <foreignObject> element(s); strict sanitizer is recommended.',
      details: { count: foreignObjectCount },
    });
  }

  // 시작 태그를 순회하며 event handler attribute 카운트
  let eventHandlerCount = 0;
  for (const tagMatch of svgString.matchAll(/<[a-zA-Z][^>]*>/g)) {
    // 태그명 이후 attribute 영역 추출
    const attrArea = tagMatch[0].replace(/^<[a-zA-Z][a-zA-Z0-9_:-]*/, '');
    eventHandlerCount += (attrArea.match(/\son[a-z0-9:-]*\s*=/gi) ?? []).length;
  }
  if (eventHandlerCount > 0) {
    findings.push({
      code: 'has-event-handler',
      message: 'Input contains on* event handler attribute(s); strict sanitizer is recommended.',
      details: { count: eventHandlerCount },
    });
  }

  return findings;
}
