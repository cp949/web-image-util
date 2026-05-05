import { describe, expect, it } from 'vitest';

import { extractSvgDimensions } from '../../../src/utils/svg-dimensions';

// 테스트 픽스처
const SVG_WITH_SIZE = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200"></svg>';
const SVG_WITH_VIEWBOX = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
const SVG_WITH_BOTH = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 300 150"></svg>';
const SVG_NO_SIZE = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const SVG_PX_UNIT = '<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="200px"></svg>';
const NOT_SVG = '<html><body></body></html>';

describe('extractSvgDimensions()', () => {
  describe('width, height 명시', () => {
    it('width와 height 속성에서 크기를 추출한다', () => {
      const result = extractSvgDimensions(SVG_WITH_SIZE);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });

    it('hasExplicitSize가 true이다', () => {
      const result = extractSvgDimensions(SVG_WITH_SIZE);
      expect(result.hasExplicitSize).toBe(true);
    });
  });

  describe('viewBox만 있는 경우', () => {
    it('viewBox의 width, height를 크기로 사용한다', () => {
      const result = extractSvgDimensions(SVG_WITH_VIEWBOX);
      expect(result.width).toBe(300);
      expect(result.height).toBe(150);
    });

    it('hasExplicitSize가 false이다', () => {
      const result = extractSvgDimensions(SVG_WITH_VIEWBOX);
      expect(result.hasExplicitSize).toBe(false);
    });

    it('viewBox 객체가 올바르게 파싱된다', () => {
      const result = extractSvgDimensions(SVG_WITH_VIEWBOX);
      expect(result.viewBox).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });
  });

  describe('width, height, viewBox 모두 있는 경우', () => {
    it('명시적 width, height를 우선한다', () => {
      const result = extractSvgDimensions(SVG_WITH_BOTH);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
    });

    it('viewBox도 함께 반환한다', () => {
      const result = extractSvgDimensions(SVG_WITH_BOTH);
      expect(result.viewBox).toEqual({ x: 0, y: 0, width: 300, height: 150 });
    });

    it('hasExplicitSize가 true이다', () => {
      const result = extractSvgDimensions(SVG_WITH_BOTH);
      expect(result.hasExplicitSize).toBe(true);
    });
  });

  describe('단위가 포함된 값', () => {
    it('px 단위를 제거하고 숫자만 추출한다', () => {
      const result = extractSvgDimensions(SVG_PX_UNIT);
      expect(result.width).toBe(100);
      expect(result.height).toBe(200);
      expect(result.hasExplicitSize).toBe(true);
    });
  });

  describe('크기 정보가 없는 경우', () => {
    it('기본값 100×100을 반환한다', () => {
      const result = extractSvgDimensions(SVG_NO_SIZE);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('hasExplicitSize가 false이다', () => {
      const result = extractSvgDimensions(SVG_NO_SIZE);
      expect(result.hasExplicitSize).toBe(false);
    });
  });

  describe('잘못된 입력', () => {
    it('svg 요소가 없는 XML에서 Error를 throw한다', () => {
      expect(() => extractSvgDimensions(NOT_SVG)).toThrow('Invalid SVG');
    });
  });

  describe('viewBox 파싱', () => {
    it('유효하지 않은 viewBox 문자열은 undefined를 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="invalid"></svg>';
      const result = extractSvgDimensions(svg);
      expect(result.viewBox).toBeUndefined();
    });

    it('값이 정확히 4개가 아니면 undefined를 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100"></svg>';
      const result = extractSvgDimensions(svg);
      expect(result.viewBox).toBeUndefined();
    });
  });
});
