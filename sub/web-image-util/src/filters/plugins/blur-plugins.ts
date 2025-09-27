/**
 * 블러 및 선명도 관련 필터 플러그인들
 * 블러 및 선명도 필터 플러그인 모음 (블러, 샤프닝, 엠보스, 엣지 검출)
 */

import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * 가우시안 커널 생성 유틸리티 함수
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

  // 정규화
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * 컨볼루션 연산 유틸리티 함수
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
      output[outIdx + 3] = data[outIdx + 3]; // 알파 유지
    }
  }

  return new ImageData(output, width, height);
}

/**
 * 가우시안 블러 플러그인
 *
 * @description 가우시안 그러드 경사 기반의 고품질 블러 효과를 적용하는 필터 플러그인입니다.
 * 2패스 컸볼루션(수평/수직)을 사용하여 효율적이고 자연스러운 블러링을 수행합니다.
 */
export const BlurFilterPlugin: FilterPlugin<{ radius: number }> = {
  name: 'blur',
  description: '가우시안 블러로 이미지를 부드럽게 만듭니다',
  category: FilterCategory.BLUR,
  defaultParams: { radius: 2 },

  apply(imageData: ImageData, params: { radius: number }): ImageData {
    if (params.radius <= 0) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    const { width, height, data } = imageData;
    const output = new Uint8ClampedArray(data);

    // 가우시안 커널 생성
    const kernel = createGaussianKernel(params.radius);
    const kernelSize = kernel.length;
    const half = Math.floor(kernelSize / 2);

    // 수평 패스
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

    // 수직 패스
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
      errors.push('radius는 숫자여야 합니다');
    } else if (params.radius < 0 || params.radius > 20) {
      errors.push('radius는 0에서 20 사이여야 합니다');
    } else if (params.radius > 10) {
      warnings.push('높은 블러 값은 처리 시간을 크게 증가시킬 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  preview(imageData: ImageData, params: { radius: number }): ImageData {
    // 미리보기에서는 작은 블러 값으로 제한
    const previewParams = { radius: Math.min(params.radius, 5) };
    return this.apply(imageData, previewParams);
  },
};

/**
 * 샤프닝 필터 플러그인
 *
 * @description 언샤프 마스킹 기법을 사용하여 이미지를 선명하게 만드는 필터 플러그인입니다.
 * 원본 이미지와 블러된 이미지의 차이를 이용하여 엣지를 강화합니다.
 */
export const SharpenFilterPlugin: FilterPlugin<{ amount: number }> = {
  name: 'sharpen',
  description: '언샤프 마스킹으로 이미지를 선명하게 만듭니다',
  category: FilterCategory.SHARPEN,
  defaultParams: { amount: 50 },

  apply(imageData: ImageData, params: { amount: number }): ImageData {
    if (params.amount <= 0) {
      return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    // 블러된 이미지 생성
    const blurred = BlurFilterPlugin.apply(imageData, { radius: 1 });
    const original = imageData.data;
    const blurredData = blurred.data;
    const output = new Uint8ClampedArray(original.length);

    const factor = params.amount / 100;

    for (let i = 0; i < original.length; i += 4) {
      // 언샤프 마스킹: original + factor * (original - blurred)
      output[i] = Math.max(0, Math.min(255, original[i] + factor * (original[i] - blurredData[i])));
      output[i + 1] = Math.max(0, Math.min(255, original[i + 1] + factor * (original[i + 1] - blurredData[i + 1])));
      output[i + 2] = Math.max(0, Math.min(255, original[i + 2] + factor * (original[i + 2] - blurredData[i + 2])));
      output[i + 3] = original[i + 3]; // 알파는 유지
    }

    return new ImageData(output, imageData.width, imageData.height);
  },

  validate(params: { amount: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.amount !== 'number') {
      errors.push('amount는 숫자여야 합니다');
    } else if (params.amount < 0 || params.amount > 100) {
      errors.push('amount는 0에서 100 사이여야 합니다');
    } else if (params.amount > 80) {
      warnings.push('과도한 샤프닝은 노이즈를 증폭시킬 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * 엠보스 효과 플러그인
 *
 * @description 이미지에 3D 엠보스 효과를 적용하는 필터 플러그인입니다.
 * 특수한 컸볼루션 커널을 사용하여 양각된 또는 욕각된 듯한 시각적 효과를 만듭니다.
 */
export const EmbossFilterPlugin: FilterPlugin<{ strength: number }> = {
  name: 'emboss',
  description: '이미지에 3D 엠보스 효과를 적용합니다',
  category: FilterCategory.EFFECT,
  defaultParams: { strength: 1 },

  apply(imageData: ImageData, params: { strength: number }): ImageData {
    const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2].map((v) => v * params.strength);

    return applyConvolution(imageData, kernel, 1);
  },

  validate(params: { strength: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.strength !== 'number') {
      errors.push('strength는 숫자여야 합니다');
    } else if (params.strength < 0 || params.strength > 3) {
      errors.push('strength는 0에서 3 사이여야 합니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * 에지 검출 필터 플러그인
 *
 * @description 라플라시안 연산자를 사용하여 이미지에서 가장자리를 검출하는 필터 플러그인입니다.
 * 이미지의 밝기 변화가 급격한 부분을 강조하여 윤곽선을 시각화합니다.
 */
export const EdgeDetectionFilterPlugin: FilterPlugin<{ sensitivity: number }> = {
  name: 'edgeDetection',
  description: '이미지에서 가장자리를 검출합니다',
  category: FilterCategory.EFFECT,
  defaultParams: { sensitivity: 1 },

  apply(imageData: ImageData, params: { sensitivity: number }): ImageData {
    const kernel = [-1, -1, -1, -1, 8, -1, -1, -1, -1].map((v) => v * params.sensitivity);

    return applyConvolution(imageData, kernel, 1);
  },

  validate(params: { sensitivity: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.sensitivity !== 'number') {
      errors.push('sensitivity는 숫자여야 합니다');
    } else if (params.sensitivity < 0 || params.sensitivity > 2) {
      errors.push('sensitivity는 0에서 2 사이여야 합니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * 모든 블러/샤프닝 필터 플러그인들
 *
 * @description 블러, 샤프닝, 엠보스, 에지 검출 등의 영상 처리 필터들을 모은 배열입니다.
 * 이미지의 선명도와 엣지 효과를 조절하는 데 필수적인 기능들을 제공합니다.
 */
export const BlurFilterPlugins = [BlurFilterPlugin, SharpenFilterPlugin, EmbossFilterPlugin, EdgeDetectionFilterPlugin];
