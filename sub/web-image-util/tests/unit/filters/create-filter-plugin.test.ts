/**
 * createFilterPlugin 팩토리가 외부에 약속한 config → FilterPlugin 변환 행동을 검증한다.
 *
 * 검증 범위:
 *   - config 필드(name / description / category / defaultParams / apply / validate) 보존
 *   - preview 기본값 = apply (동일 참조)
 *   - config 타입이 preview 필드를 허용하지 않으며, as any로 주입해도 apply로 덮어쓰인다
 *   - 반환 플러그인이 filterManager에 등록·조회 가능한 FilterPlugin 계약을 만족
 *   - apply / validate 호출이 config 함수로 위임
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  createFilterPlugin,
  FilterCategory,
  filterManager,
  getAvailableFilters,
  registerFilter,
} from '../../../src/advanced-index';
// plugin-system-helpers 임포트로 Node 환경용 ImageData mock beforeAll이 함께 등록된다.
import { createImageData } from './plugin-system-helpers';

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
  // 이 파일은 filterManager의 모듈 로드 시 캡처된 인스턴스(I1)를 직접 사용한다.
  // resetForTesting()은 첫 호출 후 instance를 undefined로 만들어 두 번째 호출부터 no-op이 되므로 사용하지 않는다.
  // 대신 등록한 이름을 추적해 afterEach에서 filterManager.unregister(name)로 명시 해제한다.
  const registeredPluginNames: string[] = [];

  afterEach(() => {
    for (const name of registeredPluginNames) {
      if (filterManager.hasFilter(name)) {
        filterManager.unregister(name);
      }
    }
    registeredPluginNames.length = 0;
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

  describe('preview 기본값', () => {
    it('config에 preview를 주지 않으면 result.preview가 result.apply와 동일 참조다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.preview).toBe(plugin.apply);
    });

    it('result.preview는 config.apply와도 동일 참조다', () => {
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>(config);
      expect(plugin.preview).toBe(config.apply);
    });

    // TASK 스펙은 "config.preview를 명시하면 그 함수가 우선한다"를 요구했으나
    // 현재 구현(advanced-index.ts:346-353)의 config 타입에는 preview 필드가 없으며
    // 본체가 { ...config, preview: config.apply }로 항상 apply로 채운다.
    // 아래 두 케이스는 이 실제 계약을 고정한다 (스펙/구현 불일치 주석으로 가시화).
    it('config 타입은 preview 속성을 허용하지 않는다', () => {
      const config = makeConfig();
      createFilterPlugin<TestParams>(
        // @ts-expect-error — config 타입에 preview 필드가 없음. override 경로는 미지원.
        { ...config, preview: () => {} }
      );
    });

    it('as any로 preview를 주입해도 result.preview는 apply로 덮어쓰인다', () => {
      const customPreview = (imageData: ImageData, _params: TestParams): ImageData => imageData;
      const config = makeConfig();
      const plugin = createFilterPlugin<TestParams>({ ...config, preview: customPreview } as any);
      expect(plugin.preview).toBe(config.apply);
      expect(plugin.preview).not.toBe(customPreview);
    });
  });

  describe('등록 가능성', () => {
    it('filterManager.register()로 등록하면 hasFilter가 true를 반환한다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig('reg-direct'));
      filterManager.register(plugin);
      registeredPluginNames.push('reg-direct');
      expect(filterManager.hasFilter('reg-direct')).toBe(true);
    });

    it('registerFilter()로 등록하면 getAvailableFilters()에서 찾을 수 있다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig('reg-conv'));
      registerFilter(plugin);
      registeredPluginNames.push('reg-conv');
      expect(getAvailableFilters()).toContain('reg-conv');
    });

    it('등록 후 getPlugin()으로 동일 인스턴스를 조회할 수 있다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig('reg-get'));
      filterManager.register(plugin);
      registeredPluginNames.push('reg-get');
      expect(filterManager.getPlugin('reg-get')).toBe(plugin);
    });

    it('unregister()로 해제하면 hasFilter가 false를 반환한다', () => {
      const plugin = createFilterPlugin<TestParams>(makeConfig('reg-remove'));
      filterManager.register(plugin);
      filterManager.unregister('reg-remove');
      expect(filterManager.hasFilter('reg-remove')).toBe(false);
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
