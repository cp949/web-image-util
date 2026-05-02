/**
 * SVG 호환성 보정 유틸리티의 회귀 동작을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { enhanceBrowserCompatibility } from '../../../src/utils/svg-compatibility';

describe('SVG 호환성 보정', () => {
  it('xlink:href만 있는 참조를 href로 현대화하고 legacy 속성을 제거한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon"/></svg>';

    const result = enhanceBrowserCompatibility(svg, {
      addNamespaces: false,
      fixDimensions: false,
      addPreserveAspectRatio: false,
    });

    expect(result.enhancedSvg).toContain('href="#icon"');
    expect(result.enhancedSvg).not.toContain('xlink:href=');
    expect(result.report.modernizedSyntax).toBe(1);
  });

  it('href가 이미 있으면 href 값을 보존하고 xlink:href만 제거한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#modern" xlink:href="#legacy"/></svg>';

    const result = enhanceBrowserCompatibility(svg, {
      addNamespaces: false,
      fixDimensions: false,
      addPreserveAspectRatio: false,
    });

    expect(result.enhancedSvg).toContain('href="#modern"');
    expect(result.enhancedSvg).not.toContain('href="#legacy"');
    expect(result.enhancedSvg).not.toContain('xlink:href=');
    expect(result.report.modernizedSyntax).toBe(1);
  });
});
