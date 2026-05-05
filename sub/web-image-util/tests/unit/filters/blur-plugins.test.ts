/**
 * 블러·샤프닝 필터 플러그인 테스트
 *
 * @description BlurFilterPlugin, SharpenFilterPlugin, EmbossFilterPlugin,
 * EdgeDetectionFilterPlugin의 전체 공개 인터페이스를 검증한다.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  BlurFilterPlugin,
  BlurFilterPlugins,
  EdgeDetectionFilterPlugin,
  EmbossFilterPlugin,
  SharpenFilterPlugin,
} from '../../../src/filters/plugins/blur-plugins';

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

describe('BlurFilterPlugin', () => {
  it('name이 blur이다', () => {
    expect(BlurFilterPlugin.name).toBe('blur');
  });

  it('category가 BLUR이다', () => {
    expect(BlurFilterPlugin.category).toBe('blur');
  });

  it('defaultParams.radius가 2이다', () => {
    expect(BlurFilterPlugin.defaultParams.radius).toBe(2);
  });

  it('radius=0이면 원본과 동일한 픽셀을 반환한다', () => {
    const input = fillImageData(4, 4, 100, 150, 200);
    const result = BlurFilterPlugin.apply(input, { radius: 0 });
    expect(result.data[0]).toBe(100);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });

  it('radius>0이면 결과 크기가 원본과 같다', () => {
    const input = fillImageData(8, 8, 100, 150, 200);
    const result = BlurFilterPlugin.apply(input, { radius: 2 });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('균일한 이미지는 블러 후에도 픽셀 값이 유지된다', () => {
    // 모든 픽셀이 동일하면 가우시안 평균도 동일해야 한다
    const input = fillImageData(6, 6, 128, 128, 128);
    const result = BlurFilterPlugin.apply(input, { radius: 2 });
    expect(result.data[0]).toBeCloseTo(128, 0);
    expect(result.data[1]).toBeCloseTo(128, 0);
    expect(result.data[2]).toBeCloseTo(128, 0);
  });

  it('알파 채널도 가우시안 평균으로 처리된다', () => {
    // 균일한 알파는 블러 후에도 동일
    const input = fillImageData(4, 4, 100, 100, 100, 200);
    const result = BlurFilterPlugin.apply(input, { radius: 1 });
    expect(result.data[3]).toBeCloseTo(200, 0);
  });

  describe('validate', () => {
    it('0~20 범위의 radius는 valid:true를 반환한다', () => {
      expect(BlurFilterPlugin.validate({ radius: 0 }).valid).toBe(true);
      expect(BlurFilterPlugin.validate({ radius: 20 }).valid).toBe(true);
      expect(BlurFilterPlugin.validate({ radius: 5 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(BlurFilterPlugin.validate({ radius: 21 }).valid).toBe(false);
      expect(BlurFilterPlugin.validate({ radius: -1 }).valid).toBe(false);
    });

    it('radius > 10이면 경고를 포함한다', () => {
      const result = BlurFilterPlugin.validate({ radius: 15 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(BlurFilterPlugin.validate({ radius: 'bad' as any }).valid).toBe(false);
    });
  });

  it('preview는 radius를 최대 5로 제한해도 결과 크기는 동일하다', () => {
    const input = fillImageData(4, 4, 128, 128, 128);
    const result = BlurFilterPlugin.preview!(input, { radius: 10 });
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
  });
});

describe('SharpenFilterPlugin', () => {
  it('name이 sharpen이다', () => {
    expect(SharpenFilterPlugin.name).toBe('sharpen');
  });

  it('defaultParams.amount가 50이다', () => {
    expect(SharpenFilterPlugin.defaultParams.amount).toBe(50);
  });

  it('amount=0이면 원본과 동일한 픽셀을 반환한다', () => {
    const input = fillImageData(4, 4, 100, 150, 200);
    const result = SharpenFilterPlugin.apply(input, { amount: 0 });
    expect(result.data[0]).toBe(100);
    expect(result.width).toBe(4);
  });

  it('amount>0이면 결과 크기가 원본과 같다', () => {
    const input = fillImageData(8, 8, 100, 150, 200);
    const result = SharpenFilterPlugin.apply(input, { amount: 50 });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('균일한 이미지는 샤프닝 후에도 픽셀 값이 유지된다', () => {
    // unsharp masking: original + factor*(original-blurred). 균일 이미지는 blurred=original → 변화 없음
    const input = fillImageData(6, 6, 100, 100, 100);
    const result = SharpenFilterPlugin.apply(input, { amount: 50 });
    expect(result.data[0]).toBeCloseTo(100, 0);
  });

  it('알파 채널을 보존한다', () => {
    const input = fillImageData(4, 4, 100, 100, 100, 200);
    const result = SharpenFilterPlugin.apply(input, { amount: 50 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it('0~100 범위는 valid:true를 반환한다', () => {
      expect(SharpenFilterPlugin.validate({ amount: 0 }).valid).toBe(true);
      expect(SharpenFilterPlugin.validate({ amount: 100 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(SharpenFilterPlugin.validate({ amount: 101 }).valid).toBe(false);
      expect(SharpenFilterPlugin.validate({ amount: -1 }).valid).toBe(false);
    });

    it('amount > 80이면 경고를 포함한다', () => {
      const result = SharpenFilterPlugin.validate({ amount: 90 });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(SharpenFilterPlugin.validate({ amount: null as any }).valid).toBe(false);
    });
  });
});

describe('EmbossFilterPlugin', () => {
  it('name이 emboss이다', () => {
    expect(EmbossFilterPlugin.name).toBe('emboss');
  });

  it('defaultParams.strength가 1이다', () => {
    expect(EmbossFilterPlugin.defaultParams.strength).toBe(1);
  });

  it('적용 후 결과 크기가 원본과 동일하다', () => {
    const input = fillImageData(6, 6, 128, 128, 128);
    const result = EmbossFilterPlugin.apply(input, { strength: 1 });
    expect(result.width).toBe(6);
    expect(result.height).toBe(6);
  });

  it('알파 채널을 보존한다', () => {
    const input = fillImageData(4, 4, 128, 128, 128, 200);
    const result = EmbossFilterPlugin.apply(input, { strength: 1 });
    expect(result.data[3]).toBe(200);
  });

  it('strength=0이면 결과가 모두 0이다 (커널이 모두 0)', () => {
    const input = fillImageData(4, 4, 128, 128, 128);
    const result = EmbossFilterPlugin.apply(input, { strength: 0 });
    // 커널이 모두 0이므로 R,G,B = 0
    expect(result.data[0]).toBe(0);
  });

  describe('validate', () => {
    it('0~3 범위는 valid:true를 반환한다', () => {
      expect(EmbossFilterPlugin.validate({ strength: 0 }).valid).toBe(true);
      expect(EmbossFilterPlugin.validate({ strength: 3 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(EmbossFilterPlugin.validate({ strength: 4 }).valid).toBe(false);
      expect(EmbossFilterPlugin.validate({ strength: -1 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(EmbossFilterPlugin.validate({ strength: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('EdgeDetectionFilterPlugin', () => {
  it('name이 edgeDetection이다', () => {
    expect(EdgeDetectionFilterPlugin.name).toBe('edgeDetection');
  });

  it('defaultParams.sensitivity가 1이다', () => {
    expect(EdgeDetectionFilterPlugin.defaultParams.sensitivity).toBe(1);
  });

  it('적용 후 결과 크기가 원본과 동일하다', () => {
    const input = fillImageData(6, 6, 128, 128, 128);
    const result = EdgeDetectionFilterPlugin.apply(input, { sensitivity: 1 });
    expect(result.width).toBe(6);
    expect(result.height).toBe(6);
  });

  it('균일한 이미지에 적용하면 내부 픽셀이 0에 가깝다', () => {
    // 균일 이미지는 엣지가 없으므로 라플라시안 결과가 0
    const input = fillImageData(6, 6, 128, 128, 128);
    const result = EdgeDetectionFilterPlugin.apply(input, { sensitivity: 1 });
    // 중앙 픽셀(2,2): 모든 이웃이 동일하므로 결과 ≈ 0
    const centerIdx = (2 * 6 + 2) * 4;
    expect(result.data[centerIdx]).toBeCloseTo(0, 0);
  });

  it('알파 채널을 보존한다', () => {
    const input = fillImageData(4, 4, 128, 128, 128, 200);
    const result = EdgeDetectionFilterPlugin.apply(input, { sensitivity: 1 });
    expect(result.data[3]).toBe(200);
  });

  describe('validate', () => {
    it('0~2 범위는 valid:true를 반환한다', () => {
      expect(EdgeDetectionFilterPlugin.validate({ sensitivity: 0 }).valid).toBe(true);
      expect(EdgeDetectionFilterPlugin.validate({ sensitivity: 2 }).valid).toBe(true);
    });

    it('범위 초과는 valid:false를 반환한다', () => {
      expect(EdgeDetectionFilterPlugin.validate({ sensitivity: 3 }).valid).toBe(false);
      expect(EdgeDetectionFilterPlugin.validate({ sensitivity: -0.1 }).valid).toBe(false);
    });

    it('숫자가 아니면 valid:false를 반환한다', () => {
      expect(EdgeDetectionFilterPlugin.validate({ sensitivity: 'bad' as any }).valid).toBe(false);
    });
  });
});

describe('BlurFilterPlugins', () => {
  it('4개의 플러그인을 포함한다', () => {
    expect(BlurFilterPlugins.length).toBe(4);
  });

  it('blur, sharpen, emboss, edgeDetection을 포함한다', () => {
    const names = BlurFilterPlugins.map((p) => p.name);
    expect(names).toContain('blur');
    expect(names).toContain('sharpen');
    expect(names).toContain('emboss');
    expect(names).toContain('edgeDetection');
  });
});
