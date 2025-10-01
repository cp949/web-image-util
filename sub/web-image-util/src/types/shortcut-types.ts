/**
 * Shortcut API 타입 정의
 *
 * @description Sharp.js 스타일의 편의 메서드를 위한 타입 시스템.
 * ScaleOperation과 ResizeOperation을 통해 lazy 연산을 지원합니다.
 */

/**
 * 스케일 연산 타입
 *
 * @description 배율 기반 리사이징을 위한 유니온 타입입니다.
 * 소스 크기가 필요하므로 lazy 연산으로 처리됩니다.
 *
 * @example
 * ```typescript
 * // 균등 배율
 * const scale1: ScaleOperation = 2;
 *
 * // X축만 배율
 * const scale2: ScaleOperation = { sx: 2 };
 *
 * // Y축만 배율
 * const scale3: ScaleOperation = { sy: 1.5 };
 *
 * // X/Y 축 개별 배율
 * const scale4: ScaleOperation = { sx: 2, sy: 1.5 };
 * ```
 */
export type ScaleOperation = number | { sx: number } | { sy: number } | { sx: number; sy: number };

/**
 * 소스 크기가 필요한 Lazy 연산 타입
 *
 * @description 소스 이미지 크기를 알아야만 최종 ResizeConfig로 변환 가능한 연산들입니다.
 * LazyRenderPipeline에서 소스 로드 후 ResizeConfig로 변환됩니다.
 *
 * @example
 * ```typescript
 * // 배율 기반 리사이징
 * const op1: ResizeOperation = { type: 'scale', value: 2 };
 *
 * // 너비 맞춤 (높이는 비율 유지)
 * const op2: ResizeOperation = { type: 'toWidth', width: 800 };
 *
 * // 높이 맞춤 (너비는 비율 유지)
 * const op3: ResizeOperation = { type: 'toHeight', height: 600 };
 * ```
 */
export type ResizeOperation =
  | { type: 'scale'; value: ScaleOperation }
  | { type: 'toWidth'; width: number }
  | { type: 'toHeight'; height: number };

/**
 * 즉시 변환 가능한 직접 매핑 연산 타입
 *
 * @description 소스 크기 없이도 바로 ResizeConfig로 변환 가능한 연산들입니다.
 * Discriminated Union 패턴을 사용하여 타입 안전성을 보장합니다.
 *
 * @example
 * ```typescript
 * // cover fit (전체 영역 채우기, 잘림 가능)
 * const op1: DirectResizeConfig = {
 *   type: 'coverBox',
 *   width: 300,
 *   height: 200
 * };
 *
 * // contain fit (전체 이미지 보이기, 여백 가능)
 * const op2: DirectResizeConfig = {
 *   type: 'containBox',
 *   width: 300,
 *   height: 200,
 *   options: { background: '#ffffff' }
 * };
 *
 * // 정확한 크기 맞춤 (비율 무시)
 * const op3: DirectResizeConfig = {
 *   type: 'exactSize',
 *   width: 300,
 *   height: 200
 * };
 *
 * // 최대 너비 제한 (축소만, 확대 안함)
 * const op4: DirectResizeConfig = {
 *   type: 'maxWidth',
 *   width: 800
 * };
 * ```
 */
export type DirectResizeConfig =
  | { type: 'coverBox'; width: number; height: number; options?: any }
  | { type: 'containBox'; width: number; height: number; options?: any }
  | { type: 'exactSize'; width: number; height: number }
  | { type: 'maxWidth'; width: number }
  | { type: 'maxHeight'; height: number }
  | { type: 'maxSize'; width: number; height: number }
  | { type: 'minWidth'; width: number }
  | { type: 'minHeight'; height: number }
  | { type: 'minSize'; width: number; height: number };

/**
 * 타입 가드: ScaleOperation이 단순 숫자인지 확인
 */
export function isUniformScale(scale: ScaleOperation): scale is number {
  return typeof scale === 'number';
}

/**
 * 타입 가드: ScaleOperation이 X축 배율인지 확인
 *
 * @description TypeScript의 타입 narrowing을 위한 type predicate 함수.
 * 객체이면서 sx만 있고 sy는 없는 경우를 정확히 판별합니다.
 */
export function isScaleX(scale: ScaleOperation): scale is { sx: number } {
  return (
    typeof scale === 'object' && scale !== null && 'sx' in scale && !('sy' in scale) && typeof scale.sx === 'number'
  );
}

/**
 * 타입 가드: ScaleOperation이 Y축 배율인지 확인
 *
 * @description TypeScript의 타입 narrowing을 위한 type predicate 함수.
 * 객체이면서 sy만 있고 sx는 없는 경우를 정확히 판별합니다.
 */
export function isScaleY(scale: ScaleOperation): scale is { sy: number } {
  return (
    typeof scale === 'object' && scale !== null && 'sy' in scale && !('sx' in scale) && typeof scale.sy === 'number'
  );
}

/**
 * 타입 가드: ScaleOperation이 X/Y축 개별 배율인지 확인
 *
 * @description TypeScript의 타입 narrowing을 위한 type predicate 함수.
 * 객체이면서 sx와 sy가 모두 있는 경우를 정확히 판별합니다.
 */
export function isScaleXY(scale: ScaleOperation): scale is { sx: number; sy: number } {
  return (
    typeof scale === 'object' &&
    scale !== null &&
    'sx' in scale &&
    'sy' in scale &&
    typeof scale.sx === 'number' &&
    typeof scale.sy === 'number'
  );
}
