/**
 * filters/plugins/index의 export 계약과 등록/환경 분기를 고정한다.
 *
 * - AllFilterPlugins: 카테고리 합산 배열, 이름 중복 없음
 * - registerDefaultFilters: 등록 실패 집계(catch)
 * - initializeFilterSystem: window 없는 환경의 global 노출 분기
 *
 * registerFilter spy와 window를 바꾸므로 매 테스트 후 복구한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import * as pluginSystem from '../../../src/filters/plugin-system';
import { AllFilterPlugins, initializeFilterSystem, registerDefaultFilters } from '../../../src/filters/plugins/index';
import { resetFilterRegistry } from './plugin-system-helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (typeof global !== 'undefined') {
    delete (global as { WebImageUtil?: unknown }).WebImageUtil;
  }
  if (typeof window !== 'undefined') {
    delete (window as { WebImageUtil?: unknown }).WebImageUtil;
  }
  resetFilterRegistry();
});

describe('AllFilterPlugins export 계약', () => {
  it('color/effect/blur 카테고리를 합쳐 중복 없는 배열로 노출한다', () => {
    expect(AllFilterPlugins.length).toBeGreaterThan(0);

    const names = AllFilterPlugins.map((plugin) => plugin.name);
    // 이름 충돌 없이 구성된다
    expect(new Set(names).size).toBe(names.length);

    const categories = new Set(AllFilterPlugins.map((plugin) => plugin.category));
    expect(categories.size).toBeGreaterThanOrEqual(1);
  });
});

describe('registerDefaultFilters 분기', () => {
  it('등록 중 예외는 failedCount로 집계하고 전체는 throw하지 않는다', () => {
    const spy = vi.spyOn(pluginSystem, 'registerFilter').mockImplementation(() => {
      throw new Error('register boom');
    });

    expect(() => registerDefaultFilters()).not.toThrow();
    expect(spy).toHaveBeenCalled();
    // 모두 실패했으므로 등록된 필터가 없다
    expect(pluginSystem.getAvailableFilters().length).toBe(0);
  });

  it('예외 없이 끝나면 기본 필터가 모두 등록된다', () => {
    registerDefaultFilters();

    const registered = pluginSystem.getAvailableFilters();
    expect(registered).toEqual(expect.arrayContaining(AllFilterPlugins.map((plugin) => plugin.name)));
  });
});

describe('initializeFilterSystem 환경 분기', () => {
  it('window가 없으면 global 객체에 filters를 노출한다', () => {
    vi.stubGlobal('window', undefined);

    initializeFilterSystem();

    const exposed = (global as { WebImageUtil?: { filters?: { register?: unknown } } }).WebImageUtil;
    expect(exposed?.filters).toBeDefined();
    expect(typeof exposed?.filters?.register).toBe('function');
  });
});
