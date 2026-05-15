/**
 * HighResolutionManager.validateProcessingCapability 행동 테스트
 *
 * 반환 객체 형태, forceStrategy 적용, 메모리/차원 경고 분기, canProcess 판정을 검증한다.
 * jsdom 환경에서 performance.memory 가 없어 메모리 모니터가 폴백 값을 쓰는 점을 전제로 한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStrategy } from '../../../src/base/high-res-detector';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { createMockImage } from './high-res-manager-helpers';

describe('HighResolutionManager.validateProcessingCapability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('반환 객체는 필수 키(canProcess, analysis, recommendedStrategy, warnings, estimatedTime)를 모두 갖는다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(result).toHaveProperty('canProcess');
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('recommendedStrategy');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('estimatedTime');
  });

  it('작은 이미지(100×100)는 canProcess=true 이고 warnings 가 비어 있다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(result.canProcess).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('estimatedTime 은 숫자다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(typeof result.estimatedTime).toBe('number');
  });

  it('warnings 는 배열이다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('forceStrategy="tiled" 이면 recommendedStrategy 가 "tiled" 이다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
      forceStrategy: ProcessingStrategy.TILED,
    });

    expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
  });

  it('forceStrategy="stepped" 이면 recommendedStrategy 가 "stepped" 이다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });

    expect(result.recommendedStrategy).toBe(ProcessingStrategy.STEPPED);
  });

  it('maxMemoryUsageMB 보다 estimatedMemoryMB 가 크면 warnings 에 메모리 초과 메시지가 포함된다', () => {
    // 1000×1000 = 1MP → estimatedMemoryMB ≈ 3.8MB > 2MB(낮은 상한)
    const img = createMockImage(1000, 1000);
    const result = HighResolutionManager.validateProcessingCapability(img, 500, 500, {
      maxMemoryUsageMB: 2,
    });

    const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory') || w.includes('MB'));
    expect(hasMemWarning).toBe(true);
  });

  it('maxMemoryUsageMB 가 충분히 크면 메모리 초과 경고가 없다', () => {
    // 100×100 → estimatedMemoryMB ≈ 0.04MB < 1000MB
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, {
      maxMemoryUsageMB: 1000,
    });

    const hasMemWarning = result.warnings.some(
      (w) => w.toLowerCase().includes('exceeds') || w.toLowerCase().includes('memory usage')
    );
    expect(hasMemWarning).toBe(false);
  });

  it('목표 크기가 maxSafeDimension 을 크게 초과하면 warnings 에 브라우저 한계 안내가 포함된다', () => {
    const img = createMockImage(100, 100);
    // jsdom UA 기준 maxSafeDimension = 16384 → 20000×20000 은 초과
    const result = HighResolutionManager.validateProcessingCapability(img, 20000, 20000);

    const hasLimitWarning = result.warnings.some(
      (w) => w.toLowerCase().includes('limit') || w.toLowerCase().includes('browser') || w.includes('size')
    );
    expect(hasLimitWarning).toBe(true);
  });

  it('analysis 에는 width, height, estimatedMemoryMB 가 포함된다', () => {
    const img = createMockImage(200, 300);
    const result = HighResolutionManager.validateProcessingCapability(img, 100, 100);

    expect(result.analysis.width).toBe(200);
    expect(result.analysis.height).toBe(300);
    expect(typeof result.analysis.estimatedMemoryMB).toBe('number');
  });

  it('forceStrategy 미지정 + 작은 이미지(100×100) → 자동 분석 경로에서 recommendedStrategy 가 "direct" 다', () => {
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);
    // isMemoryLow()=false(jsdom에 performance.memory 없음), quality='balanced'
    // → analysis.strategy 폴백: 100×100×4=40000 bytes < 16MB → DIRECT
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
  });

  it('forceStrategy 미지정 + 큰 이미지(2200×2200) → 자동 분석 경로에서 recommendedStrategy 가 "chunked" 다', () => {
    const img = createMockImage(2200, 2200);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000);
    // 2200×2200×4 ≈ 18.5MB → SMALL(16MB) 초과, MEDIUM(64MB) 이하 → CHUNKED
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
  });

  it('STEPPED forceStrategy 는 DIRECT forceStrategy 보다 estimatedTime 이 크다(×1.5 보정 적용)', () => {
    // 큰 이미지를 사용해 Math.max(0.1, ...) 바닥값 영향을 피한다
    const img = createMockImage(2200, 2200);
    const directResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
      forceStrategy: ProcessingStrategy.DIRECT,
    });
    const steppedResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });
    expect(steppedResult.estimatedTime).toBeGreaterThan(directResult.estimatedTime);
  });

  it('TILED forceStrategy 는 STEPPED forceStrategy 보다 estimatedTime 이 크다(×2.0 vs ×1.5 보정 적용)', () => {
    const img = createMockImage(2200, 2200);
    const steppedResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
      forceStrategy: ProcessingStrategy.STEPPED,
    });
    const tiledResult = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, {
      forceStrategy: ProcessingStrategy.TILED,
    });
    expect(tiledResult.estimatedTime).toBeGreaterThan(steppedResult.estimatedTime);
  });

  it('한 변이 maxSafeDimension×2 를 초과하지만 메모리는 1024MB 이하인 이미지(40000×200) → canProcess 가 false 다(차원 분기 단독)', () => {
    // maxSafeDimension=16384(jsdom UA 기준) → 16384×2=32768 < 40000 → 차원 분기만 트립
    // 메모리: 40000×200×4/(1024*1024)≈30MB < 1024MB → 메모리 분기는 비트립
    const img = createMockImage(40000, 200);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(result.canProcess).toBe(false);
    const hasDimWarning = result.warnings.some(
      (w) => w.toLowerCase().includes('canvas') || w.toLowerCase().includes('limit')
    );
    expect(hasDimWarning).toBe(true);
  });

  it('두 변이 maxSafeDimension×2 이하이지만 메모리가 1024MB 초과인 이미지(17000×17000) → canProcess 가 false 다(메모리 분기 단독)', () => {
    // 메모리: 17000×17000×4/(1024*1024)≈1102MB > 1024MB → 메모리 분기만 트립
    // 최대 변: 17000 < 32768(16384×2) → 차원 분기는 비트립
    const img = createMockImage(17000, 17000);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);

    expect(result.canProcess).toBe(false);
    const hasMemWarning = result.warnings.some((w) => w.toLowerCase().includes('memory'));
    expect(hasMemWarning).toBe(true);
  });
});
