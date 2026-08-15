/**
 * svg-sanitizer(inspect-sanitization) 전용 export 창구.
 *
 * svg-inspection 모듈의 배럴이 아니다 — inspectSvg 경로는 각 internal 파일을
 * 직접 import한다. 여기에는 sanitizer 쪽이 소비하는 심볼만 노출한다.
 */

export { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';
export { collectSvgCssReferenceSignals, type SvgCssReferenceSignals } from './css-signals.internal';
export { collectSvgDomSecuritySignals, type SvgDomSecuritySignals } from './dom-signals.internal';
export { pushCappedSample } from './sample-utils.internal';
