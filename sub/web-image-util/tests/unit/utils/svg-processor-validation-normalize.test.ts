/**
 * SVGProcessor의 SVG 유효성 검사와 normalizeSVG 위임 계약을 검증한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { enhanceSvgForBrowser } from '../../../src/utils/svg-compatibility';
import { SVGProcessor } from '../../../src/utils/svg-processor';
import { BROKEN_XML, NOT_SVG, VALID_SVG } from './svg-processor.helpers';

vi.mock('../../../src/utils/svg-compatibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/svg-compatibility')>();
  return {
    ...actual,
    enhanceSvgForBrowser: vi.fn(actual.enhanceSvgForBrowser),
  };
});

describe('SVGProcessor.isValidSVG()', () => {
  it('정상 SVG는 true를 반환한다', () => {
    expect(SVGProcessor.isValidSVG(VALID_SVG)).toBe(true);
  });

  it('xmlns 없는 최소 SVG도 true를 반환한다', () => {
    expect(SVGProcessor.isValidSVG('<svg></svg>')).toBe(true);
  });

  it('svg 요소가 없는 HTML 문자열은 false를 반환한다', () => {
    expect(SVGProcessor.isValidSVG(NOT_SVG)).toBe(false);
  });

  it('명확히 깨진 XML 입력은 false를 반환한다', () => {
    expect(SVGProcessor.isValidSVG(BROKEN_XML)).toBe(false);
  });

  it('빈 문자열은 false를 반환한다', () => {
    expect(SVGProcessor.isValidSVG('')).toBe(false);
  });
});

describe('SVGProcessor.normalizeSVG()', () => {
  it('결과가 문자열이다', () => {
    expect(typeof SVGProcessor.normalizeSVG(VALID_SVG)).toBe('string');
  });

  it('정상 SVG에 SVG 네임스페이스를 보존한다', () => {
    const result = SVGProcessor.normalizeSVG(VALID_SVG);
    expect(result).toContain('http://www.w3.org/2000/svg');
  });

  it('비어 있지 않은 결과를 반환한다', () => {
    expect(SVGProcessor.normalizeSVG(VALID_SVG).length).toBeGreaterThan(0);
  });

  it('enhanceSvgForBrowser를 입력 SVG 문자열로 호출한다', () => {
    vi.mocked(enhanceSvgForBrowser).mockClear();
    SVGProcessor.normalizeSVG(VALID_SVG);
    expect(vi.mocked(enhanceSvgForBrowser)).toHaveBeenCalledWith(VALID_SVG);
  });
});
