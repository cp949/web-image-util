/** 특수 효과 필터 플러그인의 공개 인터페이스와 픽셀 변환을 검증한다. */

import { describe, expect, it } from 'vitest';
import {
  EffectFilterPlugins,
  GrayscaleFilterPlugin,
  InvertFilterPlugin,
  NoiseFilterPlugin,
  PixelateFilterPlugin,
  PosterizeFilterPlugin,
  SepiaFilterPlugin,
  VignetteFilterPlugin,
} from '../../../src/filters/plugins/effect-plugins';
import { createImageData, createImageDataFromPixels, createSinglePixelImageData as px } from './plugin-system-helpers';

describe('효과 필터 공개 메타데이터', () => {
  it('개별 플러그인 name이 공개 계약과 일치한다', () => {
    expect([
      GrayscaleFilterPlugin.name,
      SepiaFilterPlugin.name,
      InvertFilterPlugin.name,
      NoiseFilterPlugin.name,
      VignetteFilterPlugin.name,
      PixelateFilterPlugin.name,
      PosterizeFilterPlugin.name,
    ]).toEqual(['grayscale', 'sepia', 'invert', 'noise', 'vignette', 'pixelate', 'posterize']);
  });

  it.each([
    ['SepiaFilterPlugin', SepiaFilterPlugin.defaultParams.intensity, 100],
    ['PixelateFilterPlugin', PixelateFilterPlugin.defaultParams.pixelSize, 8],
    ['PosterizeFilterPlugin', PosterizeFilterPlugin.defaultParams.levels, 8],
  ])('%s 기본 파라미터가 공개 계약과 일치한다', (_label, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe('GrayscaleFilterPlugin', () => {
  it('컬러 픽셀을 회색조로 변환한다 — 세 채널이 동일해야 한다', () => {
    const result = GrayscaleFilterPlugin.apply(px(200, 100, 50), {});
    expect(result.data[0]).toBe(result.data[1]);
    expect(result.data[1]).toBe(result.data[2]);
  });

  it('회색조 값이 휘도 공식과 일치한다', () => {
    const result = GrayscaleFilterPlugin.apply(px(200, 100, 50), {});
    const expected = 0.299 * 200 + 0.587 * 100 + 0.114 * 50;
    expect(result.data[0]).toBeCloseTo(expected, 0);
  });

  it('이미 회색인 픽셀은 값이 유지된다', () => {
    const result = GrayscaleFilterPlugin.apply(px(128, 128, 128), {});
    expect(Array.from(result.data.slice(0, 3))).toEqual([128, 128, 128]);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = GrayscaleFilterPlugin.apply(px(200, 100, 50, 128), {});
    expect(result.data[3]).toBe(128);
  });

  it('validate는 항상 valid:true를 반환한다', () => {
    expect(GrayscaleFilterPlugin.validate({}).valid).toBe(true);
  });

  it('preview는 apply와 동일한 결과를 반환한다', () => {
    const input = px(200, 100, 50);
    const applied = GrayscaleFilterPlugin.apply(input, {});
    const previewed = GrayscaleFilterPlugin.preview!(input, {});
    expect(Array.from(previewed.data.slice(0, 3))).toEqual(Array.from(applied.data.slice(0, 3)));
  });
});

describe('SepiaFilterPlugin', () => {
  it('intensity=100이면 세피아 변환 행렬이 완전히 적용된다 — R > G > B', () => {
    const result = SepiaFilterPlugin.apply(px(100, 100, 100), { intensity: 100 });
    expect(result.data[0]).toBeGreaterThan(result.data[1]);
    expect(result.data[1]).toBeGreaterThan(result.data[2]);
  });

  it('intensity=0이면 원본과 동일하다 (factor=0)', () => {
    const result = SepiaFilterPlugin.apply(px(100, 150, 200), { intensity: 0 });
    expect(Array.from(result.data.slice(0, 3))).toEqual([100, 150, 200]);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = SepiaFilterPlugin.apply(px(100, 100, 100, 200), { intensity: 100 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it.each([0, 100])('intensity=%d이면 valid:true를 반환한다', (intensity) => {
      expect(SepiaFilterPlugin.validate({ intensity }).valid).toBe(true);
    });

    it.each([101, -1])('intensity=%d이면 valid:false를 반환한다', (intensity) => {
      expect(SepiaFilterPlugin.validate({ intensity }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(SepiaFilterPlugin.validate({ intensity: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('InvertFilterPlugin', () => {
  it('각 채널을 255에서 뺀 값으로 반전한다', () => {
    const result = InvertFilterPlugin.apply(px(100, 150, 200), {});
    expect(Array.from(result.data.slice(0, 3))).toEqual([155, 105, 55]);
  });

  it('두 번 적용하면 원본으로 돌아온다', () => {
    const input = px(100, 150, 200);
    const twice = InvertFilterPlugin.apply(InvertFilterPlugin.apply(input, {}), {});
    expect(Array.from(twice.data.slice(0, 3))).toEqual([100, 150, 200]);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = InvertFilterPlugin.apply(px(100, 100, 100, 180), {});
    expect(result.data[3]).toBe(180);
  });

  it('validate는 항상 valid:true를 반환한다', () => {
    expect(InvertFilterPlugin.validate({}).valid).toBe(true);
  });
});

describe('NoiseFilterPlugin', () => {
  it('intensity=0이면 원본과 동일하다 (amount=0)', () => {
    const result = NoiseFilterPlugin.apply(px(128, 128, 128), { intensity: 0 });
    expect(result.data[0]).toBe(128);
    expect(result.data[3]).toBe(255);
  });

  it('intensity>0이면 결과의 크기와 알파가 유지된다', () => {
    const result = NoiseFilterPlugin.apply(createImageData(4, 4, [128, 128, 128, 255]), { intensity: 100 });
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.data[3]).toBe(255);
  });

  describe('validate', () => {
    it.each([0, 100])('intensity=%d이면 valid:true를 반환한다', (intensity) => {
      expect(NoiseFilterPlugin.validate({ intensity }).valid).toBe(true);
    });

    it.each([101, -1])('intensity=%d이면 valid:false를 반환한다', (intensity) => {
      expect(NoiseFilterPlugin.validate({ intensity }).valid).toBe(false);
    });

    it('intensity > 50이면 경고를 포함한다', () => {
      const result = NoiseFilterPlugin.validate({ intensity: 60 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(NoiseFilterPlugin.validate({ intensity: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('VignetteFilterPlugin', () => {
  it('가장자리 픽셀이 중앙 픽셀보다 어두워진다', () => {
    const width = 5;
    const height = 5;
    const result = VignetteFilterPlugin.apply(createImageData(width, height, [255, 255, 255, 255]), {
      intensity: 1,
      size: 1,
      blur: 0.5,
    });
    const centerIndex = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;

    expect(result.data[0]).toBeLessThan(result.data[centerIndex]);
  });

  it('결과 크기가 원본과 동일하다', () => {
    const result = VignetteFilterPlugin.apply(createImageData(8, 6, [200, 200, 200, 255]), {
      intensity: 0.8,
      size: 0.5,
      blur: 0.5,
    });
    expect(result.width).toBe(8);
    expect(result.height).toBe(6);
  });

  describe('validate', () => {
    it('유효한 파라미터는 valid:true를 반환한다', () => {
      expect(VignetteFilterPlugin.validate({ intensity: 0.5, size: 0.5, blur: 0.5 }).valid).toBe(true);
    });

    it.each([
      ['intensity=2', { intensity: 2, size: 0.5, blur: 0.5 }],
      ['intensity=-0.1', { intensity: -0.1, size: 0.5, blur: 0.5 }],
      ['size=-0.1', { intensity: 0.5, size: -0.1, blur: 0.5 }],
      ['size=1.5', { intensity: 0.5, size: 1.5, blur: 0.5 }],
      ['blur=2', { intensity: 0.5, size: 0.5, blur: 2 }],
    ])('%s 범위 초과는 valid:false를 반환한다', (_caseName, params) => {
      expect(VignetteFilterPlugin.validate(params).valid).toBe(false);
    });
  });
});

describe('PixelateFilterPlugin', () => {
  it('pixelSize=1이면 원본을 복사해 반환한다', () => {
    const result = PixelateFilterPlugin.apply(createImageData(4, 4, [100, 150, 200, 255]), { pixelSize: 1 });
    expect(result.data[0]).toBe(100);
  });

  it('pixelSize>1이면 블록 내 픽셀이 평균 색상으로 통일된다', () => {
    const input = createImageDataFromPixels(2, 2, [
      [0, 0, 0, 255],
      [200, 200, 200, 255],
      [100, 100, 100, 255],
      [100, 100, 100, 255],
    ]);
    const result = PixelateFilterPlugin.apply(input, { pixelSize: 2 });
    expect(result.data[0]).toBe(100);
    expect(result.data[4]).toBe(100);
  });

  it('결과 크기가 원본과 동일하다', () => {
    const result = PixelateFilterPlugin.apply(createImageData(8, 8), { pixelSize: 4 });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  describe('validate', () => {
    it.each([8, 1])('pixelSize=%d이면 valid:true를 반환한다', (pixelSize) => {
      expect(PixelateFilterPlugin.validate({ pixelSize }).valid).toBe(true);
    });

    it('pixelSize < 1이면 valid:false를 반환한다', () => {
      expect(PixelateFilterPlugin.validate({ pixelSize: 0 }).valid).toBe(false);
    });

    it('pixelSize > 50이면 경고를 포함한다', () => {
      const result = PixelateFilterPlugin.validate({ pixelSize: 60 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(PixelateFilterPlugin.validate({ pixelSize: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('PosterizeFilterPlugin', () => {
  it('levels=2이면 각 채널을 0 또는 255로만 양자화한다', () => {
    const result = PosterizeFilterPlugin.apply(px(100, 200, 50), { levels: 2 });
    expect([0, 255]).toContain(result.data[0]);
    expect([0, 255]).toContain(result.data[1]);
    expect([0, 255]).toContain(result.data[2]);
  });

  it('levels=256이면 원본과 동일하다', () => {
    const result = PosterizeFilterPlugin.apply(px(100, 150, 200), { levels: 256 });
    expect(Array.from(result.data.slice(0, 3))).toEqual([100, 150, 200]);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = PosterizeFilterPlugin.apply(px(100, 100, 100, 200), { levels: 4 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it.each([2, 8, 256])('levels=%d이면 valid:true를 반환한다', (levels) => {
      expect(PosterizeFilterPlugin.validate({ levels }).valid).toBe(true);
    });

    it.each([1, 300])('levels=%d이면 valid:false를 반환한다', (levels) => {
      expect(PosterizeFilterPlugin.validate({ levels }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(PosterizeFilterPlugin.validate({ levels: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('EffectFilterPlugins', () => {
  it('7개의 플러그인을 포함한다', () => {
    expect(EffectFilterPlugins.length).toBe(7);
  });

  it('grayscale, sepia, invert, noise, vignette, pixelate, posterize를 포함한다', () => {
    expect(EffectFilterPlugins.map((plugin) => plugin.name)).toEqual([
      'grayscale',
      'sepia',
      'invert',
      'noise',
      'vignette',
      'pixelate',
      'posterize',
    ]);
  });
});
