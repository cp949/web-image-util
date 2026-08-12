/**
 * DOMPurify 정제 전에 입력 SVG에서 위험/잡음 구문을 정규식으로 절단하는 전처리.
 *
 * `<metadata>` 요소는 중첩 케이스에서 정규식의 비탐욕 매칭이 깨지므로 여기서는
 * 다루지 않고 후처리(`postProcessSanitized`)에서 DOM 기반으로 제거한다.
 */

import { stripDoctypeAndEntityDeclarations } from '../utils/svg-threat-policy.internal';

/**
 * 입력 SVG 문자열에서 DOCTYPE/ENTITY 선언, BOM, XML 선언, HTML 주석을 제거한다.
 *
 * `<metadata>` 요소는 정규식으로는 안전하게 제거할 수 없으므로(중첩 케이스에서
 * 비탐욕 매칭이 깨지는 문제) 여기서는 다루지 않고 후처리(postProcessSanitized)에서
 * DOM 기반으로 제거한다.
 *
 * DOCTYPE 제거는 quoted `]>` 같은 까다로운 케이스에서도 잔여물이 남지 않도록
 * "DOCTYPE 시작부터 다음 SVG 루트 시작 또는 문서 끝까지"를 한 번에 절단한다.
 *
 * @param svg 원본 SVG 문자열
 * @param warnings 경고 누적 배열 — DOCTYPE/ENTITY 발견 시 메시지가 추가된다
 * @returns 전처리가 적용된 SVG 문자열
 */
export function preprocessSvgInput(svg: string, warnings: string[]): string {
  let result = svg;

  // BOM 제거
  if (result.charCodeAt(0) === 0xfeff) {
    result = result.slice(1);
  }

  // DOCTYPE / ENTITY 선언 절단 (XXE 우려) — 위협 정책 모듈이 소유하는 공유 절단
  const stripped = stripDoctypeAndEntityDeclarations(result);
  if (stripped.doctypeRemoved) {
    warnings.push('XXE 우려로 DOCTYPE 선언이 제거되었습니다.');
  }
  if (stripped.entityRemoved) {
    warnings.push('XXE 우려로 ENTITY 선언이 제거되었습니다.');
  }
  result = stripped.svg;

  // XML 선언 제거 (<?xml ... ?>)
  result = result.replace(/<\?xml\b[\s\S]*?\?>/gi, '');

  // HTML 주석 제거 (<!-- ... -->)
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  return result;
}
