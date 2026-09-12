import { describe, expect, it, vi } from 'vitest';
import { HighResolutionDetector } from '../../../src/base/high-res-detector.internal';
import { HighResolutionProcessor } from '../../../src/core/high-res-processor';
import { createDrawableImage, createMockImage } from './high-res-processor.helpers';

describe('HighResolutionProcessor.validate', () => {
  it('일반적인 크기의 이미지는 canProcess 가 true 다', () => {
    const img = createDrawableImage(1000, 1000);
    const result = HighResolutionProcessor.validate(img, 400, 300);

    expect(result.canProcess).toBe(true);
  });

  it('극단적으로 큰 이미지는 canProcess 가 false 다', () => {
    const img = createMockImage(40000, 40000);
    const result = HighResolutionProcessor.validate(img, 400, 300);

    expect(result.canProcess).toBe(false);
  });

  it('예상 메모리가 512MB 를 넘으면 warnings 에 메모리 경고가 포함된다', () => {
    const img = createMockImage(12000, 12000);
    const result = HighResolutionProcessor.validate(img, 400, 300);

    expect(result.warnings.some((w) => w.includes('memory'))).toBe(true);
  });

  it('예상 처리시간이 timeWarningThreshold 를 넘으면 fast 를 권장하는 문구가 포함된다', () => {
    const img = createMockImage(9000, 9000);
    const result = HighResolutionProcessor.validate(img, 400, 300, { thresholds: { timeWarningThreshold: 0.01 } });

    expect(result.recommendations.some((r) => r.includes('"fast"'))).toBe(true);
  });

  it('analyzeImage 는 정확히 한 번만 호출된다(옛 3중 호출 회귀 방지)', () => {
    const analyzeSpy = vi.spyOn(HighResolutionDetector, 'analyzeImage');
    const img = createDrawableImage(1000, 1000);

    HighResolutionProcessor.validate(img, 400, 300);

    expect(analyzeSpy).toHaveBeenCalledOnce();
    analyzeSpy.mockRestore();
  });

  it('recommendedStrategy 는 analysis.strategy 와 같다(validate 는 balanced 기준)', () => {
    const img = createDrawableImage(1000, 1000);
    const result = HighResolutionProcessor.validate(img, 400, 300);

    expect(result.recommendedStrategy).toBe(result.analysis.strategy);
  });
});
