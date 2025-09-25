/**
 * 특수 효과 필터 플러그인들
 * 기존 EffectFilters 클래스를 플러그인 시스템에 맞게 변환
 */

import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * 그레이스케일 변환 플러그인
 */
export const GrayscaleFilterPlugin: FilterPlugin<Record<string, never>> = {
  name: 'grayscale',
  description: '이미지를 흑백으로 변환합니다',
  category: FilterCategory.EFFECT,
  defaultParams: {},

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;

    for (let i = 0; i < data.length; i += 4) {
      // 휘도 공식을 사용한 그레이스케일 변환
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    return result;
  },

  validate(): FilterValidationResult {
    // 매개변수가 없으므로 항상 유효
    return { valid: true };
  },

  preview(imageData: ImageData): ImageData {
    // 미리보기는 전체 적용과 동일
    return this.apply(imageData, {});
  },
};

/**
 * 세피아 효과 플러그인
 */
export const SepiaFilterPlugin: FilterPlugin<{ intensity: number }> = {
  name: 'sepia',
  description: '빈티지한 세피아 효과를 적용합니다',
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

      // 세피아 변환 매트릭스 적용
      const newR = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
      const newG = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
      const newB = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);

      // 원본과 세피아 효과를 블렌딩
      data[i] = r + factor * (newR - r);
      data[i + 1] = g + factor * (newG - g);
      data[i + 2] = b + factor * (newB - b);
    }

    return result;
  },

  validate(params: { intensity: number }): FilterValidationResult {
    const errors: string[] = [];

    if (typeof params.intensity !== 'number') {
      errors.push('intensity는 숫자여야 합니다');
    } else if (params.intensity < 0 || params.intensity > 100) {
      errors.push('intensity는 0에서 100 사이여야 합니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * 색상 반전 플러그인
 */
export const InvertFilterPlugin: FilterPlugin<Record<string, never>> = {
  name: 'invert',
  description: '이미지의 색상을 반전시킵니다',
  category: FilterCategory.EFFECT,
  defaultParams: {},

  apply(imageData: ImageData): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]; // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
      // A는 변경하지 않음
    }

    return result;
  },

  validate(): FilterValidationResult {
    return { valid: true };
  },
};

/**
 * 노이즈 추가 플러그인
 */
export const NoiseFilterPlugin: FilterPlugin<{ intensity: number }> = {
  name: 'noise',
  description: '이미지에 노이즈를 추가합니다',
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
      errors.push('intensity는 숫자여야 합니다');
    } else if (params.intensity < 0 || params.intensity > 100) {
      errors.push('intensity는 0에서 100 사이여야 합니다');
    } else if (params.intensity > 50) {
      warnings.push('높은 노이즈 강도는 이미지 품질을 크게 저하시킬 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * 비네팅 효과 플러그인
 */
export const VignetteFilterPlugin: FilterPlugin<{ intensity: number; size: number; blur: number }> = {
  name: 'vignette',
  description: '가장자리가 어두워지는 비네팅 효과를 적용합니다',
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

        // 비네팅 팩터 계산
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
      errors.push('intensity는 0에서 1 사이의 숫자여야 합니다');
    }

    if (typeof params.size !== 'number' || params.size < 0 || params.size > 1) {
      errors.push('size는 0에서 1 사이의 숫자여야 합니다');
    }

    if (typeof params.blur !== 'number' || params.blur < 0 || params.blur > 1) {
      errors.push('blur는 0에서 1 사이의 숫자여야 합니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * 픽셀화 효과 플러그인
 */
export const PixelateFilterPlugin: FilterPlugin<{ pixelSize: number }> = {
  name: 'pixelate',
  description: '이미지를 픽셀화 처리합니다',
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
        // 픽셀 블록의 평균 색상 계산
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

        // 평균 색상
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        a = Math.round(a / count);

        // 픽셀 블록에 평균 색상 적용
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
      errors.push('pixelSize는 숫자여야 합니다');
    } else if (params.pixelSize < 1) {
      errors.push('pixelSize는 1 이상이어야 합니다');
    } else if (params.pixelSize > 50) {
      warnings.push('큰 픽셀 크기는 이미지 디테일을 크게 손실시킬 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * 포스터화 효과 플러그인
 */
export const PosterizeFilterPlugin: FilterPlugin<{ levels: number }> = {
  name: 'posterize',
  description: '색상 레벨을 줄여 포스터 같은 효과를 만듭니다',
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
      errors.push('levels는 숫자여야 합니다');
    } else if (params.levels < 2 || params.levels > 256) {
      errors.push('levels는 2에서 256 사이여야 합니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  },
};

/**
 * 모든 효과 필터 플러그인들
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
