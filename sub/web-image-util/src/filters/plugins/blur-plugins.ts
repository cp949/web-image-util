/**
 * Blur and sharpness related filter plugins
 * Collection of blur and sharpness filter plugins (blur, sharpening, emboss, edge detection)
 */

import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * Gaussian kernel generation utility function
 */
function createGaussianKernel(radius: number): number[] {
  const size = Math.ceil(radius) * 2 + 1;
  const kernel = new Array(size);
  const sigma = radius / 3;
  const twoSigmaSquare = 2 * sigma * sigma;
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let i = 0; i < size; i++) {
    const distance = i - center;
    kernel[i] = Math.exp(-(distance * distance) / twoSigmaSquare);
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Convolution operation utility function
 */
function applyConvolution(imageData: ImageData, kernel: number[], divisor: number = 1): ImageData {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data.length);
  const kernelSize = Math.sqrt(kernel.length);
  const half = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const px = Math.max(0, Math.min(width - 1, x + kx - half));
          const py = Math.max(0, Math.min(height - 1, y + ky - half));
          const idx = (py * width + px) * 4;
          const kernelValue = kernel[ky * kernelSize + kx];

          r += data[idx] * kernelValue;
          g += data[idx + 1] * kernelValue;
          b += data[idx + 2] * kernelValue;
        }
      }

      const outIdx = (y * width + x) * 4;
      output[outIdx] = Math.max(0, Math.min(255, r / divisor));
      output[outIdx + 1] = Math.max(0, Math.min(255, g / divisor));
      output[outIdx + 2] = Math.max(0, Math.min(255, b / divisor));
      output[outIdx + 3] = data[outIdx + 3]; // Keep alpha
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Gaussian blur plugin
 *
 * @description Filter plugin that applies high-quality blur effects based on Gaussian gradient.
 * Performs efficient and natural blurring using 2-pass convolution (horizontal/vertical).
 */
export const BlurFilterPlugin: FilterPlugin<{ radius: number }> = {
  name: 'blur',
  description: 'Softens images with Gaussian blur',
  category: FilterCategory.BLUR,
  defaultParams: { radius: 2 },

  apply(imageData: ImageData, params: { radius: number }): ImageData {
    if (params.radius <= 0) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // Generate Gaussian kernel
    const kernel = createGaussianKernel(params.radius);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const px = Math.max(0, Math.min(width - 1, x + i - half));
          const idx = (y * width + px) * 4;
          const weight = kernel[i];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
          a += data[idx + 3] * weight;
          weightSum += weight;
        }

        const outIdx = (y * width + x) * 4;
        output[outIdx] = r / weightSum;
        output[outIdx + 1] = g / weightSum;
        output[outIdx + 2] = b / weightSum;
        output[outIdx + 3] = a / weightSum;
      }
    }

    // Vertical pass
    const temp = new Uint8ClampedArray(output);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        let weightSum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const py = Math.max(0, Math.min(height - 1, y + i - half));
          const idx = (py * width + x) * 4;
          const weight = kernel[i];

          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
          weightSum += weight;
        }

        const outIdx = (y * width + x) * 4;
        output[outIdx] = r / weightSum;
        output[outIdx + 1] = g / weightSum;
        output[outIdx + 2] = b / weightSum;
        output[outIdx + 3] = a / weightSum;
      }
    }

    return new ImageData(output, width, height);
  },

  validate(params: { radius: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.radius !== 'number') {
      errors.push('radius must be a number');
    } else if (params.radius < 0 || params.radius > 20) {
      errors.push('radius must be between 0 and 20');
    } else if (params.radius > 10) {
      warnings.push('High blur values can significantly increase processing time');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  preview(imageData: ImageData, params: { radius: number }): ImageData {
    // Limit to small blur values in preview
    const previewParams = { radius: Math.min(params.radius, 5) };
    return this.apply(imageData, previewParams);
  },
};

/**
 * Sharpening filter plugin
 *
 * @description Filter plugin that sharpens images using unsharp masking technique.
 * Enhances edges by using the difference between original and blurred images.
 */
export const SharpenFilterPlugin: FilterPlugin<{ amount: number }> = {
  name: 'sharpen',
  description: 'Sharpens images with unsharp masking',
  category: FilterCategory.SHARPEN,
  defaultParams: { amount: 50 },

  apply(imageData: ImageData, params: { amount: number }): ImageData {
    if (params.amount <= 0) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    // Generate blurred image
    const blurred = BlurFilterPlugin.apply(imageData, { radius: 1 });
    const original = imageData.data;
    const blurredData = blurred.data;
    const output = new Uint8ClampedArray(original.length);

    const factor = params.amount / 100;

    for (let i = 0; i < original.length; i += 4) {
      // Unsharp masking: original + factor * (original - blurred)
      output[i] = Math.max(0, Math.min(255, original[i] + factor * (original[i] - blurredData[i])));
      output[i + 1] = Math.max(0, Math.min(255, original[i + 1] + factor * (original[i + 1] - blurredData[i + 1])));
      output[i + 2] = Math.max(0, Math.min(255, original[i + 2] + factor * (original[i + 2] - blurredData[i + 2])));
      output[i + 3] = original[i + 3]; // Keep alpha
    }

    return new ImageData(output, imageData.width, imageData.height);
  },

  validate(params: { amount: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.amount !== 'number') {
      errors.push('amount must be a number');
    } else if (params.amount < 0 || params.amount > 100) {
      errors.push('amount must be between 0 and 100');
    } else if (params.amount > 80) {
      warnings.push('Excessive sharpening may amplify noise');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * Emboss effect plugin
 *
 * @description Filter plugin that applies 3D emboss effects to images.
 * Creates raised or recessed visual effects using special convolution kernels.
 */
export const EmbossFilterPlugin: FilterPlugin<{ strength: number }> = {
  name: 'emboss',
  description: 'Applies 3D emboss effects to images',
  category: FilterCategory.EFFECT,
  defaultParams: { strength: 1 },

  apply(imageData: ImageData, params: { strength: number }): ImageData {
    const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2].map((v) => v * params.strength);

    return applyConvolution(imageData, kernel, 1);
  },

  validate(params: { strength: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.strength !== 'number') {
      errors.push('strength must be a number');
    } else if (params.strength < 0 || params.strength > 3) {
      errors.push('strength must be between 0 and 3');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * Edge detection filter plugin
 *
 * @description Filter plugin that detects edges in images using Laplacian operator.
 * Emphasizes areas with rapid brightness changes to visualize contours.
 */
export const EdgeDetectionFilterPlugin: FilterPlugin<{ sensitivity: number }> = {
  name: 'edgeDetection',
  description: 'Detects edges in images',
  category: FilterCategory.EFFECT,
  defaultParams: { sensitivity: 1 },

  apply(imageData: ImageData, params: { sensitivity: number }): ImageData {
    const kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1].map((v) => v * params.sensitivity);

    return applyConvolution(imageData, kernel, 1);
  },

  validate(params: { sensitivity: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.sensitivity !== 'number') {
      errors.push('sensitivity must be a number');
    } else if (params.sensitivity < 0 || params.sensitivity > 2) {
      errors.push('sensitivity must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * All blur/sharpening filter plugins
 *
 * @description Array containing image processing filters including blur, sharpening, emboss, and edge detection.
 * Provides essential functions for adjusting image sharpness and edge effects.
 */
export const BlurFilterPlugins = [BlurFilterPlugin, SharpenFilterPlugin, EmbossFilterPlugin, EdgeDetectionFilterPlugin];
