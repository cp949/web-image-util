/**
 * FilterPluginManager의 등록, 해제, 조회 책임을 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { FilterCategory, FilterPluginManager } from '../../../src/filters/plugin-system';
import { createDummyPlugin } from './plugin-system-helpers';

describe('FilterPluginManager 등록과 조회', () => {
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
