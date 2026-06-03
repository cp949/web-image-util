/**
 * SVGProcessor.extractSVGDimensions()의 크기 추출 우선순위와 실패 분기를 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { SVGProcessor } from '../../../src/utils/svg-processor.internal';
import {
  BROKEN_XML,
  NOT_SVG,
  SVG_NO_DIMS,
  SVG_WITH_STYLE,
  SVG_WITH_VIEWBOX,
  SVG_WITH_WH,
  SVG_WITH_WH_PX,
} from './svg-processor.helpers';

describe('SVGProcessor.extractSVGDimensions()', () => {
  describe('width/height 속성 우선', () => {
    it('width와 height 속성 값을 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_WH);
      expect(result).toEqual({ width: 100, height: 200 });
    });

    it('px 단위가 붙은 width/height도 숫자로 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_WH_PX);
      expect(result).toEqual({ width: 100, height: 200 });
    });
  });

  describe('viewBox fallback', () => {
    it('width/height 없이 viewBox만 있으면 viewBox 크기를 반환한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_VIEWBOX);
      expect(result).toEqual({ width: 300, height: 150 });
    });

    it('viewBox 값이 4개 미만이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('viewBox 너비·높이가 0이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });
  });

  describe('style 속성 fallback', () => {
    it('width/height·viewBox 모두 없고 style에 px 크기가 있으면 추출한다', () => {
      const result = SVGProcessor.extractSVGDimensions(SVG_WITH_STYLE);
      expect(result).toEqual({ width: 80, height: 60 });
    });
  });

  describe('값이 0인 경우', () => {
    it('width/height가 0이면 viewBox 없을 때 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('width가 0이고 height만 양수이면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });
  });

  describe('크기 정보 없음', () => {
    it('width/height·viewBox·style 모두 없으면 null을 반환한다', () => {
      expect(SVGProcessor.extractSVGDimensions(SVG_NO_DIMS)).toBeNull();
    });

    it('svg 요소가 없는 HTML 문자열은 null을 반환한다', () => {
      expect(SVGProcessor.extractSVGDimensions(NOT_SVG)).toBeNull();
    });

    it('잘못된 XML 입력은 null을 반환한다', () => {
      expect(SVGProcessor.extractSVGDimensions(BROKEN_XML)).toBeNull();
    });
  });

  describe('상대 단위 처리', () => {
    it('width·height가 해석 불가 단위(auto)이고 viewBox가 없으면 null을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="auto" height="auto"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toBeNull();
    });

    it('width·height가 해석 불가 단위(auto)이고 viewBox가 있으면 viewBox 크기를 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="auto" height="auto" viewBox="0 0 200 100"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 200, height: 100 });
    });
  });

  describe('추출 우선순위', () => {
    it('width·height와 viewBox가 동시에 있으면 width·height 값을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="200" viewBox="0 0 500 300"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 100, height: 200 });
    });

    it('viewBox와 style이 동시에 있으면 viewBox 값을 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150" style="width:80px;height:60px"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 300, height: 150 });
    });
  });

  describe('한쪽 속성만 존재', () => {
    it('width만 있고 height가 없으면 viewBox로 폴스루해 viewBox 크기를 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" viewBox="0 0 50 50"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 50, height: 50 });
    });

    it('height만 있고 width가 없으면 viewBox로 폴스루해 viewBox 크기를 반환한다', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" height="200" viewBox="0 0 80 40"></svg>';
      expect(SVGProcessor.extractSVGDimensions(svg)).toEqual({ width: 80, height: 40 });
    });
  });
});
