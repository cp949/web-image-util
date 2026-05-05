/**
 * 특수 효과 필터 플러그인 테스트
 *
 * @description GrayscaleFilterPlugin, SepiaFilterPlugin, InvertFilterPlugin,
 * NoiseFilterPlugin, VignetteFilterPlugin, PixelateFilterPlugin, PosterizeFilterPlugin
 * 전체 공개 인터페이스를 검증한다.
 */

import { beforeAll, describe, expect, it } from 'vitest';
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

beforeAll(() => {
  if (typeof globalThis.ImageData === 'undefined') {
    globalThis.ImageData = class MockImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    } as unknown as typeof ImageData;
  }
});

/** 단일 픽셀 ImageData를 생성한다. */
function px(r: number, g: number, b: number, a = 255): ImageData {
  const data = new Uint8ClampedArray([r, g, b, a]);
  return new ImageData(data, 1, 1);
}

/** 지정한 색상으로 채워진 ImageData를 생성한다. */
function fillImageData(width: number, height: number, r: number, g: number, b: number, a = 255): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return new ImageData(data, width, height);
}

describe('GrayscaleFilterPlugin', () => {
  it('name이 grayscale이다', () => {
    expect(GrayscaleFilterPlugin.name).toBe('grayscale');
  });

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
    expect(result.data[0]).toBeCloseTo(128, 0);
    expect(result.data[1]).toBeCloseTo(128, 0);
    expect(result.data[2]).toBeCloseTo(128, 0);
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
    expect(previewed.data[0]).toBe(applied.data[0]);
    expect(previewed.data[1]).toBe(applied.data[1]);
    expect(previewed.data[2]).toBe(applied.data[2]);
  });
});

describe('SepiaFilterPlugin', () => {
  it('name이 sepia이다', () => {
    expect(SepiaFilterPlugin.name).toBe('sepia');
  });

  it('defaultParams.intensity가 100이다', () => {
    expect(SepiaFilterPlugin.defaultParams.intensity).toBe(100);
  });

  it('intensity=100이면 세피아 변환 행렬이 완전히 적용된다 — R > G > B', () => {
    const result = SepiaFilterPlugin.apply(px(100, 100, 100), { intensity: 100 });
    // 세피아 행렬의 특성: R이 가장 높고 B가 가장 낮다
    expect(result.data[0]).toBeGreaterThan(result.data[1]);
    expect(result.data[1]).toBeGreaterThan(result.data[2]);
  });

  it('intensity=0이면 원본과 동일하다 (factor=0)', () => {
    const result = SepiaFilterPlugin.apply(px(100, 150, 200), { intensity: 0 });
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(150);
    expect(result.data[2]).toBe(200);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = SepiaFilterPlugin.apply(px(100, 100, 100, 200), { intensity: 100 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it('0~100은 valid:true를 반환한다', () => {
      expect(SepiaFilterPlugin.validate({ intensity: 0 }).valid).toBe(true);
      expect(SepiaFilterPlugin.validate({ intensity: 100 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(SepiaFilterPlugin.validate({ intensity: 101 }).valid).toBe(false);
      expect(SepiaFilterPlugin.validate({ intensity: -1 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(SepiaFilterPlugin.validate({ intensity: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('InvertFilterPlugin', () => {
  it('name이 invert이다', () => {
    expect(InvertFilterPlugin.name).toBe('invert');
  });

  it('각 채널을 255에서 뺀 값으로 반전한다', () => {
    const result = InvertFilterPlugin.apply(px(100, 150, 200), {});
    expect(result.data[0]).toBe(155);
    expect(result.data[1]).toBe(105);
    expect(result.data[2]).toBe(55);
  });

  it('두 번 적용하면 원본으로 돌아온다', () => {
    const input = px(100, 150, 200);
    const once = InvertFilterPlugin.apply(input, {});
    const twice = InvertFilterPlugin.apply(once, {});
    expect(twice.data[0]).toBe(100);
    expect(twice.data[1]).toBe(150);
    expect(twice.data[2]).toBe(200);
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
  it('name이 noise이다', () => {
    expect(NoiseFilterPlugin.name).toBe('noise');
  });

  it('intensity=0이면 원본과 동일하다 (amount=0)', () => {
    // amount = (0/100)*255 = 0 → noise = 0 → 변화 없음
    const result = NoiseFilterPlugin.apply(px(128, 128, 128), { intensity: 0 });
    expect(result.data[0]).toBe(128);
    expect(result.data[3]).toBe(255);
  });

  it('intensity>0이면 결과의 크기와 알파가 유지된다', () => {
    const input = fillImageData(4, 4, 128, 128, 128);
    const result = NoiseFilterPlugin.apply(input, { intensity: 100 });
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    // 알파 채널은 변경되지 않는다
    expect(result.data[3]).toBe(255);
  });

  describe('validate', () => {
    it('0~100은 valid:true를 반환한다', () => {
      expect(NoiseFilterPlugin.validate({ intensity: 0 }).valid).toBe(true);
      expect(NoiseFilterPlugin.validate({ intensity: 100 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(NoiseFilterPlugin.validate({ intensity: 101 }).valid).toBe(false);
      expect(NoiseFilterPlugin.validate({ intensity: -1 }).valid).toBe(false);
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
  it('name이 vignette이다', () => {
    expect(VignetteFilterPlugin.name).toBe('vignette');
  });

  it('가장자리 픽셀이 중앙 픽셀보다 어두워진다', () => {
    // 5x5 흰색 이미지로 vignette 적용
    const w = 5;
    const h = 5;
    const input = fillImageData(w, h, 255, 255, 255);
    const result = VignetteFilterPlugin.apply(input, { intensity: 1, size: 1, blur: 0.5 });

    // 중앙 픽셀 인덱스
    const centerIdx = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
    const centerR = result.data[centerIdx];

    // 코너 픽셀 인덱스 (0,0)
    const cornerR = result.data[0];

    expect(cornerR).toBeLessThan(centerR);
  });

  it('결과 크기가 원본과 동일하다', () => {
    const input = fillImageData(8, 6, 200, 200, 200);
    const result = VignetteFilterPlugin.apply(input, { intensity: 0.8, size: 0.5, blur: 0.5 });
    expect(result.width).toBe(8);
    expect(result.height).toBe(6);
  });

  describe('validate', () => {
    it('유효한 파라미터는 valid:true를 반환한다', () => {
      expect(VignetteFilterPlugin.validate({ intensity: 0.5, size: 0.5, blur: 0.5 }).valid).toBe(true);
    });

    it('intensity 범위 초과는 valid:false를 반환한다', () => {
      expect(VignetteFilterPlugin.validate({ intensity: 2, size: 0.5, blur: 0.5 }).valid).toBe(false);
      expect(VignetteFilterPlugin.validate({ intensity: -0.1, size: 0.5, blur: 0.5 }).valid).toBe(false);
    });

    it('size 범위 초과는 valid:false를 반환한다', () => {
      expect(VignetteFilterPlugin.validate({ intensity: 0.5, size: -0.1, blur: 0.5 }).valid).toBe(false);
      expect(VignetteFilterPlugin.validate({ intensity: 0.5, size: 1.5, blur: 0.5 }).valid).toBe(false);
    });

    it('blur 범위 초과는 valid:false를 반환한다', () => {
      expect(VignetteFilterPlugin.validate({ intensity: 0.5, size: 0.5, blur: 2 }).valid).toBe(false);
    });
  });
});

describe('PixelateFilterPlugin', () => {
  it('name이 pixelate이다', () => {
    expect(PixelateFilterPlugin.name).toBe('pixelate');
  });

  it('defaultParams.pixelSize가 8이다', () => {
    expect(PixelateFilterPlugin.defaultParams.pixelSize).toBe(8);
  });

  it('pixelSize=1이면 원본을 복사해 반환한다', () => {
    const input = fillImageData(4, 4, 100, 150, 200);
    const result = PixelateFilterPlugin.apply(input, { pixelSize: 1 });
    expect(result.data[0]).toBe(100);
  });

  it('pixelSize>1이면 블록 내 픽셀이 평균 색상으로 통일된다', () => {
    // 2x2 이미지: (0,0)=0, (1,0)=200, (0,1)=100, (1,1)=100 → 평균 R=100
    const data = new Uint8ClampedArray(4 * 4);
    data[0] = 0;
    data[1] = 0;
    data[2] = 0;
    data[3] = 255;
    data[4] = 200;
    data[5] = 200;
    data[6] = 200;
    data[7] = 255;
    data[8] = 100;
    data[9] = 100;
    data[10] = 100;
    data[11] = 255;
    data[12] = 100;
    data[13] = 100;
    data[14] = 100;
    data[15] = 255;
    const input = new ImageData(data, 2, 2);
    const result = PixelateFilterPlugin.apply(input, { pixelSize: 2 });
    // 평균: (0+200+100+100)/4 = 100
    expect(result.data[0]).toBe(100);
    expect(result.data[4]).toBe(100); // 같은 블록의 다른 픽셀
  });

  it('결과 크기가 원본과 동일하다', () => {
    const input = fillImageData(8, 8, 128, 128, 128);
    const result = PixelateFilterPlugin.apply(input, { pixelSize: 4 });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  describe('validate', () => {
    it('유효한 값은 valid:true를 반환한다', () => {
      expect(PixelateFilterPlugin.validate({ pixelSize: 8 }).valid).toBe(true);
      expect(PixelateFilterPlugin.validate({ pixelSize: 1 }).valid).toBe(true);
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
  it('name이 posterize이다', () => {
    expect(PosterizeFilterPlugin.name).toBe('posterize');
  });

  it('defaultParams.levels가 8이다', () => {
    expect(PosterizeFilterPlugin.defaultParams.levels).toBe(8);
  });

  it('levels=2이면 각 채널을 0 또는 255로만 양자화한다', () => {
    const result = PosterizeFilterPlugin.apply(px(100, 200, 50), { levels: 2 });
    // step = 255/(2-1) = 255, round(v/255)*255 → 0 또는 255
    expect([0, 255]).toContain(result.data[0]);
    expect([0, 255]).toContain(result.data[1]);
    expect([0, 255]).toContain(result.data[2]);
  });

  it('levels=256이면 원본과 동일하다', () => {
    // step = 255/255 = 1, round(v/1)*1 = v
    const result = PosterizeFilterPlugin.apply(px(100, 150, 200), { levels: 256 });
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(150);
    expect(result.data[2]).toBe(200);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = PosterizeFilterPlugin.apply(px(100, 100, 100, 200), { levels: 4 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it('2~256은 valid:true를 반환한다', () => {
      expect(PosterizeFilterPlugin.validate({ levels: 2 }).valid).toBe(true);
      expect(PosterizeFilterPlugin.validate({ levels: 8 }).valid).toBe(true);
      expect(PosterizeFilterPlugin.validate({ levels: 256 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(PosterizeFilterPlugin.validate({ levels: 1 }).valid).toBe(false);
      expect(PosterizeFilterPlugin.validate({ levels: 300 }).valid).toBe(false);
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
    const names = EffectFilterPlugins.map((p) => p.name);
    expect(names).toContain('grayscale');
    expect(names).toContain('sepia');
    expect(names).toContain('invert');
    expect(names).toContain('noise');
    expect(names).toContain('vignette');
    expect(names).toContain('pixelate');
    expect(names).toContain('posterize');
  });
});
