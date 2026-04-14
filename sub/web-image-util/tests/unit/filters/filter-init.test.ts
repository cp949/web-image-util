/**
 * 필터 초기화 부작용 회귀 테스트
 *
 * @description 모듈 import 시 전역 상태가 오염되지 않고,
 * initializeFilterSystem() 호출 후에만 필터가 등록되는지 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { FilterPluginManager } from '../../../src/filters/plugin-system';
import { filterManager, initializeFilterSystem } from '../../../src/filters/plugins/index';

describe('필터 초기화 부작용 제거', () => {
  // 각 테스트 후 전역 상태 정리
  afterEach(() => {
    // Node.js 환경의 전역 WebImageUtil 제거
    if (typeof global !== 'undefined') {
      delete (global as any).WebImageUtil;
    }
    // filterManager 싱글톤 초기화 (테스트 격리)
    FilterPluginManager.resetForTesting();
  });

  it('모듈 import만으로 전역 객체가 오염되지 않는다', () => {
    // initializeFilterSystem()을 호출하지 않은 상태에서 전역 객체 확인
    expect((global as any).WebImageUtil).toBeUndefined();
  });

  it('initializeFilterSystem() 호출 전에는 필터가 등록되지 않는다', () => {
    // 호출 전에는 필터가 없어야 한다
    const beforeFilters = filterManager.getAvailableFilters();
    expect(beforeFilters.length).toBe(0);
  });

  it('initializeFilterSystem() 호출 후에만 필터가 등록된다', () => {
    // 명시적 초기화
    initializeFilterSystem();

    // 호출 후에는 필터가 등록되어 있어야 한다
    const afterFilters = filterManager.getAvailableFilters();
    expect(afterFilters.length).toBeGreaterThan(0);
  });

  it('initializeFilterSystem() 호출 후 전역 객체에 filters가 노출된다', () => {
    initializeFilterSystem();

    // Node.js 환경에서는 global.WebImageUtil이 설정되어야 한다
    expect((global as any).WebImageUtil).toBeDefined();
    expect((global as any).WebImageUtil.filters).toBeDefined();
    expect(typeof (global as any).WebImageUtil.filters.register).toBe('function');
  });

  it('중복 초기화 호출이 안전하다', () => {
    // 두 번 호출해도 에러가 발생하지 않아야 한다
    expect(() => {
      initializeFilterSystem();
      initializeFilterSystem();
    }).not.toThrow();

    // 중복 등록 후에도 필터 목록이 일관성 있어야 한다 (중복 없이)
    const filters = filterManager.getAvailableFilters();
    const uniqueFilters = new Set(filters);
    expect(filters.length).toBe(uniqueFilters.size);
  });
});
