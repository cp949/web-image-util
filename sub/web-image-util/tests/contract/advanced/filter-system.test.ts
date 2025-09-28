import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BlendMode,
  FilterCategory,
  FilterPluginManager,
  type FilterChain,
  type FilterOptions,
  type FilterPlugin,
} from '../../../src/filters/plugin-system';

// 테스트용 필터 플러그인들
const mockBrightnessPlugin: FilterPlugin<{ value: number }> = {
  name: 'test-brightness',
  description: 'Test brightness filter',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },
  validate: (params) => ({
    valid: typeof params.value === 'number' && params.value >= -100 && params.value <= 100,
    errors: typeof params.value !== 'number' ? ['value must be a number'] : [],
  }),
  apply: (imageData, params) => {
    // Context7 베스트 프랙티스: WSL 환경에서 안전한 ImageData 복사
    const resultData = new Uint8ClampedArray(imageData.data.length);
    resultData.set(imageData.data); // 데이터 복사
    const result = new ImageData(resultData, imageData.width, imageData.height);
    return result;
  },
};

const mockBlurPlugin: FilterPlugin<{ radius: number }> = {
  name: 'test-blur',
  description: 'Test blur filter',
  category: FilterCategory.BLUR,
  defaultParams: { radius: 0 },
  validate: (params) => ({
    valid: typeof params.radius === 'number' && params.radius >= 0,
    errors: params.radius < 0 ? ['radius must be non-negative'] : [],
  }),
  apply: (imageData, params) => {
    // Context7 베스트 프랙티스: WSL 환경에서 안전한 ImageData 복사
    const resultData = new Uint8ClampedArray(imageData.data.length);
    resultData.set(imageData.data); // 데이터 복사
    const result = new ImageData(resultData, imageData.width, imageData.height);
    return result;
  },
  preview: (imageData, params) => {
    // 미리보기는 작은 이미지로
    return new ImageData(new Uint8ClampedArray(16), 2, 2);
  },
};

const mockContrastPlugin: FilterPlugin<{ value: number }> = {
  name: 'test-contrast',
  description: 'Test contrast filter',
  category: FilterCategory.COLOR,
  defaultParams: { value: 0 },
  validate: (params) => ({
    valid: typeof params.value === 'number' && params.value >= -100 && params.value <= 100,
  }),
  apply: (imageData, params) => {
    // Context7 베스트 프랙티스: WSL 환경에서 안전한 ImageData 복사
    const resultData = new Uint8ClampedArray(imageData.data.length);
    resultData.set(imageData.data); // 데이터 복사
    return new ImageData(resultData, imageData.width, imageData.height);
  },
  canOptimizeWith: (otherFilter) => {
    return otherFilter.category === FilterCategory.COLOR;
  },
};

describe('필터 플러그인 시스템 계약 테스트', () => {
  let filterManager: FilterPluginManager;
  let mockImageData: ImageData;

  beforeEach(() => {
    // 테스트 간 격리를 위해 FilterPluginManager 리셋
    FilterPluginManager.resetForTesting();
    filterManager = FilterPluginManager.getInstance();
    mockImageData = new ImageData(new Uint8ClampedArray(400), 10, 10); // 10x10 이미지
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 테스트 후 등록된 필터들 정리
    filterManager.unregister('test-brightness');
    filterManager.unregister('test-blur');
    filterManager.unregister('test-contrast');
  });

  describe('FilterPlugin 인터페이스 타입 검증', () => {
    test('필터 플러그인 인터페이스 구조 확인', () => {
      // 타입 검증 - 컴파일 타임에 확인
      expect(mockBrightnessPlugin.name).toBe('test-brightness');
      expect(mockBrightnessPlugin.category).toBe(FilterCategory.COLOR);
      expect(typeof mockBrightnessPlugin.apply).toBe('function');
      expect(typeof mockBrightnessPlugin.validate).toBe('function');
      expect(mockBrightnessPlugin.defaultParams).toEqual({ value: 0 });
    });

    test('선택적 메서드 구현 확인', () => {
      expect(mockBlurPlugin.preview).toBeDefined();
      expect(typeof mockBlurPlugin.preview).toBe('function');
      expect(mockContrastPlugin.canOptimizeWith).toBeDefined();
      expect(typeof mockContrastPlugin.canOptimizeWith).toBe('function');
    });

    test('FilterValidationResult 타입 구조', () => {
      const validation = mockBrightnessPlugin.validate({ value: 50 });

      expect(validation).toHaveProperty('valid');
      expect(typeof validation.valid).toBe('boolean');

      if (validation.errors) {
        expect(Array.isArray(validation.errors)).toBe(true);
      }
      if (validation.warnings) {
        expect(Array.isArray(validation.warnings)).toBe(true);
      }
    });
  });

  describe('FilterPluginManager 기본 기능', () => {
    test('싱글톤 패턴 검증', () => {
      const instance1 = FilterPluginManager.getInstance();
      const instance2 = FilterPluginManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    test('필터 플러그인 등록', () => {
      filterManager.register(mockBrightnessPlugin);

      expect(filterManager.hasFilter('test-brightness')).toBe(true);
      expect(filterManager.getAvailableFilters()).toContain('test-brightness');
    });

    test('필터 플러그인 등록 해제', () => {
      filterManager.register(mockBrightnessPlugin);
      expect(filterManager.hasFilter('test-brightness')).toBe(true);

      const result = filterManager.unregister('test-brightness');

      expect(result).toBe(true);
      expect(filterManager.hasFilter('test-brightness')).toBe(false);
    });

    test('존재하지 않는 필터 등록 해제', () => {
      const result = filterManager.unregister('non-existent-filter');
      expect(result).toBe(false);
    });

    test('플러그인 조회', () => {
      filterManager.register(mockBrightnessPlugin);

      const plugin = filterManager.getPlugin('test-brightness');
      expect(plugin).toBe(mockBrightnessPlugin);

      const nonExistent = filterManager.getPlugin('non-existent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('카테고리별 관리', () => {
    test('카테고리별 플러그인 조회', () => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockContrastPlugin);
      filterManager.register(mockBlurPlugin);

      const colorFilters = filterManager.getPluginsByCategory(FilterCategory.COLOR);
      const blurFilters = filterManager.getPluginsByCategory(FilterCategory.BLUR);

      expect(colorFilters).toHaveLength(2);
      expect(colorFilters.map((f) => f.name)).toContain('test-brightness');
      expect(colorFilters.map((f) => f.name)).toContain('test-contrast');

      expect(blurFilters).toHaveLength(1);
      expect(blurFilters[0].name).toBe('test-blur');
    });

    test('빈 카테고리 조회', () => {
      const artisticFilters = filterManager.getPluginsByCategory(FilterCategory.ARTISTIC);
      expect(artisticFilters).toHaveLength(0);
    });

    test('모든 플러그인 조회', () => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockBlurPlugin);

      const allPlugins = filterManager.getAllPlugins();
      expect(allPlugins).toHaveLength(2);
      expect(allPlugins.map((p) => p.name)).toContain('test-brightness');
      expect(allPlugins.map((p) => p.name)).toContain('test-blur');
    });
  });

  describe('단일 필터 적용', () => {
    beforeEach(() => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockBlurPlugin);
    });

    test('기본 필터 적용', () => {
      // Context7 베스트 프랙티스: vi.stubGlobal을 사용한 WSL 환경 Canvas API 모킹
      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 20 },
      };

      const result = filterManager.applyFilter(mockImageData, filterOptions);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(mockImageData.width);
      expect(result.height).toBe(mockImageData.height);
    });

    test('비활성화된 필터 처리', () => {
      // Context7 베스트 프랙티스: vi.stubGlobal을 사용한 WSL 환경 Canvas API 모킹
      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 20 },
        enabled: false,
      };

      const result = filterManager.applyFilter(mockImageData, filterOptions);

      expect(result).toBeInstanceOf(ImageData);
      // 비활성화된 필터는 원본과 동일한 크기의 새 ImageData 반환
      expect(result.width).toBe(mockImageData.width);
      expect(result.height).toBe(mockImageData.height);
    });

    test('잘못된 필터 이름으로 적용 시도', () => {
      const filterOptions: FilterOptions = {
        name: 'non-existent-filter',
        params: {},
      };

      expect(() => {
        filterManager.applyFilter(mockImageData, filterOptions);
      }).toThrow("필터 'non-existent-filter'를 찾을 수 없습니다.");
    });

    test('잘못된 매개변수로 필터 적용', () => {
      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 150 }, // 범위 초과
      };

      expect(() => {
        filterManager.applyFilter(mockImageData, filterOptions);
      }).toThrow('필터 매개변수가 유효하지 않습니다');
    });

    test('투명도 적용', () => {
      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 20 },
        opacity: 0.5,
      };

      const result = filterManager.applyFilter(mockImageData, filterOptions);

      expect(result).toBeInstanceOf(ImageData);
    });

    test('블렌드 모드 적용', () => {
      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 20 },
        blend: BlendMode.MULTIPLY,
      };

      const result = filterManager.applyFilter(mockImageData, filterOptions);

      expect(result).toBeInstanceOf(ImageData);
    });
  });

  describe('필터 체인 적용', () => {
    beforeEach(() => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockContrastPlugin);
      filterManager.register(mockBlurPlugin);
    });

    test('기본 필터 체인 적용', () => {
      // Context7 베스트 프랙티스: vi.stubGlobal을 사용한 WSL 환경 Canvas API 모킹
      const filterChain: FilterChain = {
        filters: [
          { name: 'test-brightness', params: { value: 10 } },
          { name: 'test-contrast', params: { value: 15 } },
        ],
      };

      const result = filterManager.applyFilterChain(mockImageData, filterChain);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(mockImageData.width);
      expect(result.height).toBe(mockImageData.height);
    });

    test('빈 필터 체인 적용', () => {
      // Context7 베스트 프랙티스: vi.stubGlobal을 사용한 WSL 환경 Canvas API 모킹
      const filterChain: FilterChain = {
        filters: [],
      };

      const result = filterManager.applyFilterChain(mockImageData, filterChain);

      expect(result).toBeInstanceOf(ImageData);
      expect(result.width).toBe(mockImageData.width);
      expect(result.height).toBe(mockImageData.height);
    });

    test('일부 필터가 비활성화된 체인', () => {
      const filterChain: FilterChain = {
        filters: [
          { name: 'test-brightness', params: { value: 10 }, enabled: true },
          { name: 'test-contrast', params: { value: 15 }, enabled: false },
          { name: 'test-blur', params: { radius: 2 }, enabled: true },
        ],
      };

      const result = filterManager.applyFilterChain(mockImageData, filterChain);

      expect(result).toBeInstanceOf(ImageData);
    });

    test('최적화된 필터 체인', () => {
      const filterChain: FilterChain = {
        filters: [
          { name: 'test-brightness', params: { value: 10 } },
          { name: 'test-contrast', params: { value: 15 } },
        ],
        optimize: true,
      };

      const result = filterManager.applyFilterChain(mockImageData, filterChain);

      expect(result).toBeInstanceOf(ImageData);
    });

    test('복잡한 필터 체인 (블렌드 모드 포함)', () => {
      const filterChain: FilterChain = {
        filters: [
          {
            name: 'test-brightness',
            params: { value: 20 },
            opacity: 0.8,
            blend: BlendMode.NORMAL,
          },
          {
            name: 'test-blur',
            params: { radius: 1 },
            opacity: 0.5,
            blend: BlendMode.OVERLAY,
          },
        ],
      };

      const result = filterManager.applyFilterChain(mockImageData, filterChain);

      expect(result).toBeInstanceOf(ImageData);
    });
  });

  describe('필터 체인 유효성 검사', () => {
    beforeEach(() => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockBlurPlugin);
    });

    test('validateFilterChain 메서드 존재 확인', () => {
      // FilterPluginManager에 validateFilterChain 메서드가 있는지 확인
      expect(typeof (filterManager as any).validateFilterChain).toBe('function');
    });
  });

  describe('enum 값 검증', () => {
    test('FilterCategory enum 값', () => {
      expect(FilterCategory.COLOR).toBe('color');
      expect(FilterCategory.BLUR).toBe('blur');
      expect(FilterCategory.EFFECT).toBe('effect');
      expect(FilterCategory.ARTISTIC).toBe('artistic');
      expect(FilterCategory.CUSTOM).toBe('custom');
    });

    test('BlendMode enum 값', () => {
      expect(BlendMode.NORMAL).toBe('normal');
      expect(BlendMode.MULTIPLY).toBe('multiply');
      expect(BlendMode.OVERLAY).toBe('overlay');
      expect(BlendMode.SCREEN).toBe('screen');
    });
  });

  describe('필터 플러그인 기능 확장', () => {
    test('미리보기 기능', () => {
      // Context7 베스트 프랙티스: WSL 환경에서 모킹된 Canvas API로 테스트
      filterManager.register(mockBlurPlugin);

      const params = { radius: 3 };
      const previewResult = mockBlurPlugin.preview!(mockImageData, params);

      expect(previewResult).toBeInstanceOf(ImageData);
      expect(previewResult.width).toBe(2);
      expect(previewResult.height).toBe(2);
    });

    test('최적화 가능성 확인', () => {
      const canOptimize = mockContrastPlugin.canOptimizeWith!(mockBrightnessPlugin);

      expect(typeof canOptimize).toBe('boolean');
      expect(canOptimize).toBe(true); // 둘 다 COLOR 카테고리
    });

    test('다른 카테고리와 최적화 불가', () => {
      const canOptimize = mockContrastPlugin.canOptimizeWith!(mockBlurPlugin);

      expect(canOptimize).toBe(false); // BLUR 카테고리와는 최적화 불가
    });
  });

  describe('필터 매개변수 유효성 검사', () => {
    test('유효한 매개변수', () => {
      const validation = mockBrightnessPlugin.validate({ value: 50 });

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('유효하지 않은 매개변수', () => {
      const validation = mockBrightnessPlugin.validate({ value: 'invalid' as any });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('value must be a number');
    });

    test('범위를 벗어난 매개변수', () => {
      const validation = mockBlurPlugin.validate({ radius: -5 });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('radius must be non-negative');
    });

    test('기본 매개변수 사용', () => {
      const validation = mockBrightnessPlugin.validate(mockBrightnessPlugin.defaultParams);

      expect(validation.valid).toBe(true);
    });
  });

  describe('에러 처리 및 복구', () => {
    test('필터 적용 중 에러 발생', () => {
      const errorPlugin: FilterPlugin = {
        name: 'error-filter',
        category: FilterCategory.CUSTOM,
        defaultParams: {},
        validate: () => ({ valid: true }),
        apply: () => {
          throw new Error('Filter processing error');
        },
      };

      filterManager.register(errorPlugin);

      const filterOptions: FilterOptions = {
        name: 'error-filter',
        params: {},
      };

      expect(() => {
        filterManager.applyFilter(mockImageData, filterOptions);
      }).toThrow('Filter processing error');

      filterManager.unregister('error-filter');
    });

    test('잘못된 ImageData로 필터 적용', () => {
      filterManager.register(mockBrightnessPlugin);

      const filterOptions: FilterOptions = {
        name: 'test-brightness',
        params: { value: 10 },
      };

      // 잘못된 ImageData (너무 작은 데이터)
      const invalidImageData = new ImageData(new Uint8ClampedArray(4), 1, 1);

      // 이 경우도 정상적으로 처리되어야 함
      const result = filterManager.applyFilter(invalidImageData, filterOptions);
      expect(result).toBeInstanceOf(ImageData);
    });
  });

  describe('성능 및 메모리 관리', () => {
    test('대량 필터 체인 처리', () => {
      filterManager.register(mockBrightnessPlugin);
      filterManager.register(mockContrastPlugin);

      const largeFilterChain: FilterChain = {
        filters: Array.from({ length: 10 }, (_, i) => ({
          name: i % 2 === 0 ? 'test-brightness' : 'test-contrast',
          params: { value: i * 5 },
        })),
      };

      const startTime = performance.now();
      const result = filterManager.applyFilterChain(mockImageData, largeFilterChain);
      const endTime = performance.now();

      expect(result).toBeInstanceOf(ImageData);
      expect(endTime - startTime).toBeLessThan(100); // 100ms 이내
    });

    test('메모리 사용량 확인', () => {
      filterManager.register(mockBrightnessPlugin);

      const startMemory = process.memoryUsage().heapUsed;

      // 여러 번 필터 적용
      for (let i = 0; i < 50; i++) {
        filterManager.applyFilter(mockImageData, {
          name: 'test-brightness',
          params: { value: i },
        });
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // 메모리 증가량이 과도하지 않은지 확인 (10MB 이하)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
