/**
 * Shortcut API type definitions
 *
 * @description Type system for Sharp.js style convenience methods.
 * Supports lazy operations through ScaleOperation and ResizeOperation.
 */

/**
 * Scale operation type
 *
 * @description Union type for ratio-based resizing.
 * Processed as lazy operation since source size is required.
 *
 * @example
 * ```typescript
 * // Uniform scale
 * const scale1: ScaleOperation = 2;
 *
 * // X-axis only scale
 * const scale2: ScaleOperation = { sx: 2 };
 *
 * // Y-axis only scale
 * const scale3: ScaleOperation = { sy: 1.5 };
 *
 * // Individual X/Y axis scale
 * const scale4: ScaleOperation = { sx: 2, sy: 1.5 };
 * ```
 */
export type ScaleOperation = number | { sx: number } | { sy: number } | { sx: number; sy: number };

/**
 * Lazy operation type that requires source size
 *
 * @description Operations that can only be converted to final ResizeConfig after knowing source image size.
 * Converted to ResizeConfig in LazyRenderPipeline after source loading.
 *
 * @example
 * ```typescript
 * // Scale-based resizing
 * const op1: ResizeOperation = { type: 'scale', value: 2 };
 *
 * // Width fitting (height maintains ratio)
 * const op2: ResizeOperation = { type: 'toWidth', width: 800 };
 *
 * // Height fitting (width maintains ratio)
 * const op3: ResizeOperation = { type: 'toHeight', height: 600 };
 * ```
 */
export type ResizeOperation =
  | { type: 'scale'; value: ScaleOperation }
  | { type: 'toWidth'; width: number }
  | { type: 'toHeight'; height: number };

/**
 * Direct mapping operation type that can be converted immediately
 *
 * @description Operations that can be directly converted to ResizeConfig without source size.
 * Uses Discriminated Union pattern to ensure type safety.
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
