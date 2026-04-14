/**
 * Image composition and watermark module exports
 */

export { type CompositionOptions, type GridLayoutOptions, ImageComposer, type Layer } from './image-composer';
export { ImageWatermark, type ImageWatermarkOptions } from './image-watermark';
export type { Position, Size } from './position-types';
export {
  type PresetTextStyle,
  type SimpleImageWatermarkOptions,
  type SimplePosition,
  type SimpleTextWatermarkOptions,
  SimpleWatermark,
} from './simple-watermark';
export { TextWatermark, type TextWatermarkOptions } from './text-watermark';
