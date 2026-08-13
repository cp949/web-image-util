import { describe, expect, it } from 'vitest';

import { sanitizeCssValue } from '../../../src/svg-sanitizer/css-policy.internal';
import { pushUniqueWarning } from '../../../src/svg-sanitizer/warnings.internal';

describe('strict sanitizer 내부 정책 파일', () => {
  it('internal 파일 경로에서 CSS와 경고 helper를 import할 수 있다', () => {
    expect(sanitizeCssValue('fill:url(#safe)')).toBe('fill:url(#safe)');
    expect(sanitizeCssValue('fill:url(https://evil.example/p.svg)')).toBe('fill:none');

    const warnings: string[] = [];
    pushUniqueWarning(warnings, '중복 경고');
    pushUniqueWarning(warnings, '중복 경고');

    expect(warnings).toEqual(['중복 경고']);
  });
});
