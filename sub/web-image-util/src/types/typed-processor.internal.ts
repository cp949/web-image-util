/**
 * Processor factory type
 *
 * @description
 * ./processor-interface (IImageProcessor)에서 팩토리 별칭만 파생한다.
 * (`imageShortcut()`은 `processor.ts`의 `processImage`를 직접 값으로 import하므로
 * 이 타입과는 무관하다 — 순환 참조 회피 목적은 아니다.)
 */

import type { ImageSource } from '../types';
import type { IImageProcessor } from './processor-interface';

/**
 * Processor factory function type
 */
export type ProcessorFactory = (source: ImageSource) => IImageProcessor;
