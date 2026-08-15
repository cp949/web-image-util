/**
 * 파라미터가 있는 필터 플러그인 12개의 검증 계약을 고정한다.
 * 타입·범위 오류 메시지와 경고 임계값·메시지를 공개 validate() 반환값으로 확인한다.
 */

import { describe, expect, it } from 'vitest';
import type { FilterValidationResult } from '../../../src/filters/plugin-system';
import {
  BlurFilterPlugin,
  EdgeDetectionFilterPlugin,
  EmbossFilterPlugin,
  SharpenFilterPlugin,
} from '../../../src/filters/plugins/blur-plugins';
import {
  BrightnessFilterPlugin,
  ContrastFilterPlugin,
  SaturationFilterPlugin,
} from '../../../src/filters/plugins/color-plugins';
import {
  NoiseFilterPlugin,
  PixelateFilterPlugin,
  PosterizeFilterPlugin,
  SepiaFilterPlugin,
  VignetteFilterPlugin,
} from '../../../src/filters/plugins/effect-plugins';

interface WarningPin {
  threshold: () => FilterValidationResult;
  triggered: () => FilterValidationResult;
  message: string;
  directionalNonTrigger?: () => FilterValidationResult;
}

interface ValidationPin {
  name: string;
  typeInvalid: () => FilterValidationResult;
  rangeInvalid: () => FilterValidationResult;
  validBoundary: () => FilterValidationResult;
  typeError: string;
  rangeError: string;
  warning?: WarningPin;
}

const validationPins: ValidationPin[] = [
  {
    name: 'blur',
    typeInvalid: () => BlurFilterPlugin.validate({ radius: 'bad' as unknown as number }),
    rangeInvalid: () => BlurFilterPlugin.validate({ radius: 21 }),
    validBoundary: () => BlurFilterPlugin.validate({ radius: 20 }),
    typeError: 'radius must be a number',
    rangeError: 'radius must be between 0 and 20',
    warning: {
      threshold: () => BlurFilterPlugin.validate({ radius: 10 }),
      triggered: () => BlurFilterPlugin.validate({ radius: 11 }),
      message: 'High blur values can significantly increase processing time',
    },
  },
  {
    name: 'sharpen',
    typeInvalid: () => SharpenFilterPlugin.validate({ amount: 'bad' as unknown as number }),
    rangeInvalid: () => SharpenFilterPlugin.validate({ amount: 101 }),
    validBoundary: () => SharpenFilterPlugin.validate({ amount: 100 }),
    typeError: 'amount must be a number',
    rangeError: 'amount must be between 0 and 100',
    warning: {
      threshold: () => SharpenFilterPlugin.validate({ amount: 80 }),
      triggered: () => SharpenFilterPlugin.validate({ amount: 81 }),
      message: 'Excessive sharpening may amplify noise',
    },
  },
  {
    name: 'emboss',
    typeInvalid: () => EmbossFilterPlugin.validate({ strength: 'bad' as unknown as number }),
    rangeInvalid: () => EmbossFilterPlugin.validate({ strength: 4 }),
    validBoundary: () => EmbossFilterPlugin.validate({ strength: 3 }),
    typeError: 'strength must be a number',
    rangeError: 'strength must be between 0 and 3',
  },
  {
    name: 'edgeDetection',
    typeInvalid: () => EdgeDetectionFilterPlugin.validate({ sensitivity: 'bad' as unknown as number }),
    rangeInvalid: () => EdgeDetectionFilterPlugin.validate({ sensitivity: 3 }),
    validBoundary: () => EdgeDetectionFilterPlugin.validate({ sensitivity: 2 }),
    typeError: 'sensitivity must be a number',
    rangeError: 'sensitivity must be between 0 and 2',
  },
  {
    name: 'brightness',
    typeInvalid: () => BrightnessFilterPlugin.validate({ value: 'bad' as unknown as number }),
    rangeInvalid: () => BrightnessFilterPlugin.validate({ value: 101 }),
    validBoundary: () => BrightnessFilterPlugin.validate({ value: 100 }),
    typeError: 'value must be a number',
    rangeError: 'value must be between -100 and 100',
    warning: {
      threshold: () => BrightnessFilterPlugin.validate({ value: -50 }),
      triggered: () => BrightnessFilterPlugin.validate({ value: -51 }),
      message: 'Extreme brightness adjustments may degrade image quality',
    },
  },
  {
    name: 'contrast',
    typeInvalid: () => ContrastFilterPlugin.validate({ value: 'bad' as unknown as number }),
    rangeInvalid: () => ContrastFilterPlugin.validate({ value: 101 }),
    validBoundary: () => ContrastFilterPlugin.validate({ value: 100 }),
    typeError: 'value must be a number',
    rangeError: 'value must be between -100 and 100',
    warning: {
      threshold: () => ContrastFilterPlugin.validate({ value: -50 }),
      triggered: () => ContrastFilterPlugin.validate({ value: -51 }),
      message: 'Extreme contrast adjustments may cause detail loss',
    },
  },
  {
    name: 'saturation',
    typeInvalid: () => SaturationFilterPlugin.validate({ value: 'bad' as unknown as number }),
    rangeInvalid: () => SaturationFilterPlugin.validate({ value: 101 }),
    validBoundary: () => SaturationFilterPlugin.validate({ value: 100 }),
    typeError: 'value must be a number',
    rangeError: 'value must be between -100 and 100',
    warning: {
      threshold: () => SaturationFilterPlugin.validate({ value: 50 }),
      triggered: () => SaturationFilterPlugin.validate({ value: 51 }),
      directionalNonTrigger: () => SaturationFilterPlugin.validate({ value: -51 }),
      message: 'High saturation may create unnatural colors',
    },
  },
  {
    name: 'sepia',
    typeInvalid: () => SepiaFilterPlugin.validate({ intensity: 'bad' as unknown as number }),
    rangeInvalid: () => SepiaFilterPlugin.validate({ intensity: 101 }),
    validBoundary: () => SepiaFilterPlugin.validate({ intensity: 100 }),
    typeError: 'intensity must be a number',
    rangeError: 'intensity must be between 0 and 100',
  },
  {
    name: 'noise',
    typeInvalid: () => NoiseFilterPlugin.validate({ intensity: 'bad' as unknown as number }),
    rangeInvalid: () => NoiseFilterPlugin.validate({ intensity: 101 }),
    validBoundary: () => NoiseFilterPlugin.validate({ intensity: 100 }),
    typeError: 'intensity must be a number',
    rangeError: 'intensity must be between 0 and 100',
    warning: {
      threshold: () => NoiseFilterPlugin.validate({ intensity: 50 }),
      triggered: () => NoiseFilterPlugin.validate({ intensity: 51 }),
      message: 'High noise intensity can significantly degrade image quality',
    },
  },
  {
    name: 'vignette',
    typeInvalid: () => VignetteFilterPlugin.validate({ intensity: 'bad' as unknown as number, size: 0.5, blur: 0.5 }),
    rangeInvalid: () => VignetteFilterPlugin.validate({ intensity: 2, size: 0.5, blur: 0.5 }),
    validBoundary: () => VignetteFilterPlugin.validate({ intensity: 1, size: 1, blur: 1 }),
    typeError: 'intensity must be a number between 0 and 1',
    rangeError: 'intensity must be a number between 0 and 1',
  },
  {
    name: 'pixelate',
    typeInvalid: () => PixelateFilterPlugin.validate({ pixelSize: 'bad' as unknown as number }),
    rangeInvalid: () => PixelateFilterPlugin.validate({ pixelSize: 0 }),
    validBoundary: () => PixelateFilterPlugin.validate({ pixelSize: 1 }),
    typeError: 'pixelSize must be a number',
    rangeError: 'pixelSize must be 1 or greater',
    warning: {
      threshold: () => PixelateFilterPlugin.validate({ pixelSize: 50 }),
      triggered: () => PixelateFilterPlugin.validate({ pixelSize: 51 }),
      message: 'Large pixel sizes can significantly degrade image detail',
    },
  },
  {
    name: 'posterize',
    typeInvalid: () => PosterizeFilterPlugin.validate({ levels: 'bad' as unknown as number }),
    rangeInvalid: () => PosterizeFilterPlugin.validate({ levels: 257 }),
    validBoundary: () => PosterizeFilterPlugin.validate({ levels: 256 }),
    typeError: 'levels must be a number',
    rangeError: 'levels must be between 2 and 256',
  },
];

describe('필터 플러그인 검증 계약', () => {
  it.each(validationPins)('$name 플러그인은 오류·경고 계약을 보존한다', (pin) => {
    const typeResult = pin.typeInvalid();
    const rangeResult = pin.rangeInvalid();
    const boundaryResult = pin.validBoundary();

    expect(typeResult.valid).toBe(false);
    expect(typeResult.errors?.[0]).toBe(pin.typeError);
    expect(rangeResult.valid).toBe(false);
    expect(rangeResult.errors?.[0]).toBe(pin.rangeError);
    expect(boundaryResult.valid).toBe(true);
    expect(boundaryResult.errors).toBeUndefined();

    if (pin.warning === undefined) {
      expect(boundaryResult.warnings).toBeUndefined();
      return;
    }

    const thresholdResult = pin.warning.threshold();
    const warningResult = pin.warning.triggered();

    expect(thresholdResult.warnings).toBeUndefined();
    expect(warningResult.valid).toBe(true);
    expect(warningResult.warnings?.[0]).toBe(pin.warning.message);
    expect(pin.warning.directionalNonTrigger?.().warnings).toBeUndefined();
  });

  it('vignette의 세 필드가 모두 무효이면 선언 순서대로 오류 3개를 반환한다', () => {
    const result = VignetteFilterPlugin.validate({ intensity: -1, size: 2, blur: 'bad' as unknown as number });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'intensity must be a number between 0 and 1',
      'size must be a number between 0 and 1',
      'blur must be a number between 0 and 1',
    ]);
  });
});
