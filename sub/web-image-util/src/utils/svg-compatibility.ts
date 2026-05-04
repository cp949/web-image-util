/**
 * SVG 브라우저 호환성 보강 유틸 모음.
 *
 * 실제 구현은 `utils/svg-compatibility/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type { SvgCompatibilityOptions, SvgCompatibilityReport } from './svg-compatibility/index';
export { enhanceBrowserCompatibility, enhanceSvgForBrowser } from './svg-compatibility/index';
