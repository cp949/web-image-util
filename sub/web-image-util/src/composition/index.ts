/**
 * Image composition and watermark module exports
 */

export {
  type ComposeCollageSpec,
  type ComposeGridSpec,
  type ComposeLayer,
  type ComposeLayersSpec,
  type ComposeSpec,
  composeImages,
  type RandomSource,
} from './compose';
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
