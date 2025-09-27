/**
 * 이미지 필터 플러그인 시스템
 *
 * @description 확장 가능한 플러그인 시스템으로 구현된 이미지 필터 처리기
 *
 * @example
 * ```typescript
 * import { filterManager } from '@cp949/web-image-util/advanced';
 *
 * // 블러 필터 적용
 * const filtered = await filterManager.apply(image, 'blur', { radius: 5 });
 * ```
 */

// 새로운 플러그인 시스템 export
export * from './plugin-system';
export * from './plugins';
