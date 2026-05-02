import type { Config } from 'dompurify';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  SanitizeSvgStrictDetailedResult,
  StrictSvgSanitizerOptions,
  sanitizeSvgStrictDetailed,
} from '../../../src/svg-sanitizer';

describe('strict SVG sanitizer 타입 계약', () => {
  it('domPurifyConfig는 DOMPurify Config 타입으로 노출된다', () => {
    const domPurifyConfig: Config = {
      FORBID_TAGS: ['animate'],
    };

    const options: StrictSvgSanitizerOptions = {
      maxBytes: 1024,
      maxNodeCount: 100,
      removeMetadata: true,
      domPurifyConfig,
    };

    expectTypeOf(options.domPurifyConfig).toEqualTypeOf<Config | undefined>();
    expect(options.domPurifyConfig).toBe(domPurifyConfig);
  });

  it('sanitizeSvgStrictDetailed 반환 타입명과 필드 타입이 유지된다', () => {
    type DetailedReturn = ReturnType<typeof sanitizeSvgStrictDetailed>;

    expectTypeOf<DetailedReturn>().toEqualTypeOf<SanitizeSvgStrictDetailedResult>();
    expectTypeOf<DetailedReturn['svg']>().toEqualTypeOf<string>();
    expectTypeOf<DetailedReturn['warnings']>().toEqualTypeOf<string[]>();
  });
});
