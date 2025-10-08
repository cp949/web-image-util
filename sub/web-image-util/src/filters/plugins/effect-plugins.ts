/**
 * Special effect filter plugins
 * Collection of image effect filter plugins (grayscale, sepia, invert)
 */

import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * Grayscale conversion plugin
 *
 * @description Filter plugin that converts images to black and white.
 * Performs natural grayscale conversion using standard luminance formula (Y = 0.299*R + 0.587*G + 0.114*B).
 */
export const GrayscaleFilterPlugin: FilterPlugin<Record<string, never>> = {
  name: 'grayscale',
  description: 'Converts images to black and white',
  category: FilterCategory.EFFECT,
  defaultParams: {},

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale conversion using luminance formula
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    return result;
  },

  validate(): FilterValidationResult {
    // Always valid since no parameters
    return { valid: true };
  },

  preview(imageData: ImageData): ImageData {
    // Preview is same as full application
    return this.apply(imageData, {});
  },
};

/**
 * Sepia effect plugin
 *
 * @description Filter plugin that applies vintage sepia tone effects.
 * Intensity can be adjusted and uses standard sepia transformation matrix.
 */
export const SepiaFilterPlugin: FilterPlugin<{ intensity: number }> = {
  name: 'sepia',
  description: 'Applies vintage sepia effects',
  category: FilterCategory.EFFECT,
  defaultParams: { intensity: 100 },

  apply(imageData: ImageData, params: { intensity: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const factor = params.intensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Apply sepia transformation matrix
      const newR = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      const newG = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      const newB = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);

      // Blend original and sepia effect
      data[i] = r + factor * (newR - r);
      data[i + 1] = g + factor * (newG - g);
      data[i + 2] = b + factor * (newB - b);
    }

    return result;
  },

  validate(params: { intensity: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.intensity !== 'number') {
      errors.push('intensity must be a number');
    } else if (params.intensity < 0 || params.intensity > 100) {
      errors.push('intensity must be between 0 and 100');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * Color invert plugin
 *
 * @description Filter plugin that inverts all pixel colors in an image.
 * Applies the result of subtracting current value from 255 for each RGB channel.
 */
export const InvertFilterPlugin: FilterPlugin<Record<string, never>> = {
  name: 'invert',
  description: 'Inverts image colors',
  category: FilterCategory.EFFECT,
  defaultParams: {},

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
      // Alpha remains unchanged
    }

    return result;
  },

  validate(): FilterValidationResult {
    return { valid: true };
  },
};

/**
 * Noise addition plugin
 *
 * @description Filter plugin that adds random noise to images.
 * Intensity can be adjusted and adds or subtracts random values to each pixel.
 */
export const NoiseFilterPlugin: FilterPlugin<{ intensity: number }> = {
  name: 'noise',
  description: 'Adds noise to images',
  category: FilterCategory.EFFECT,
  defaultParams: { intensity: 10 },

  apply(imageData: ImageData, params: { intensity: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const amount = (params.intensity / 100) * 255;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;

      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }

    return result;
  },

  validate(params: { intensity: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.intensity !== 'number') {
      errors.push('intensity must be a number');
    } else if (params.intensity < 0 || params.intensity > 100) {
      errors.push('intensity must be between 0 and 100');
    } else if (params.intensity > 50) {
      warnings.push('High noise intensity can significantly degrade image quality');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Vignette effect plugin
 *
 * @description Filter plugin that applies vignette effect with darkened edges.
 * Darkens based on distance from center and allows adjustment of intensity, size, and blur.
 */
export const VignetteFilterPlugin: FilterPlugin<{ intensity: number; size: number; blur: number }> = {
  name: 'vignette',
  description: 'Applies vignette effect with darkened edges',
  category: FilterCategory.EFFECT,
  defaultParams: { intensity: 0.8, size: 0.5, blur: 0.5 },

  apply(imageData: ImageData, params: { intensity: number; size: number; blur: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const { width, height, data } = result;

    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate vignette factor
        let vignetteFactor = 1 - (distance / maxDistance) * params.size;
        vignetteFactor = Math.pow(vignetteFactor, params.blur);
        vignetteFactor = Math.max(0, Math.min(1, vignetteFactor));

        const darkening = 1 - (1 - vignetteFactor) * params.intensity;

        data[idx] *= darkening;
        data[idx + 1] *= darkening;
        data[idx + 2] *= darkening;
      }
    }

    return result;
  },

  validate(params: { intensity: number; size: number; blur: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.intensity !== 'number' || params.intensity < 0 || params.intensity > 1) {
      errors.push('intensity must be a number between 0 and 1');
    }

    if (typeof params.size !== 'number' || params.size < 0 || params.size > 1) {
      errors.push('size must be a number between 0 and 1');
    }

    if (typeof params.blur !== 'number' || params.blur < 0 || params.blur > 1) {
      errors.push('blur must be a number between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * Pixelate effect plugin
 *
 * @description Filter plugin that converts images to pixel art style.
 * Divides image into blocks of specified size and applies average color to each block.
 */
export const PixelateFilterPlugin: FilterPlugin<{ pixelSize: number }> = {
  name: 'pixelate',
  description: 'Pixelates images',
  category: FilterCategory.DISTORTION,
  defaultParams: { pixelSize: 8 },

  apply(imageData: ImageData, params: { pixelSize: number }): ImageData {
    if (params.pixelSize <= 1) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    const { width, height, data } = imageData;
    const result = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y += params.pixelSize) {
      for (let x = 0; x < width; x += params.pixelSize) {
        // Calculate average color of pixel block
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          count = 0;

        for (let py = y; py < Math.min(y + params.pixelSize, height); py++) {
          for (let px = x; px < Math.min(x + params.pixelSize, width); px++) {
            const idx = (py * width + px) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            count++;
          }
        }

        // Average color
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        a = Math.round(a / count);

        // Apply average color to pixel block
        for (let py = y; py < Math.min(y + params.pixelSize, height); py++) {
          for (let px = x; px < Math.min(x + params.pixelSize, width); px++) {
            const idx = (py * width + px) * 4;
            result[idx] = r;
            result[idx + 1] = g;
            result[idx + 2] = b;
            result[idx + 3] = a;
          }
        }
      }
    }

    return new ImageData(result, width, height);
  },

  validate(params: { pixelSize: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.pixelSize !== 'number') {
      errors.push('pixelSize must be a number');
    } else if (params.pixelSize < 1) {
      errors.push('pixelSize must be 1 or greater');
    } else if (params.pixelSize > 50) {
      warnings.push('Large pixel sizes can significantly degrade image detail');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Posterize effect plugin
 *
 * @description Filter plugin that creates poster-like effects by reducing color levels.
 * Quantizes each color channel value to specified level count to create simplified colors.
 */
export const PosterizeFilterPlugin: FilterPlugin<{ levels: number }> = {
  name: 'posterize',
  description: 'Creates poster-like effects by reducing color levels',
  category: FilterCategory.ARTISTIC,
  defaultParams: { levels: 8 },

  apply(imageData: ImageData, params: { levels: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const levels = Math.max(2, Math.min(256, params.levels));
    const step = 255 / (levels - 1);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(Math.round(data[i] / step) * step);
      data[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
      data[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    }

    return result;
  },

  validate(params: { levels: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.levels !== 'number') {
      errors.push('levels must be a number');
    } else if (params.levels < 2 || params.levels > 256) {
      errors.push('levels must be between 2 and 256');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * All effect filter plugins
 *
 * @description Array containing special effect filter plugins including grayscale, sepia, invert,
 * noise, vignette, pixelate, and posterize effects.
 */
export const EffectFilterPlugins = [
  GrayscaleFilterPlugin,
  SepiaFilterPlugin,
  InvertFilterPlugin,
  NoiseFilterPlugin,
  VignetteFilterPlugin,
  PixelateFilterPlugin,
  PosterizeFilterPlugin,
];
