/**
 * plugin-system 모듈의 편의 함수가 공유 filterManager에 위임하는지 검증한다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  applyFilter,
  applyFilterChain,
  FilterPluginManager,
  filterManager,
  getAvailableFilters,
  getMissingFilterNames,
  registerFilter,
} from '../../../src/filters/plugin-system';
import { createDummyPlugin, createImageData } from './plugin-system-helpers';

describe('plugin-system 편의 함수', () => {
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
