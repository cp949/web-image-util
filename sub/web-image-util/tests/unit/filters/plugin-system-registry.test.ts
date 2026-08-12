/**
 * plugin-system의 레지스트리 등록·조회 계약을 검증한다.
 *
 * 레지스트리는 모듈 private 상태 하나뿐이므로, 등록 함수와 조회 함수가
 * 항상 같은 레지스트리를 본다는 것이 이 파일의 핵심 계약이다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFilter,
  getAvailableFilters,
  getMissingFilterNames,
  hasFilter,
  registerFilter,
} from '../../../src/filters/plugin-system';
import { createDummyPlugin, createImageData, resetFilterRegistry } from './plugin-system-helpers';

describe('필터 레지스트리', () => {
  afterEach(() => {
    resetFilterRegistry();
  });

  describe('registerFilter', () => {
    it('등록하면 hasFilter가 true를 반환한다', () => {
      registerFilter(createDummyPlugin('test-plugin'));
      expect(hasFilter('test-plugin')).toBe(true);
    });

    it('같은 이름을 다시 등록하면 새 플러그인이 적용된다', () => {
      registerFilter(createDummyPlugin('dup'));
      registerFilter({
        ...createDummyPlugin('dup'),
        apply: (imageData: ImageData) => imageData,
      });

      const result = applyFilter(createImageData(1, 1, [10, 10, 10, 255]), {
        name: 'dup',
        params: { value: 50 },
      });
      // 덮어쓴 플러그인은 입력을 그대로 반환하므로 value가 반영되지 않는다.
      expect(result.data[0]).toBe(10);
    });
  });

  describe('조회', () => {
    it('getAvailableFilters는 등록된 필터 이름 목록을 반환한다', () => {
      registerFilter(createDummyPlugin('f1'));
      registerFilter(createDummyPlugin('f2'));
      const names = getAvailableFilters();
      expect(names).toContain('f1');
      expect(names).toContain('f2');
    });

    it('hasFilter는 미등록 필터에 false를 반환한다', () => {
      expect(hasFilter('missing')).toBe(false);
    });
  });

  describe('getMissingFilterNames', () => {
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

  describe('레지스트리 단일성', () => {
    it('초기화 직후 등록한 필터를 모든 조회·적용 경로가 함께 본다', () => {
      resetFilterRegistry();
      registerFilter(createDummyPlugin('single-registry'));

      expect(hasFilter('single-registry')).toBe(true);
      expect(getAvailableFilters()).toContain('single-registry');
      expect(getMissingFilterNames([{ name: 'single-registry' }])).toEqual([]);
      expect(
        applyFilter(createImageData(1, 1, [0, 0, 0, 255]), { name: 'single-registry', params: { value: 7 } }).data[0]
      ).toBe(7);
    });

    it('초기화하면 등록된 필터가 모두 사라진다', () => {
      registerFilter(createDummyPlugin('to-be-cleared'));
      resetFilterRegistry();
      expect(getAvailableFilters()).toEqual([]);
    });
  });
});
