/**
 * SVG 벡터 최적화 알고리즘 진입점.
 *
 * 실제 구현은 `utils/svg-optimizer/` 서브모듈로 분리되어 있으며,
 * 본 파일은 외부 import 호환을 위한 배럴 역할만 한다.
 */

export type { OptimizationResult, SvgOptimizationOptions } from './svg-optimizer/index';
export { SvgOptimizer } from './svg-optimizer/index';
