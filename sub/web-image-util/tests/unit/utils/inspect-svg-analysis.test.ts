import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeSvgComplexity } from '../../../src/core/svg-complexity-analyzer';
import { inspectSvg } from '../../../src/utils/inspect-svg';

vi.mock('../../../src/core/svg-complexity-analyzer', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/core/svg-complexity-analyzer')>();
  return { ...actual, analyzeSvgComplexity: vi.fn().mockImplementation(actual.analyzeSvgComplexity) };
});

describe('inspectSvg() 분석 리포트', () => {
  describe('치수 분석 (dimensions)', () => {
    it('width/height/viewBox 모두 있는 SVG → explicit 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg width="200" height="100" viewBox="0 0 200 100"><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('explicit');
      expect(report.dimensions?.widthAttr.numeric).toBe(200);
      expect(report.dimensions?.widthAttr.unit).toBe('');
      expect(report.dimensions?.viewBox.parsed).toEqual({ x: 0, y: 0, width: 200, height: 100 });
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(false);
      expect(report.complexity).not.toBeNull();
    });

    it('viewBox만 있는 SVG → viewBox 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg viewBox="0 0 300 150"><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('viewBox');
      expect(report.dimensions?.effective.width).toBe(300);
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(false);
    });

    it('단위 포함 width/height → raw/numeric/unit 모두 정확하다', () => {
      const report = inspectSvg('<svg width="2em" height="1em"><rect/></svg>');
      expect(report.dimensions?.widthAttr.raw).toBe('2em');
      expect(report.dimensions?.widthAttr.numeric).toBe(2);
      expect(report.dimensions?.widthAttr.unit).toBe('em');
    });

    it('치수 정보 없는 SVG → fallback 분기가 올바르게 동작한다', () => {
      const report = inspectSvg('<svg><rect/></svg>');
      expect(report.dimensions?.effective.source).toBe('fallback');
      expect(report.dimensions?.effective.width).toBe(100);
      expect(report.findings.some((f) => f.code === 'dimensions-fallback')).toBe(true);
    });

    it('파싱 실패 경로 → dimensions === null', () => {
      const report = inspectSvg('<svg<<');
      expect(report.dimensions).toBeNull();
    });

    it('svg 루트 아닌 경우 → dimensions === null', () => {
      const report = inspectSvg('<html></html>');
      expect(report.dimensions).toBeNull();
    });
  });

  describe('복잡도 분석 (complexity)', () => {
    const FALLBACK_COMPLEXITY_RESULT = {
      metrics: {
        pathCount: 0,
        gradientCount: 0,
        filterCount: 0,
        animationCount: 0,
        textElementCount: 0,
        totalElementCount: 0,
        hasClipPath: false,
        hasMask: false,
        fileSize: 0,
      },
      complexityScore: 0.5,
      recommendedQuality: 'medium' as const,
      reasoning: ['Using default values due to analysis failure', 'Error: forced'],
    };

    afterEach(() => {
      vi.mocked(analyzeSvgComplexity).mockClear();
    });

    it('analyzeSvgComplexity fallback 반환 시 complexity === null이고 complexity-analysis-failed finding이 존재한다', () => {
      vi.mocked(analyzeSvgComplexity).mockReturnValueOnce(FALLBACK_COMPLEXITY_RESULT);
      const report = inspectSvg('<svg><rect/></svg>');
      expect(report.complexity).toBeNull();
      expect(report.findings.some((f) => f.code === 'complexity-analysis-failed')).toBe(true);
    });

    it('파싱 실패 경로 → analyzeSvgComplexity 호출 안 함', () => {
      inspectSvg('<svg<<');
      expect(vi.mocked(analyzeSvgComplexity)).not.toHaveBeenCalled();
    });
  });
});
