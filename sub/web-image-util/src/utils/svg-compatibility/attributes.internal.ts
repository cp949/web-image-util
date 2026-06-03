/**
 * 루트 SVG 요소에 누락된 속성/네임스페이스를 보강하는 함수들이다.
 */

import type { SvgCompatibilityReport } from './options';

const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

/**
 * 누락된 SVG 네임스페이스를 보강한다.
 *
 * @description 기존 선언이 있으면 덮어쓰지 않고, xlink:href를 사용하는 경우에만
 * xmlns:xlink를 추가한다. 추가된 네임스페이스는 리포트에 기록된다.
 *
 * @param root 검사 대상 SVG 루트 요소
 * @param report 보강 결과를 기록할 리포트
 */
export function addRequiredNamespaces(root: Element, report: SvgCompatibilityReport) {
  const added: string[] = [];
  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    added.push('svg');
  }
  const usesXlink = !!(root.querySelector('[xlink\\:href]') || root.querySelector('[*|href]:not([href])'));
  if (usesXlink && !root.getAttribute('xmlns:xlink')) {
    root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    added.push('xlink');
  }
  report.addedNamespaces = added;
}

/**
 * SVG 레거시 참조 문법(xlink:href)을 현대 브라우저용 href로 정규화한다.
 *
 * @description href가 없으면 xlink 값으로 새로 채우고, 항상 xlink:href는 제거한다.
 * 변환된 노드 개수는 리포트에 기록된다.
 *
 * @param root 검사 대상 SVG 루트 요소
 * @param report 변환 결과를 기록할 리포트
 */
export function modernizeSvgSyntax(root: Element, report: SvgCompatibilityReport) {
  let count = 0;

  for (const el of Array.from(root.getElementsByTagName('*'))) {
    const xlink = el.getAttribute('xlink:href') ?? el.getAttributeNS(XLINK_NAMESPACE, 'href');
    if (xlink === null) continue;

    if (!el.hasAttribute('href')) {
      el.setAttribute('href', xlink);
    }

    el.removeAttribute('xlink:href');
    el.removeAttributeNS(XLINK_NAMESPACE, 'href');
    count++;
  }

  report.modernizedSyntax = count;
}

/**
 * 누락된 preserveAspectRatio 속성에 기본값(`xMidYMid meet`)을 채운다.
 *
 * @param root 검사 대상 SVG 루트 요소
 */
export function addPAR(root: Element) {
  if (!root.getAttribute('preserveAspectRatio')) {
    root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
}
