/**
 * Image filter plugin system
 *
 * @description Image filter processor implemented with extensible plugin system
 *
 * @example
 * ```typescript
 * import { filterManager } from '@cp949/web-image-util/advanced';
 *
 * // Apply blur filter
 * const filtered = await filterManager.apply(image, 'blur', { radius: 5 });
 * ```
 */

// New plugin system exports
export * from './plugin-system';
export * from './plugins';
