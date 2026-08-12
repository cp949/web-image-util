/**
 * Shortcut API type definitions (호환용 별칭 모음)
 *
 * @description shortcut의 원본 크기 의존 연산이 공개 resize() 설정
 * (ScaleConfig, 단일 축 FillConfig)으로 합류하면서 이 파일의 타입들은
 * 실제 처리 경로에서 더 이상 사용되지 않는다. 공개 export 호환을 위해 유지한다.
 */

import type { ScaleValue } from './resize-config';

/**
 * Scale operation type
 *
 * @deprecated `ScaleValue`를 사용하세요. 동일한 union의 별칭이다.
 */
export type ScaleOperation = ScaleValue;

/**
 * Lazy operation type that requires source size
 *
 * @deprecated 내부 사설 통로가 제거되어 처리 경로에서 사용되지 않는다.
 * scale은 `{ fit: 'scale', scale }`, toWidth/toHeight는
 * `{ fit: 'fill', width }` / `{ fit: 'fill', height }` 설정으로 대체됐다.
 */
export type ResizeOperation =
  | { type: 'scale'; value: ScaleOperation }
  | { type: 'toWidth'; width: number }
  | { type: 'toHeight'; height: number };

/**
 * Direct mapping operation type that can be converted immediately
 *
 * @deprecated 처리 경로에서 사용되지 않는다. shortcut 메서드는
 * ResizeConfig를 직접 구성해 공개 resize()를 호출한다.
 *
 * @example
 * ```typescript
 * // cover fit (fill entire area, may crop)
 * const op1: DirectResizeConfig = {
 *   type: 'coverBox',
 *   width: 300,
 *   height: 200
 * };
 *
 * // contain fit (show entire image, may have padding)
 * const op2: DirectResizeConfig = {
 *   type: 'containBox',
 *   width: 300,
 *   height: 200,
 *   options: { background: '#ffffff' }
 * };
 *
 * // exact size fit (ignore ratio)
 * const op3: DirectResizeConfig = {
 *   type: 'exactSize',
 *   width: 300,
 *   height: 200
 * };
 *
 * // maximum width limit (shrink only, no enlargement)
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
 * Type guard: Check if ScaleOperation is a simple number
 */
export function isUniformScale(scale: ScaleOperation): scale is number {
  return typeof scale === 'number';
}

/**
 * Type guard: Check if ScaleOperation is X-axis scale
 *
 * @description Type predicate function for TypeScript type narrowing.
 * Precisely determines when object has only sx but not sy.
 */
export function isScaleX(scale: ScaleOperation): scale is { sx: number } {
  return (
    typeof scale === 'object' && scale !== null && 'sx' in scale && !('sy' in scale) && typeof scale.sx === 'number'
  );
}

/**
 * Type guard: Check if ScaleOperation is Y-axis scale
 *
 * @description Type predicate function for TypeScript type narrowing.
 * Precisely determines when object has only sy but not sx.
 */
export function isScaleY(scale: ScaleOperation): scale is { sy: number } {
  return (
    typeof scale === 'object' && scale !== null && 'sy' in scale && !('sx' in scale) && typeof scale.sy === 'number'
  );
}

/**
 * Type guard: Check if ScaleOperation is individual X/Y axis scale
 *
 * @description Type predicate function for TypeScript type narrowing.
 * Precisely determines when object has both sx and sy.
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
