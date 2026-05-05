/**
 * 색상 조정 필터 플러그인 테스트
 *
 * @description BrightnessFilterPlugin, ContrastFilterPlugin, SaturationFilterPlugin의
 * apply / validate / 선택적 메서드 전체를 검증한다.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  BrightnessFilterPlugin,
  ColorFilterPlugins,
  ContrastFilterPlugin,
  SaturationFilterPlugin,
} from '../../../src/filters/plugins/color-plugins';

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

describe('BrightnessFilterPlugin', () => {
  it('name이 brightness이다', () => {
    expect(BrightnessFilterPlugin.name).toBe('brightness');
  });

  it('defaultParams.value가 0이다', () => {
    expect(BrightnessFilterPlugin.defaultParams.value).toBe(0);
  });

  it('value=0이면 픽셀이 변하지 않는다', () => {
    const result = BrightnessFilterPlugin.apply(px(100, 150, 200), { value: 0 });
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(150);
    expect(result.data[2]).toBe(200);
  });

  it('value=100이면 픽셀이 최대로 밝아진다 (255로 클램핑)', () => {
    const result = BrightnessFilterPlugin.apply(px(100, 100, 100), { value: 100 });
    // adjustment = 255, 100+255 → 클램핑 255
    expect(result.data[0]).toBe(255);
  });

  it('value=-100이면 픽셀이 최소가 된다 (0으로 클램핑)', () => {
    const result = BrightnessFilterPlugin.apply(px(100, 100, 100), { value: -100 });
    // adjustment = -255, 100-255 → 클램핑 0
    expect(result.data[0]).toBe(0);
  });

  it('value=50이면 RGB 채널이 밝아진다', () => {
    const result = BrightnessFilterPlugin.apply(px(50, 80, 30), { value: 50 });
    const adj = Math.round((50 / 100) * 255);
    expect(result.data[0]).toBe(Math.min(255, 50 + adj));
    expect(result.data[1]).toBe(Math.min(255, 80 + adj));
    expect(result.data[2]).toBe(Math.min(255, 30 + adj));
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = BrightnessFilterPlugin.apply(px(100, 100, 100, 128), { value: 50 });
    expect(result.data[3]).toBe(128);
  });

  describe('validate', () => {
    it('0은 valid:true를 반환한다', () => {
      expect(BrightnessFilterPlugin.validate({ value: 0 }).valid).toBe(true);
    });

    it('-100, 100 경계값은 valid:true를 반환한다', () => {
      expect(BrightnessFilterPlugin.validate({ value: 100 }).valid).toBe(true);
      expect(BrightnessFilterPlugin.validate({ value: -100 }).valid).toBe(true);
    });

    it('범위를 벗어난 값은 valid:false와 errors를 반환한다', () => {
      const result = BrightnessFilterPlugin.validate({ value: 101 });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('음수 범위 초과도 valid:false를 반환한다', () => {
      expect(BrightnessFilterPlugin.validate({ value: -101 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(BrightnessFilterPlugin.validate({ value: 'bad' as any }).valid).toBe(false);
    });

    it('|value| > 50이면 경고를 포함한다', () => {
      const result = BrightnessFilterPlugin.validate({ value: 80 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  it('preview는 apply와 동일한 결과를 반환한다', () => {
    const input = px(100, 100, 100);
    const applied = BrightnessFilterPlugin.apply(input, { value: 30 });
    const previewed = BrightnessFilterPlugin.preview!(input, { value: 30 });
    expect(previewed.data[0]).toBe(applied.data[0]);
  });
});

describe('ContrastFilterPlugin', () => {
  it('name이 contrast이다', () => {
    expect(ContrastFilterPlugin.name).toBe('contrast');
  });

  it('defaultParams.value가 0이다', () => {
    expect(ContrastFilterPlugin.defaultParams.value).toBe(0);
  });

  it('value=0이면 픽셀이 거의 변하지 않는다', () => {
    // factor = (259*255)/(255*259) = 1.0
    const result = ContrastFilterPlugin.apply(px(128, 128, 128), { value: 0 });
    expect(result.data[0]).toBe(128);
  });

  it('value=50이면 밝은 픽셀이 더 밝아진다', () => {
    const result = ContrastFilterPlugin.apply(px(200, 200, 200), { value: 50 });
    expect(result.data[0]).toBeGreaterThan(200);
  });

  it('value=50이면 어두운 픽셀이 더 어두워진다', () => {
    const result = ContrastFilterPlugin.apply(px(50, 50, 50), { value: 50 });
    expect(result.data[0]).toBeLessThan(50);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = ContrastFilterPlugin.apply(px(100, 100, 100, 200), { value: 30 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it('유효한 범위는 valid:true를 반환한다', () => {
      expect(ContrastFilterPlugin.validate({ value: 0 }).valid).toBe(true);
      expect(ContrastFilterPlugin.validate({ value: 100 }).valid).toBe(true);
      expect(ContrastFilterPlugin.validate({ value: -100 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(ContrastFilterPlugin.validate({ value: 200 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(ContrastFilterPlugin.validate({ value: null as any }).valid).toBe(false);
    });

    it('|value| > 50이면 경고를 포함한다', () => {
      const result = ContrastFilterPlugin.validate({ value: 75 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });
});

describe('SaturationFilterPlugin', () => {
  it('name이 saturation이다', () => {
    expect(SaturationFilterPlugin.name).toBe('saturation');
  });

  it('defaultParams.value가 0이다', () => {
    expect(SaturationFilterPlugin.defaultParams.value).toBe(0);
  });

  it('value=0이면 픽셀이 변하지 않는다', () => {
    // factor = (0+100)/100 = 1 → 변화 없음
    const result = SaturationFilterPlugin.apply(px(200, 100, 50), { value: 0 });
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(100);
    expect(result.data[2]).toBe(50);
  });

  it('value=-100이면 그레이스케일과 동일해진다', () => {
    // factor = 0 → 모든 채널이 휘도값(gray)으로
    const result = SaturationFilterPlugin.apply(px(200, 100, 50), { value: -100 });
    const gray = 0.299 * 200 + 0.587 * 100 + 0.114 * 50;
    // 세 채널이 모두 동일해야 한다
    expect(result.data[0]).toBeCloseTo(gray, 0);
    expect(result.data[1]).toBeCloseTo(gray, 0);
    expect(result.data[2]).toBeCloseTo(gray, 0);
  });

  it('value=100이면 채도가 증가한다', () => {
    // factor = 2 → 색상 차이가 두 배로 증폭
    const input = px(200, 100, 50);
    const result = SaturationFilterPlugin.apply(input, { value: 100 });
    // 가장 밝은 채널(R=200)은 더 밝아지거나 유지
    expect(result.data[0]).toBeGreaterThanOrEqual(200);
  });

  it('알파 채널을 변경하지 않는다', () => {
    const result = SaturationFilterPlugin.apply(px(100, 100, 100, 180), { value: 50 });
    expect(result.data[3]).toBe(180);
  });

  describe('validate', () => {
    it('유효한 값은 valid:true를 반환한다', () => {
      expect(SaturationFilterPlugin.validate({ value: 0 }).valid).toBe(true);
      expect(SaturationFilterPlugin.validate({ value: -100 }).valid).toBe(true);
      expect(SaturationFilterPlugin.validate({ value: 100 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(SaturationFilterPlugin.validate({ value: 101 }).valid).toBe(false);
      expect(SaturationFilterPlugin.validate({ value: -101 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(SaturationFilterPlugin.validate({ value: undefined as any }).valid).toBe(false);
    });

    it('value > 50이면 경고를 포함한다', () => {
      const result = SaturationFilterPlugin.validate({ value: 80 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  it('canOptimizeWith는 색상 관련 필터와 true를 반환한다', () => {
    expect(SaturationFilterPlugin.canOptimizeWith!({ name: 'brightness' } as any)).toBe(true);
    expect(SaturationFilterPlugin.canOptimizeWith!({ name: 'contrast' } as any)).toBe(true);
    expect(SaturationFilterPlugin.canOptimizeWith!({ name: 'hue' } as any)).toBe(true);
  });

  it('canOptimizeWith는 무관한 필터와 false를 반환한다', () => {
    expect(SaturationFilterPlugin.canOptimizeWith!({ name: 'blur' } as any)).toBe(false);
    expect(SaturationFilterPlugin.canOptimizeWith!({ name: 'grayscale' } as any)).toBe(false);
  });
});

describe('ColorFilterPlugins', () => {
  it('brightness, contrast, saturation 3개를 포함한다', () => {
    expect(ColorFilterPlugins.length).toBe(3);
    const names = ColorFilterPlugins.map((p) => p.name);
    expect(names).toContain('brightness');
    expect(names).toContain('contrast');
    expect(names).toContain('saturation');
  });
});
