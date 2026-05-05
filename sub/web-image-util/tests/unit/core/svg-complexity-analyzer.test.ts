import { describe, expect, it, vi } from 'vitest';
import { analyzeSvgComplexity } from '../../../src/core/svg-complexity-analyzer';

const createSvg = (content = '') => `<svg xmlns="http://www.w3.org/2000/svg">${content}</svg>`;

const createPaths = (count: number) =>
  Array.from({ length: count }, (_, index) => `<path id="p${index}" d="M0 0L1 1"/>`).join('');

describe('analyzeSvgComplexity()', () => {
  describe('metrics 수집', () => {
    it('빈 SVG의 metric은 루트 요소 외에 복잡도 요소가 없다', () => {
      const result = analyzeSvgComplexity(createSvg());

      expect(result.metrics).toMatchObject({
        pathCount: 0,
        gradientCount: 0,
        filterCount: 0,
        animationCount: 0,
        textElementCount: 0,
        hasClipPath: false,
        hasMask: false,
      });
      expect(result.metrics.totalElementCount).toBe(1);
    });

    it('path 요소 수를 정확히 센다', () => {
      const result = analyzeSvgComplexity(createSvg(createPaths(3)));

      expect(result.metrics.pathCount).toBe(3);
    });

    it('linearGradient와 radialGradient를 모두 센다', () => {
      const result = analyzeSvgComplexity(createSvg('<defs><linearGradient id="l"/><radialGradient id="r"/></defs>'));

      expect(result.metrics.gradientCount).toBe(2);
    });

    it('filter 요소 수를 정확히 센다', () => {
      const result = analyzeSvgComplexity(createSvg('<defs><filter id="a"/><filter id="b"/><filter id="c"/></defs>'));

      expect(result.metrics.filterCount).toBe(3);
    });

    it('animate, animateTransform, animateMotion을 모두 센다', () => {
      const result = analyzeSvgComplexity(createSvg('<animate/><animateTransform/><animateMotion/>'));

      expect(result.metrics.animationCount).toBe(3);
    });

    it('text와 tspan을 모두 센다', () => {
      const result = analyzeSvgComplexity(createSvg('<text>hello<tspan>world</tspan></text>'));

      expect(result.metrics.textElementCount).toBe(2);
    });

    it('clipPath 존재 여부를 감지한다', () => {
      const result = analyzeSvgComplexity(createSvg('<defs><clipPath id="clip"><rect/></clipPath></defs>'));

      expect(result.metrics.hasClipPath).toBe(true);
    });

    it('mask 존재 여부를 감지한다', () => {
      const result = analyzeSvgComplexity(createSvg('<defs><mask id="mask"><rect/></mask></defs>'));

      expect(result.metrics.hasMask).toBe(true);
    });

    it('fileSize는 SVG 문자열 바이트 수와 일치한다', () => {
      const svg = createSvg('<rect width="10" height="10"/>');
      const result = analyzeSvgComplexity(svg);

      expect(result.metrics.fileSize).toBe(new Blob([svg]).size);
    });
  });

  describe('복잡도 점수', () => {
    it('빈 SVG의 complexityScore는 0에 가깝다', () => {
      const result = analyzeSvgComplexity(createSvg());

      expect(result.complexityScore).toBe(0);
      expect(result.recommendedQuality).toBe('low');
    });

    it('complexityScore는 항상 0.0~1.0 범위이다', () => {
      const result = analyzeSvgComplexity(
        createSvg(`
          <defs>
            ${Array.from({ length: 10 }, (_, index) => `<filter id="f${index}"/>`).join('')}
            ${Array.from({ length: 10 }, (_, index) => `<linearGradient id="g${index}"/>`).join('')}
            <clipPath id="clip"><rect/></clipPath>
            <mask id="mask"><rect/></mask>
          </defs>
          ${createPaths(100)}
          ${Array.from({ length: 10 }, () => '<animate attributeName="opacity"/>').join('')}
          ${Array.from({ length: 10 }, () => '<text>label</text>').join('')}
        `)
      );

      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(1);
    });

    it('path 요소가 많을수록 score가 증가한다', () => {
      const singlePath = analyzeSvgComplexity(createSvg(createPaths(1)));
      const manyPaths = analyzeSvgComplexity(createSvg(createPaths(10)));

      expect(singlePath.complexityScore).toBeGreaterThan(analyzeSvgComplexity(createSvg()).complexityScore);
      expect(singlePath.reasoning.length).toBeGreaterThan(0);
      expect(manyPaths.complexityScore).toBeGreaterThan(singlePath.complexityScore);
    });

    it('gradient 요소가 있으면 score가 증가한다', () => {
      const empty = analyzeSvgComplexity(createSvg());
      const gradient = analyzeSvgComplexity(createSvg('<defs><linearGradient id="g"/></defs>'));

      expect(gradient.complexityScore).toBeGreaterThan(empty.complexityScore);
    });

    it('animation 요소가 있으면 score가 증가한다', () => {
      const empty = analyzeSvgComplexity(createSvg());
      const animation = analyzeSvgComplexity(createSvg('<animate attributeName="opacity"/>'));

      expect(animation.complexityScore).toBeGreaterThan(empty.complexityScore);
    });

    it('filter 요소는 단일 요소 기준 가장 높은 가중치를 갖는다', () => {
      const path = analyzeSvgComplexity(createSvg('<path d="M0 0"/>'));
      const gradient = analyzeSvgComplexity(createSvg('<defs><linearGradient id="g"/></defs>'));
      const filter = analyzeSvgComplexity(createSvg('<defs><filter id="f"/></defs>'));

      expect(filter.complexityScore).toBeGreaterThan(gradient.complexityScore);
      expect(gradient.complexityScore).toBeGreaterThan(path.complexityScore);
    });

    it('path 가중치에 상한(0.3)이 적용된다', () => {
      const cappedPaths = analyzeSvgComplexity(createSvg(createPaths(15)));
      const morePaths = analyzeSvgComplexity(createSvg(createPaths(30)));

      expect(cappedPaths.complexityScore).toBeCloseTo(0.3);
      expect(morePaths.complexityScore).toBe(cappedPaths.complexityScore);
    });
  });

  describe('품질 레벨 추천', () => {
    it('단순 SVG는 low 또는 medium을 추천한다', () => {
      const result = analyzeSvgComplexity(createSvg('<rect width="10" height="10"/>'));

      expect(['low', 'medium']).toContain(result.recommendedQuality);
    });

    it('filter 포함 SVG는 high 이상을 추천한다', () => {
      const result = analyzeSvgComplexity(createSvg('<defs><filter id="f"/></defs>'));

      expect(['high', 'ultra']).toContain(result.recommendedQuality);
    });

    it('복잡한 SVG는 ultra를 추천할 수 있다', () => {
      const result = analyzeSvgComplexity(
        createSvg(`
          <defs>
            ${Array.from({ length: 4 }, (_, index) => `<filter id="f${index}"/>`).join('')}
            ${Array.from({ length: 4 }, (_, index) => `<linearGradient id="g${index}"/>`).join('')}
            <clipPath id="clip"><rect/></clipPath>
            <mask id="mask"><rect/></mask>
          </defs>
          ${createPaths(20)}
          ${Array.from({ length: 5 }, () => '<animate attributeName="opacity"/>').join('')}
          ${Array.from({ length: 5 }, () => '<text>label</text>').join('')}
        `)
      );

      expect(result.complexityScore).toBeGreaterThanOrEqual(0.8);
      expect(result.recommendedQuality).toBe('ultra');
    });
  });

  describe('reasoning', () => {
    it('reasoning은 비어 있지 않은 배열이다', () => {
      const result = analyzeSvgComplexity(createSvg());

      expect(Array.isArray(result.reasoning)).toBe(true);
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('복잡도 요소가 있으면 해당 항목이 reasoning에 포함된다', () => {
      const result = analyzeSvgComplexity(
        createSvg(`
          <defs>
            <filter id="f"/>
            <linearGradient id="g"/>
            <clipPath id="clip"><rect/></clipPath>
            <mask id="mask"><rect/></mask>
          </defs>
          ${createPaths(11)}
          <animate attributeName="opacity"/>
        `)
      );

      expect(result.reasoning).toEqual(
        expect.arrayContaining([
          expect.stringContaining('path'),
          expect.stringContaining('Gradient'),
          expect.stringContaining('Filter'),
          expect.stringContaining('Clipping'),
          expect.stringContaining('Masks'),
          expect.stringContaining('Animation'),
        ])
      );
    });
  });

  describe('폴백 동작', () => {
    it('잘못된 SVG를 던져도 Error를 throw하지 않는다', () => {
      expect(() => analyzeSvgComplexity('<svg><path></svg')).not.toThrow();
    });

    it('폴백 결과는 metrics, complexityScore, recommendedQuality, reasoning을 포함한다', () => {
      const originalDOMParser = globalThis.DOMParser;
      const invalidSvg = 'not an svg at all';
      vi.stubGlobal(
        'DOMParser',
        class {
          parseFromString() {
            throw new Error('forced parser failure');
          }
        }
      );

      try {
        const result = analyzeSvgComplexity(invalidSvg);

        expect(result.metrics).toEqual({
          pathCount: 0,
          gradientCount: 0,
          filterCount: 0,
          animationCount: 0,
          textElementCount: 0,
          totalElementCount: 0,
          hasClipPath: false,
          hasMask: false,
          fileSize: new Blob([invalidSvg]).size,
        });
        expect(result.complexityScore).toBe(0.5);
        expect(result.recommendedQuality).toBe('medium');
        expect(result.reasoning).toEqual(expect.arrayContaining([expect.stringContaining('analysis failure')]));
        expect(result.reasoning.length).toBeGreaterThanOrEqual(2);
      } finally {
        vi.stubGlobal('DOMParser', originalDOMParser);
      }
    });
  });
});
