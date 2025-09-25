/**
 * 색상 조정 필터 플러그인들
 * 기존 ColorFilters 클래스를 플러그인 시스템에 맞게 변환
 */

import type { FilterPlugin, FilterValidationResult } from '../plugin-system';
import { FilterCategory } from '../plugin-system';

/**
 * 밝기 조정 필터 플러그인
 */
export const BrightnessFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'brightness',
  description: '이미지의 밝기를 조정합니다',
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
      // A는 변경하지 않음
    }

    return result;
  },

  validate(params: { value: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.value !== 'number') {
      errors.push('value는 숫자여야 합니다');
    } else if (params.value < -100 || params.value > 100) {
      errors.push('value는 -100에서 100 사이여야 합니다');
    } else if (Math.abs(params.value) > 50) {
      warnings.push('극단적인 밝기 조정은 이미지 품질을 저하시킬 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  preview(imageData: ImageData, params: { value: number }): ImageData {
    // 미리보기는 전체 적용과 동일
    return this.apply(imageData, params);
  },
};

/**
 * 대비 조정 필터 플러그인
 */
export const ContrastFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'contrast',
  description: '이미지의 대비를 조정합니다',
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
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.value !== 'number') {
      errors.push('value는 숫자여야 합니다');
    } else if (params.value < -100 || params.value > 100) {
      errors.push('value는 -100에서 100 사이여야 합니다');
    } else if (Math.abs(params.value) > 50) {
      warnings.push('극단적인 대비 조정은 디테일 손실을 야기할 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
};

/**
 * 채도 조정 필터 플러그인
 */
export const SaturationFilterPlugin: FilterPlugin<{ value: number }> = {
  name: 'saturation',
  description: '이미지의 채도를 조정합니다',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },

  apply(imageData: ImageData, params: { value: number }): ImageData {
    const result = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    const data = result.data;
    const factor = (params.value + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      // 휘도 계산 (Y = 0.299*R + 0.587*G + 0.114*B)
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      data[i] = Math.max(0, Math.min(255, gray + factor * (data[i] - gray)));
      data[i + 1] = Math.max(0, Math.min(255, gray + factor * (data[i + 1] - gray)));
      data[i + 2] = Math.max(0, Math.min(255, gray + factor * (data[i + 2] - gray)));
    }

    return result;
  },

  validate(params: { value: number }): FilterValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof params.value !== 'number') {
      errors.push('value는 숫자여야 합니다');
    } else if (params.value < -100 || params.value > 100) {
      errors.push('value는 -100에서 100 사이여야 합니다');
    } else if (params.value > 50) {
      warnings.push('높은 채도는 부자연스러운 색상을 만들 수 있습니다');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  canOptimizeWith(otherFilter: FilterPlugin): boolean {
    // 다른 색상 조정 필터들과 최적화 가능
    return ['brightness', 'contrast', 'hue'].includes(otherFilter.name);
  },
};

/**
 * 모든 색상 필터 플러그인들
 */
export const ColorFilterPlugins = [BrightnessFilterPlugin, ContrastFilterPlugin, SaturationFilterPlugin];
