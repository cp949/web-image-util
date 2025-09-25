/**
 * 이미지 필터 플러그인 시스템
 *
 * @description v2.0에서는 확장 가능한 플러그인 시스템으로 재설계됨
 * 레거시 필터 시스템은 제거되고 새로운 플러그인 기반 아키텍처 사용
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
