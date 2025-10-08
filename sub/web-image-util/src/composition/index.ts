/**
 * Image composition and watermark module exports
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
