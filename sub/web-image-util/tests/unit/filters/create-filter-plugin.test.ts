/**
 * createFilterPlugin 팩토리가 외부에 약속한 config → FilterPlugin 변환 행동을 검증한다.
 *
 * 검증 범위:
 *   - config 필드(name / description / category / defaultParams / apply / validate) 보존
 *   - 반환 플러그인이 레지스트리에 등록·조회 가능한 FilterPlugin 계약을 만족
 *   - apply / validate 호출이 config 함수로 위임
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createFilterPlugin, FilterCategory, getAvailableFilters, registerFilter } from '../../../src/advanced-index';
// plugin-system-helpers 임포트로 Node 환경용 ImageData mock beforeAll이 함께 등록된다.
import { createImageData, resetFilterRegistry } from './plugin-system-helpers';

type TestParams = { intensity: number };

/** 테스트에서 공통으로 사용하는 최소 config를 생성한다. */
function makeConfig(name = 'test-plugin') {
  const applyFn = (imageData: ImageData, _params: TestParams): ImageData => imageData;
  const validateFn = (params: TestParams) => ({
    valid: params.intensity >= 0 && params.intensity <= 100,
    errors: params.intensity < 0 || params.intensity > 100 ? ['intensity out of range'] : undefined,
  });

  return {
    name,
    description: '테스트용 필터',
    category: FilterCategory.CUSTOM,
    defaultParams: { intensity: 50 } as TestParams,
    apply: applyFn,
    validate: validateFn,
  };
}

describe('createFilterPlugin 팩토리', () => {
  afterEach(() => {
    resetFilterRegistry();
  });

  describe('config 필드 전달', () => {
    it('name을 그대로 보유한다', () => {
      const config = makeConfig('my-filter');
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.name).toBe('my-filter');
    });

    it('description을 그대로 보유한다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.description).toBe('테스트용 필터');
    });

    it('category를 그대로 보유한다', () => {
      const config = { ...makeConfig(), category: FilterCategory.COLOR };
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.category).toBe(FilterCategory.COLOR);
    });

    it('defaultParams를 그대로 보유한다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.defaultParams).toBe(config.defaultParams);
    });

    it('apply를 그대로 보유한다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.apply).toBe(config.apply);
    });

    it('validate를 그대로 보유한다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.validate).toBe(config.validate);
    });
  });

  describe('등록 가능성', () => {
    it('registerFilter()로 등록하면 getAvailableFilters()에서 찾을 수 있다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig('reg-conv'));
      registerFilter(plugin);
      expect(getAvailableFilters()).toContain('reg-conv');
    });
  });

  describe('apply / validate 동작 도달', () => {
    it('result.apply 호출이 config.apply로 위임된다', () => {
      let called = false;
      const config = {
        ...makeConfig(),
        apply: (imageData: ImageData, _params: TestParams): ImageData => {
          called = true;
          return imageData;
        },
      };
      const plugin = createFilterPlugin<TestParams>(config);
      const input = createImageData(2, 2);
      plugin.apply(input, { intensity: 10 });
      expect(called).toBe(true);
    });

    it('result.validate가 valid boolean을 포함하는 객체를 반환한다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig());
      const result = plugin.validate({ intensity: 50 });
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
    });

    it('validate가 유효 파라미터에 valid:true를 반환한다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig());
      expect(plugin.validate({ intensity: 50 }).valid).toBe(true);
    });

    it('validate가 범위를 벗어난 파라미터에 valid:false를 반환한다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig());
      expect(plugin.validate({ intensity: 200 }).valid).toBe(false);
    });
  });
});
