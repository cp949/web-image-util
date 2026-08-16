/**
 * SVG 호환성 보강 서브모듈의 공개 표면을 한 곳으로 모은다.
 *
 * @description 외부 import 경로(`utils/svg-compatibility`)는 본 인덱스를 거쳐 동일한
 * 표면을 노출한다. 내부 헬퍼(치수 단서 수집, BBox 계산기 등)는 의도적으로 노출하지 않는다.
 * 예외: `enhanceSvgForBrowserWithDimensions`는 `loader.internal.ts` 전용 함수라 이 배럴에
 * 올리지 않고, 소비자가 `./enhance`에서 직접 import한다 — "고쳐서" 여기로 옮기지 않는다.
 */

export { enhanceBrowserCompatibility, enhanceSvgForBrowser } from './enhance';
export type { SvgCompatibilityOptions, SvgCompatibilityReport } from './options';
