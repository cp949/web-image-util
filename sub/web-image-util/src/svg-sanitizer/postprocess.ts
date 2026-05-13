/**
 * DOMPurify 정제 직후의 SVG 문자열을 한 번 더 파싱해 strict 정책을 강제하고
 * `<metadata>` 제거, parsererror 처리, 노드 카운트를 일괄 수행한다.
 */

import { enforceStrictDomPolicy } from './enforce-dom-policy';
import type { NestedSanitize, StrictSvgSanitizerOptions } from './types';
import { pushUniqueWarning } from './warnings';

/**
 * 정제된 SVG 문자열을 DOMParser로 한 번 파싱해 후처리를 일괄 수행한다.
 *
 * 다음 작업을 한 번의 파싱으로 처리한다:
 *   1. 파서 에러(parsererror)면 빈 결과로 간주 (svg='', nodeCount=0)
 *   2. removeMetadata=true 이면 모든 `<metadata>` 요소를 DOM 트리에서 제거 (중첩 포함)
 *   3. 루트의 모든 자손 Element 개수를 카운트
 *   4. metadata가 실제로 제거된 경우에만 XMLSerializer로 다시 직렬화한 결과를 반환,
 *      그렇지 않으면 원본 sanitized 문자열을 그대로 반환
 *
 * @param sanitizedSvg DOMPurify 정제 후 SVG 문자열
 * @param removeMetadata `<metadata>` 요소 제거 여부
 * @param warnings 경고 누적 배열
 * @param options 부모 sanitizer 옵션 (nested 호출에 그대로 전파)
 * @param depth 현재 재귀 깊이
 * @param nestedSanitize core가 주입하는 재귀 정제 함수
 * @returns 후처리된 SVG 문자열과 자손 Element 개수
 */
export function postProcessSanitized(
  sanitizedSvg: string,
  removeMetadata: boolean,
  warnings: string[],
  options: StrictSvgSanitizerOptions | undefined,
  depth: number,
  nestedSanitize: NestedSanitize
): { svg: string; nodeCount: number } {
  // 빈 결과인 경우 즉시 반환
  if (!sanitizedSvg.trim()) {
    return { svg: '', nodeCount: 0 };
  }

  const parser = new DOMParser();
  // image/svg+xml 으로 파싱하면 루트가 SVG 요소가 된다
  const doc = parser.parseFromString(sanitizedSvg, 'image/svg+xml');
  const root = doc.documentElement;

  // 루트가 없는 경우 0으로 간주
  if (!root) {
    return { svg: '', nodeCount: 0 };
  }

  // 파서 에러 처리 — DOM 구현체별 표현 형태가 다르므로 두 조건을 OR로 둔다.
  if (root.tagName === 'parsererror' || root.querySelector('parsererror')) {
    return { svg: '', nodeCount: 0 };
  }

  // strict sanitizer의 반환 계약은 SVG 루트 문자열이다. WHOLE_DOCUMENT 같은
  // 설정 변화나 파서 보정으로 루트가 SVG가 아니면 fail-closed 처리한다.
  if (root.localName.toLowerCase() !== 'svg') {
    return { svg: '', nodeCount: 0 };
  }

  // DOMPurify 결과에 strict sanitizer 강제 정책을 재적용한다.
  enforceStrictDomPolicy(root, warnings, options, depth, nestedSanitize);

  // metadata 제거 — 중첩 케이스도 DOM 트리 순회로 안전하게 처리
  if (removeMetadata) {
    const metadataNodes = root.querySelectorAll('metadata');
    if (metadataNodes.length > 0) {
      for (const node of Array.from(metadataNodes)) {
        node.parentNode?.removeChild(node);
      }
      pushUniqueWarning(warnings, '<metadata> 요소가 제거되었습니다.');
    }
  }

  // 자손 Element 카운트 (루트 자체는 제외)
  const nodeCount = root.querySelectorAll('*').length;

  // 강제 후처리 결과를 반영하기 위해 항상 다시 직렬화한다.
  const svg = new XMLSerializer().serializeToString(root);

  return { svg, nodeCount };
}
