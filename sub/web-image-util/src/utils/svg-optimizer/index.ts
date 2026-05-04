/**
 * SVG 최적화 서브모듈의 공개 진입점.
 *
 * 책임은 다음 모듈로 분리되어 있다.
 * - {@link ./types}              공개 타입 정의
 * - {@link ./remove-metadata}    XML 주석/편집기 잔여물/렌더 무관 속성 제거
 * - {@link ./simplify-paths}     path 데이터 정밀도·공백 정리
 * - {@link ./optimize-gradients} 중복 그라디언트 병합
 * - {@link ./remove-unused-defs} 미사용 `<defs>` 정의 제거
 * - {@link ./cleanup-whitespace} 마크업 공백 축약
 * - {@link ./optimizer}          단계 모듈을 결합하는 `SvgOptimizer` 오케스트레이터
 *
 * 외부에서는 이 배럴만 import해서 사용한다.
 */

export { SvgOptimizer } from './optimizer';
export type { OptimizationResult, SvgOptimizationOptions } from './types';
