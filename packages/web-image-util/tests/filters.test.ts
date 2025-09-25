import { describe, it, expect, beforeAll } from 'vitest';
import { 
  ColorFilters, 
  SharpnessFilters, 
  EffectFilters, 
  FilterEngine, 
  FilterType 
} from '../src/filters';
import { ImageResizer } from '../src/ImageResizer';

describe('필터 기능 테스트', () => {
  let testCanvas: HTMLCanvasElement;
  let testImageData: ImageData;

  beforeAll(() => {
    // 테스트용 Canvas와 ImageData 생성
    testCanvas = document.createElement('canvas');
    testCanvas.width = 100;
    testCanvas.height = 100;
    
    const ctx = testCanvas.getContext('2d')!;
    
    // 간단한 테스트 이미지 생성 (그라데이션)
    const gradient = ctx.createLinearGradient(0, 0, 100, 100);
    gradient.addColorStop(0, 'rgb(255, 0, 0)'); // 빨강
    gradient.addColorStop(0.5, 'rgb(0, 255, 0)'); // 초록
    gradient.addColorStop(1, 'rgb(0, 0, 255)'); // 파랑
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 100, 100);
    
    testImageData = ctx.getImageData(0, 0, 100, 100);
  });

  describe('ColorFilters', () => {
    it('밝기 조정이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const brighterData = ColorFilters.brightness(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        50
      );
      
      // 밝기가 증가했는지 확인
      const originalSum = Array.from(originalData)
        .filter((_, i) => i % 4 !== 3) // 알파 채널 제외
        .reduce((sum, val) => sum + val, 0);
        
      const brighterSum = Array.from(brighterData.data)
        .filter((_, i) => i % 4 !== 3) // 알파 채널 제외
        .reduce((sum, val) => sum + val, 0);
      
      expect(brighterSum).toBeGreaterThan(originalSum);
    });

    it('대비 조정이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const contrastedData = ColorFilters.contrast(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        50
      );
      
      // 데이터가 변경되었는지 확인
      expect(contrastedData.data).not.toEqual(originalData);
      expect(contrastedData.width).toBe(100);
      expect(contrastedData.height).toBe(100);
    });

    it('채도 조정이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const saturatedData = ColorFilters.saturation(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        50
      );
      
      // 데이터가 변경되었는지 확인
      expect(saturatedData.data).not.toEqual(originalData);
    });

    it('색조 조정이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const hueShiftedData = ColorFilters.hue(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        180
      );
      
      // 데이터가 변경되었는지 확인
      expect(hueShiftedData.data).not.toEqual(originalData);
    });
  });

  describe('SharpnessFilters', () => {
    it('블러 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const blurredData = SharpnessFilters.blur(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        2
      );
      
      // 블러는 이미지를 부드럽게 만들므로 픽셀 값의 분산이 줄어들어야 함
      expect(blurredData.width).toBe(100);
      expect(blurredData.height).toBe(100);
      expect(blurredData.data).not.toEqual(originalData);
    });

    it('샤프닝 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const sharpenedData = SharpnessFilters.sharpen(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        50
      );
      
      expect(sharpenedData.width).toBe(100);
      expect(sharpenedData.height).toBe(100);
      expect(sharpenedData.data).not.toEqual(originalData);
    });
  });

  describe('EffectFilters', () => {
    it('그레이스케일 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const grayscaleData = EffectFilters.grayscale(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100)
      );
      
      // 그레이스케일에서는 R, G, B 값이 모두 같아야 함
      for (let i = 0; i < grayscaleData.data.length; i += 4) {
        const r = grayscaleData.data[i];
        const g = grayscaleData.data[i + 1];
        const b = grayscaleData.data[i + 2];
        
        expect(r).toBe(g);
        expect(g).toBe(b);
      }
    });

    it('세피아 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const sepiaData = EffectFilters.sepia(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        100
      );
      
      expect(sepiaData.width).toBe(100);
      expect(sepiaData.height).toBe(100);
      expect(sepiaData.data).not.toEqual(originalData);
    });

    it('색상 반전 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const invertedData = EffectFilters.invert(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100)
      );
      
      // 반전된 값이 올바른지 확인 (R + inverted_R = 255)
      for (let i = 0; i < Math.min(originalData.length, 40); i += 4) {
        expect(originalData[i] + invertedData.data[i]).toBe(255);     // R
        expect(originalData[i + 1] + invertedData.data[i + 1]).toBe(255); // G
        expect(originalData[i + 2] + invertedData.data[i + 2]).toBe(255); // B
        expect(originalData[i + 3]).toBe(invertedData.data[i + 3]);   // A (변경 없음)
      }
    });

    it('노이즈 필터가 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const noisyData = EffectFilters.noise(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        30
      );
      
      expect(noisyData.width).toBe(100);
      expect(noisyData.height).toBe(100);
      expect(noisyData.data).not.toEqual(originalData);
    });
  });

  describe('FilterEngine', () => {
    it('단일 필터 적용이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const filteredData = FilterEngine.applyFilter(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        {
          type: FilterType.BRIGHTNESS,
          params: { value: 30 }
        }
      );
      
      expect(filteredData.width).toBe(100);
      expect(filteredData.height).toBe(100);
      expect(filteredData.data).not.toEqual(originalData);
    });

    it('필터 체인이 올바르게 작동해야 함', () => {
      const originalData = new Uint8ClampedArray(testImageData.data);
      const filteredData = FilterEngine.applyFilterChain(
        new ImageData(new Uint8ClampedArray(originalData), 100, 100),
        {
          filters: [
            {
              type: FilterType.BRIGHTNESS,
              params: { value: 20 }
            },
            {
              type: FilterType.CONTRAST,
              params: { value: 10 }
            },
            {
              type: FilterType.BLUR,
              params: { radius: 1 }
            }
          ]
        }
      );
      
      expect(filteredData.width).toBe(100);
      expect(filteredData.height).toBe(100);
      expect(filteredData.data).not.toEqual(originalData);
    });

    it('필터 유효성 검사가 올바르게 작동해야 함', () => {
      // 유효한 필터
      const validFilter = {
        type: FilterType.BRIGHTNESS,
        params: { value: 50 }
      };
      
      const validResult = FilterEngine.validateFilter(validFilter);
      expect(validResult.valid).toBe(true);
      expect(validResult.error).toBeUndefined();
      
      // 유효하지 않은 필터 (범위 초과)
      const invalidFilter = {
        type: FilterType.BRIGHTNESS,
        params: { value: 150 }
      };
      
      const invalidResult = FilterEngine.validateFilter(invalidFilter);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    it('필터 체인 최적화가 올바르게 작동해야 함', () => {
      const filters = [
        { type: FilterType.BRIGHTNESS, params: { value: 20 } },
        { type: FilterType.BRIGHTNESS, params: { value: 10 } }, // 병합 가능
        { type: FilterType.CONTRAST, params: { value: 15 } },
        { type: FilterType.CONTRAST, params: { value: 5 } }    // 병합 가능
      ];
      
      const optimized = FilterEngine.optimizeFilterChain(filters);
      
      // 최적화된 체인은 더 짧아야 함
      expect(optimized.length).toBeLessThan(filters.length);
      
      // 첫 번째 필터는 병합된 밝기 값을 가져야 함
      expect(optimized[0].type).toBe(FilterType.BRIGHTNESS);
      expect(optimized[0].params.value).toBe(30); // 20 + 10
    });
  });

  describe('ImageResizer 필터 통합', () => {
    it('ImageResizer에서 필터 체이닝이 올바르게 작동해야 함', async () => {
      // 간단한 테스트 이미지 생성
      const canvas = document.createElement('canvas');
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 50, 50);
      
      // Canvas를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });
      
      // ImageResizer로 필터 체이닝 테스트
      const resizer = ImageResizer.from(blob)
        .centerCrop({ size: 40 })
        .brightness(30)
        .contrast(20)
        .blur(1);
      
      // 필터가 정상적으로 추가되었는지 확인
      const filters = resizer.getFilters();
      expect(filters.length).toBe(3);
      expect(filters[0].type).toBe(FilterType.BRIGHTNESS);
      expect(filters[1].type).toBe(FilterType.CONTRAST);
      expect(filters[2].type).toBe(FilterType.BLUR);
      
      // 실제 변환 테스트
      const resultBlob = await resizer.toBlob('png');
      expect(resultBlob).toBeDefined();
      expect(resultBlob.type).toBe('image/png');
      expect(resultBlob.size).toBeGreaterThan(0);
    });

    it('필터 초기화가 올바르게 작동해야 함', () => {
      const resizer = ImageResizer.from('test.jpg')
        .brightness(50)
        .contrast(30)
        .grayscale();
      
      expect(resizer.getFilters().length).toBe(3);
      
      resizer.clearFilters();
      expect(resizer.getFilters().length).toBe(0);
    });

    it('잘못된 필터 매개변수에 대해 오류를 발생시켜야 함', () => {
      const resizer = ImageResizer.from('test.jpg');
      
      expect(() => {
        resizer.filter({
          type: FilterType.BRIGHTNESS,
          params: { value: 200 } // 유효 범위 초과
        });
      }).toThrow();
    });
  });
});