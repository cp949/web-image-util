/**
 * SVGProcessor.addDimensionsToSVG()가 누락된 크기 정보만 추가하는지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { SVGProcessor } from '../../../src/utils/svg-processor';
import { SVG_NO_DIMS, SVG_WITH_VIEWBOX, SVG_WITH_WH } from './svg-processor.helpers';

describe('SVGProcessor.addDimensionsToSVG()', () => {
  it('크기 정보가 없는 SVG에 width·height·viewBox를 추가한다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_NO_DIMS, 120, 80);
    expect(result).toContain('width="120"');
    expect(result).toContain('height="80"');
    expect(result).toContain('viewBox="0 0 120 80"');
  });

  it('이미 width가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('width="100"');
    expect(result).not.toContain('width="999"');
  });

  it('이미 height가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('height="200"');
    expect(result).not.toContain('height="999"');
  });

  it('이미 viewBox가 있으면 덮어쓰지 않는다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_VIEWBOX, 999, 999);
    expect(result).toContain('viewBox="0 0 300 150"');
    expect(result).not.toContain('viewBox="0 0 999 999"');
  });

  it('svg 요소가 없는 문자열은 새 svg 래퍼로 감싼다', () => {
    const result = SVGProcessor.addDimensionsToSVG('not-svg-content', 50, 30);
    expect(result).toContain('<svg');
    expect(result).toContain('width="50"');
    expect(result).toContain('height="30"');
    expect(result).toContain('not-svg-content');
  });

  it('width·height만 있고 viewBox가 없는 SVG에 viewBox를 추가한다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_WH, 999, 999);
    expect(result).toContain('viewBox="0 0 999 999"');
  });

  it('viewBox만 있고 width·height가 없는 SVG에 width·height를 추가한다', () => {
    const result = SVGProcessor.addDimensionsToSVG(SVG_WITH_VIEWBOX, 400, 250);
    expect(result).toContain('width="400"');
    expect(result).toContain('height="250"');
    expect(result).toContain('viewBox="0 0 300 150"');
  });
});
