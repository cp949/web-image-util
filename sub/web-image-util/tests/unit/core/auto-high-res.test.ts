/**
 * AutoHighResProcessor.validateProcessing 의 임계치 기반 결정 로직을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';
import { createMockImage, makeValidation } from './auto-high-res.helpers';

describe('AutoHighResProcessor.validateProcessing', () => {
  beforeEach(() => {
    vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(makeValidation());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('픽셀 수가 8MP 미만이면 고해상도 권장사항을 반환하지 않는다', () => {
    const img = createMockImage(2000, 2000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
    expect(hasHighResRec).toBe(false);
  });

  it('픽셀 수가 8MP 이상이면 고해상도 권장사항을 반환한다', () => {
    const img = createMockImage(3000, 3000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
    expect(hasHighResRec).toBe(true);
  });

  it('estimatedMemory 가 200MB 미만이면 메모리 경고가 없다', () => {
    const img = createMockImage(1000, 1000);
    const result = AutoHighResProcessor.validateProcessing(img, 500, 500);

    const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
    expect(hasMemWarning).toBe(false);
  });

  it('estimatedMemory 가 200MB 이상이면 메모리 경고가 포함된다', () => {
    const img = createMockImage(7300, 7300);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
    expect(hasMemWarning).toBe(true);
  });

  it('validation.estimatedTime 이 10초를 초과하면 처리 시간 경고가 포함된다', () => {
    vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
      makeValidation({ estimatedTime: 15 })
    );
    const img = createMockImage(1000, 1000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    const hasTimeWarning = result.warnings.some((w) => w.toLowerCase().includes('processing time'));
    expect(hasTimeWarning).toBe(true);
  });

  it('validation.estimatedTime 이 10초 이하면 시간 경고가 없다', () => {
    vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
      makeValidation({ estimatedTime: 9 })
    );
    const img = createMockImage(1000, 1000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    const hasTimeWarning = result.warnings.some((w) => w.toLowerCase().includes('processing time'));
    expect(hasTimeWarning).toBe(false);
  });

  it('canProcess 는 validation.canProcess 값을 그대로 반영한다', () => {
    vi.spyOn(HighResolutionManager, 'validateProcessingCapability').mockReturnValue(
      makeValidation({ canProcess: false })
    );
    const img = createMockImage(1000, 1000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    expect(result.canProcess).toBe(false);
  });

  it('validateProcessing 의 suggestedStrategy 는 balanced 정책 이름이다', () => {
    const img = createMockImage(1000, 1000);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600);

    expect(result.suggestedStrategy).toBe('Balanced Optimization');
  });

  it('커스텀 highResPixelThreshold 를 낮추면 더 작은 이미지도 고해상도 권장사항을 받는다', () => {
    const img = createMockImage(1500, 1500);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600, {
      thresholds: { highResPixelThreshold: 1_000_000 },
    });

    const hasHighResRec = result.recommendations.some((r) => r.toLowerCase().includes('high-resolution'));
    expect(hasHighResRec).toBe(true);
  });

  it('커스텀 memoryWarningThreshold 를 높이면 같은 이미지에서 메모리 경고가 사라진다', () => {
    const img = createMockImage(7300, 7300);
    const result = AutoHighResProcessor.validateProcessing(img, 800, 600, {
      thresholds: { memoryWarningThreshold: 500 },
    });

    const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
    expect(hasMemWarning).toBe(false);
  });
});
