/**
 * FilterPluginManager 핵심 플러그인 시스템 테스트
 *
 * @description 등록/해제/조회, 필터 적용(단일·체인), 블렌딩, 불투명도, 검증 등
 * FilterPluginManager의 전체 공개 인터페이스를 커버한다.
 */

import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  applyFilter,
  applyFilterChain,
  BlendMode,
  FilterCategory,
  type FilterPlugin,
  FilterPluginManager,
  filterManager,
  getAvailableFilters,
  getMissingFilterNames,
  registerFilter,
} from '../../../src/filters/plugin-system';

// Node 환경에서 ImageData 목을 설정한다.
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
function createImageData(
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
function createDummyPlugin(
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

describe('FilterPluginManager', () => {
  afterEach(() => {
    FilterPluginManager.resetForTesting();
  });

  describe('싱글턴', () => {
    it('getInstance()는 항상 동일한 인스턴스를 반환한다', () => {
      const a = FilterPluginManager.getInstance();
      const b = FilterPluginManager.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('register', () => {
    it('플러그인을 등록하면 hasFilter가 true를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('test-plugin'));
      expect(manager.hasFilter('test-plugin')).toBe(true);
    });

    it('중복 등록 시 기존 플러그인을 덮어쓴다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('dup'));
      const updated = { ...createDummyPlugin('dup'), description: 'v2' };
      manager.register(updated);
      expect(manager.getPlugin('dup')?.description).toBe('v2');
    });

    it('카테고리별 인덱스를 함께 갱신한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('blur-one', FilterCategory.BLUR));
      const blurPlugins = manager.getPluginsByCategory(FilterCategory.BLUR);
      expect(blurPlugins.some((p) => p.name === 'blur-one')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('등록된 플러그인을 해제하면 true를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('removable'));
      expect(manager.unregister('removable')).toBe(true);
      expect(manager.hasFilter('removable')).toBe(false);
    });

    it('미등록 플러그인 해제 시 false를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      expect(manager.unregister('non-existent')).toBe(false);
    });
  });

  describe('조회', () => {
    it('getPlugin은 등록된 플러그인을 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      const plugin = createDummyPlugin('queryable');
      manager.register(plugin);
      expect(manager.getPlugin('queryable')).toBe(plugin);
    });

    it('getPlugin은 미등록 플러그인에 undefined를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      expect(manager.getPlugin('missing')).toBeUndefined();
    });

    it('getAllPlugins는 전체 플러그인 배열을 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('p1'));
      manager.register(createDummyPlugin('p2'));
      expect(manager.getAllPlugins().length).toBe(2);
    });

    it('getPluginsByCategory는 해당 카테고리 플러그인만 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('color1', FilterCategory.COLOR));
      manager.register(createDummyPlugin('blur1', FilterCategory.BLUR));
      const colorPlugins = manager.getPluginsByCategory(FilterCategory.COLOR);
      expect(colorPlugins.length).toBe(1);
      expect(colorPlugins[0].name).toBe('color1');
    });

    it('getPluginsByCategory는 없는 카테고리에 빈 배열을 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      expect(manager.getPluginsByCategory(FilterCategory.ARTISTIC)).toEqual([]);
    });

    it('getAvailableFilters는 등록된 필터 이름 목록을 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('f1'));
      manager.register(createDummyPlugin('f2'));
      const names = manager.getAvailableFilters();
      expect(names).toContain('f1');
      expect(names).toContain('f2');
    });
  });

  describe('applyFilter', () => {
    it('필터를 적용하면 변환된 ImageData를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(2, 2, [100, 50, 25, 255]);
      const result = manager.applyFilter(input, { name: 'adder', params: { value: 10 } });
      expect(result.data[0]).toBe(110);
    });

    it('미등록 필터 적용 시 에러를 던진다', () => {
      const manager = FilterPluginManager.getInstance();
      expect(() => manager.applyFilter(createImageData(2, 2), { name: 'missing', params: {} })).toThrow("'missing'");
    });

    it('enabled=false이면 원본을 복사해 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(2, 2, [100, 50, 25, 255]);
      const result = manager.applyFilter(input, { name: 'adder', params: { value: 50 }, enabled: false });
      expect(result.data[0]).toBe(100);
    });

    it('파라미터 검증 실패 시 에러를 던진다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      expect(() => manager.applyFilter(createImageData(2, 2), { name: 'adder', params: { value: 999 } })).toThrow(
        'invalid'
      );
    });

    it('BlendMode.MULTIPLY로 블렌딩한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      // value=0 → 필터 결과 = 원본
      const input = createImageData(1, 1, [200, 100, 50, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 0 },
        blend: BlendMode.MULTIPLY,
      });
      // MULTIPLY: r1 * r2 * 255 (r1=r2=200/255)
      const r = 200 / 255;
      expect(result.data[0]).toBe(Math.round(r * r * 255));
    });

    it('BlendMode.SCREEN으로 블렌딩한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(1, 1, [100, 100, 100, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 0 },
        blend: BlendMode.SCREEN,
      });
      // SCREEN: 1 - (1-r1)(1-r2)
      const r = 100 / 255;
      expect(result.data[0]).toBe(Math.round((1 - (1 - r) * (1 - r)) * 255));
    });

    it('BlendMode.OVERLAY로 블렌딩한다 (r1 < 0.5 케이스)', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      // 100/255 ≈ 0.392 < 0.5
      const input = createImageData(1, 1, [100, 100, 100, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 0 },
        blend: BlendMode.OVERLAY,
      });
      // OVERLAY (r1 < 0.5): 2 * r1 * r2
      const r = 100 / 255;
      expect(result.data[0]).toBe(Math.round(2 * r * r * 255));
    });

    it('opacity를 적용하면 원본과 필터 결과를 혼합한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      // 원본 R=0, 필터 R=100, opacity=0.5 → 결과 R=50
      const input = createImageData(1, 1, [0, 0, 0, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 100 },
        opacity: 0.5,
      });
      expect(result.data[0]).toBe(50);
    });
  });

  describe('applyFilterChain', () => {
    it('여러 필터를 순서대로 적용한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(1, 1, [0, 0, 0, 255]);
      const result = manager.applyFilterChain(input, {
        filters: [
          { name: 'adder', params: { value: 10 } },
          { name: 'adder', params: { value: 20 } },
        ],
      });
      expect(result.data[0]).toBe(30);
    });

    it('enabled=false인 필터는 건너뛴다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(1, 1, [0, 0, 0, 255]);
      const result = manager.applyFilterChain(input, {
        filters: [
          { name: 'adder', params: { value: 10 } },
          { name: 'adder', params: { value: 99 }, enabled: false },
        ],
      });
      expect(result.data[0]).toBe(10);
    });

    it('optimize:true 옵션이 에러 없이 동작한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('c1', FilterCategory.COLOR));
      manager.register(createDummyPlugin('b1', FilterCategory.BLUR));
      const input = createImageData(1, 1, [0, 0, 0, 255]);
      expect(() =>
        manager.applyFilterChain(input, {
          filters: [
            { name: 'c1', params: { value: 5 } },
            { name: 'b1', params: { value: 5 } },
            { name: 'c1', params: { value: 5 } },
          ],
          optimize: true,
        })
      ).not.toThrow();
    });
  });

  describe('validateFilterChain', () => {
    it('유효한 체인은 valid:true를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('v-filter'));
      const result = manager.validateFilterChain({
        filters: [{ name: 'v-filter', params: { value: 10 } }],
      });
      expect(result.valid).toBe(true);
    });

    it('미등록 필터가 포함되면 valid:false와 errors를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      const result = manager.validateFilterChain({
        filters: [{ name: 'missing', params: {} }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('파라미터 오류가 있으면 valid:false를 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('v-filter'));
      const result = manager.validateFilterChain({
        filters: [{ name: 'v-filter', params: { value: 999 } }],
      });
      expect(result.valid).toBe(false);
    });

    it('경고가 있으면 warnings 필드를 포함한다', () => {
      const pluginWithWarnings: FilterPlugin<{ x: number }> = {
        name: 'warn-plugin',
        category: FilterCategory.EFFECT,
        defaultParams: { x: 0 },
        apply: (imageData: ImageData) => imageData,
        validate: () => ({ valid: true, warnings: ['테스트 경고'] }),
      };
      const manager = FilterPluginManager.getInstance();
      manager.register(pluginWithWarnings);
      const result = manager.validateFilterChain({
        filters: [{ name: 'warn-plugin', params: { x: 0 } }],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('getSystemInfo', () => {
    it('등록된 플러그인 수, 카테고리 정보, 플러그인 목록을 반환한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('s1', FilterCategory.COLOR));
      manager.register(createDummyPlugin('s2', FilterCategory.BLUR));
      const info = manager.getSystemInfo();
      expect(info.totalPlugins).toBe(2);
      expect(info.categories).toBeDefined();
      expect(info.plugins.length).toBe(2);
    });
  });
});

describe('편의 함수', () => {
  afterEach(() => {
    FilterPluginManager.resetForTesting();
  });

  it('registerFilter는 filterManager에 플러그인을 등록한다', () => {
    registerFilter(createDummyPlugin('conv-reg'));
    expect(filterManager.hasFilter('conv-reg')).toBe(true);
  });

  it('applyFilter는 filterManager.applyFilter에 위임한다', () => {
    registerFilter(createDummyPlugin('conv-apply'));
    const input = createImageData(1, 1, [0, 0, 0, 255]);
    const result = applyFilter(input, { name: 'conv-apply', params: { value: 50 } });
    expect(result.data[0]).toBe(50);
  });

  it('applyFilterChain은 filterManager.applyFilterChain에 위임한다', () => {
    registerFilter(createDummyPlugin('conv-chain'));
    const input = createImageData(1, 1, [0, 0, 0, 255]);
    const result = applyFilterChain(input, {
      filters: [{ name: 'conv-chain', params: { value: 30 } }],
    });
    expect(result.data[0]).toBe(30);
  });

  it('getAvailableFilters는 등록된 필터 이름을 반환한다', () => {
    registerFilter(createDummyPlugin('conv-list'));
    expect(getAvailableFilters()).toContain('conv-list');
  });
});

describe('getMissingFilterNames', () => {
  afterEach(() => {
    FilterPluginManager.resetForTesting();
  });

  it('등록되지 않은 필터 이름만 반환한다', () => {
    registerFilter(createDummyPlugin('existing'));
    const missing = getMissingFilterNames([{ name: 'existing' }, { name: 'missing-one' }]);
    expect(missing).toEqual(['missing-one']);
  });

  it('enabled=false인 필터는 검사에서 제외한다', () => {
    const missing = getMissingFilterNames([{ name: 'not-registered', enabled: false }]);
    expect(missing).toEqual([]);
  });

  it('모든 필터가 등록되어 있으면 빈 배열을 반환한다', () => {
    registerFilter(createDummyPlugin('all-present'));
    const missing = getMissingFilterNames([{ name: 'all-present' }]);
    expect(missing).toEqual([]);
  });
});
