/**
 * 이미지 합성 및 워터마크 모듈 통합 export
 */

export { ImageComposer, type CompositionOptions, type GridLayoutOptions, type Layer } from './image-composer';
export { ImageWatermark, type ImageWatermarkOptions } from './image-watermark';
export { type Position, type Size } from './position-types';
export {
  SimpleWatermark,
  type PresetTextStyle,
  type SimpleImageWatermarkOptions,
  type SimplePosition,
  type SimpleTextWatermarkOptions,
} from './simple-watermark';
export { TextWatermark, type TextWatermarkOptions } from './text-watermark';
