import { beforeAll } from 'vitest';
import { FilterCategory, type FilterPlugin } from '../../../src/filters/plugin-system';

// Node 환경에서 ImageData mock을 준비해 필터 연산 테스트가 같은 입력 모델을 공유하게 한다.
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
export function createImageData(
  width: number,
  height: number,
  fill: [number, number, number, number] = [128, 64, 32, 255]
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return new ImageData(data, width, height);
}

/** 테스트용 더미 필터 플러그인을 생성한다. R 채널에 value를 더한다. */
export function createDummyPlugin(
  name: string,
  category: FilterCategory = FilterCategory.COLOR
): FilterPlugin<{ value: number }> {
  return {
    name,
    category,
    defaultParams: { value: 0 },
    apply(imageData: ImageData, params: { value: number }): ImageData {
      const result = new Uint8ClampedArray(imageData.data);
      for (let i = 0; i < result.length; i += 4) {
        result[i] = Math.min(255, result[i] + params.value);
      }
      return new ImageData(result, imageData.width, imageData.height);
    },
    validate(params: { value: number }) {
      if (params.value < -100 || params.value > 100) {
        return { valid: false, errors: ['value out of range'] };
      }
      return { valid: true };
    },
  };
}
