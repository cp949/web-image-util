/**
 * Color adjustment filter plugins
 * Collection of color adjustment filter plugins (brightness, contrast, saturation, hue)
 */

import { validateNumberInRange } from '../filter-param-validation.internal';
import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * Brightness adjustment filter plugin
 *
 * @description Filter plugin that adjusts image brightness.
 * Brightness can be controlled with values from -100 to +100 using linear adjustment.
 */
export const BrightnessFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'brightness',
  description: 'Adjusts image brightness',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },

  apply(imageData: ImageData, params: { value: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const adjustment = (params.value / 100) * 255;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, data[i] + adjustment)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)); // B
      // Alpha remains unchanged
    }

    return result;
  },

  validate(params: { value: number }): FilterValidationResult {
    return validateNumberInRange(params.value, 'value', {
      min: -100,
      max: 100,
      warnAboveAbs: 50,
      warnMessage: 'Extreme brightness adjustments may degrade image quality',
    });
  },
};

/**
 * Contrast adjustment filter plugin
 *
 * @description Filter plugin that adjusts image contrast.
 * Uses standard contrast adjustment formula to enhance or reduce light-dark differences.
 */
export const ContrastFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'contrast',
  description: 'Adjusts image contrast',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },

  apply(imageData: ImageData, params: { value: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const factor = (259 * (params.value + 255)) / (255 * (259 - params.value));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
    }

    return result;
  },

  validate(params: { value: number }): FilterValidationResult {
    return validateNumberInRange(params.value, 'value', {
      min: -100,
      max: 100,
      warnAboveAbs: 50,
      warnMessage: 'Extreme contrast adjustments may cause detail loss',
    });
  },
};

/**
 * Saturation adjustment filter plugin
 *
 * @description Filter plugin that adjusts image color saturation.
 * Controls color vibrancy using standard luminance formula and can be optimized with other color filters.
 */
export const SaturationFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'saturation',
  description: 'Adjusts image saturation',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },

  apply(imageData: ImageData, params: { value: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const factor = (params.value + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      // Calculate luminance (Y = 0.299*R + 0.587*G + 0.114*B)
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      data[i] = Math.max(0, Math.min(255, gray + factor * (data[i] - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + factor * (data[i + 1] - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + factor * (data[i + 2] - gray)));
    }

    return result;
  },

  validate(params: { value: number }): FilterValidationResult {
    return validateNumberInRange(params.value, 'value', {
      min: -100,
      max: 100,
      warnAbove: 50,
      warnMessage: 'High saturation may create unnatural colors',
    });
  },
};

/**
 * All color filter plugins
 *
 * @description Array containing basic color correction filters including brightness, contrast, and saturation adjustments.
 * Provides essential functions for photo correction and image effects.
 */
export const ColorFilterPlugins = [BrightnessFilterPlugin, ContrastFilterPlugin, SaturationFilterPlugin];
