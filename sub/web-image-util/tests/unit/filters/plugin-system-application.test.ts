/**
 * FilterPluginManager가 필터를 적용하고 체인을 검증하는 동작을 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { BlendMode, FilterCategory, type FilterPlugin, FilterPluginManager } from '../../../src/filters/plugin-system';
import { createDummyPlugin, createImageData } from './plugin-system-helpers';

describe('FilterPluginManager 필터 적용', () => {
  afterEach(() => {
    FilterPluginManager.resetForTesting();
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
      const input = createImageData(1, 1, [200, 100, 50, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 0 },
        blend: BlendMode.MULTIPLY,
      });
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
      const r = 100 / 255;
      expect(result.data[0]).toBe(Math.round((1 - (1 - r) * (1 - r)) * 255));
    });

    it('BlendMode.OVERLAY로 블렌딩한다 (r1 < 0.5 케이스)', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
      const input = createImageData(1, 1, [100, 100, 100, 255]);
      const result = manager.applyFilter(input, {
        name: 'adder',
        params: { value: 0 },
        blend: BlendMode.OVERLAY,
      });
      const r = 100 / 255;
      expect(result.data[0]).toBe(Math.round(2 * r * r * 255));
    });

    it('opacity를 적용하면 원본과 필터 결과를 혼합한다', () => {
      const manager = FilterPluginManager.getInstance();
      manager.register(createDummyPlugin('adder'));
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
});
