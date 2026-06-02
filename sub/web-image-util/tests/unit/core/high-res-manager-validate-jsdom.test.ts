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

  it('target pixel 이 maxSafeDimension 제곱을 초과할 때 warnings 와 recommendedStrategy 를 함께 반환한다', () => {
    const img = createMockImage(100, 100);
    // jsdom UA 기준 maxSafeDimension=16384 → 20000×20000 초과
    const result = HighResolutionManager.validateProcessingCapability(img, 20000, 20000);

    // 브라우저 한계 경고가 포함된다
    const hasSizeWarning = result.warnings.some(
      (w) => w.toLowerCase().includes('limit') || w.toLowerCase().includes('browser') || w.includes('size')
    );
    expect(hasSizeWarning).toBe(true);
    // 100×100 소스 + forceStrategy 미지정 → 자동 분석 경로에서 DIRECT
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
  });

  it('target pixel 이 maxSafeDimension 제곱 이하(경계값)이면 "Target image size may exceed browser limits." 경고가 없다', () => {
    const img = createMockImage(100, 100);
    // maxSafeDimension=16384(jsdom UA 기본값) → 16384×16384 = maxSafePixels (> 조건 불충족)
    const result = HighResolutionManager.validateProcessingCapability(img, 16384, 16384);

    const hasSizeWarning = result.warnings.some((w) => w.includes('Target image size may exceed browser limits.'));
    expect(hasSizeWarning).toBe(false);
  });
});

// ============================================================================
// 메모리 압박(isMemoryLow=true) 분기 — selectMemoryEfficientStrategy
// ============================================================================

describe('HighResolutionManager.validateProcessingCapability — isMemoryLow 메모리 압박 분기', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('메모리 부족이고 estimatedMemoryMB>128이면 TILED 전략을 추천한다', () => {
    // jsdom에는 performance.memory가 없어 기본 isMemoryLow=false → 강제로 true 주입
    vi.spyOn(HighResolutionManager as any, 'isMemoryLow').mockReturnValue(true);
    // 6000×6000×4 ≈ 137MB > 128 → TILED
    const img = createMockImage(6000, 6000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000);
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
  });

  it('메모리 부족이고 32<estimatedMemoryMB<=128이면 CHUNKED 전략을 추천한다', () => {
    vi.spyOn(HighResolutionManager as any, 'isMemoryLow').mockReturnValue(true);
    // 3700×3700×4 ≈ 52MB → 32<52<=128 → CHUNKED
    const img = createMockImage(3700, 3700);
    const result = HighResolutionManager.validateProcessingCapability(img, 500, 500);
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
  });

  it('메모리 부족이지만 estimatedMemoryMB<=32이면 DIRECT 전략을 추천한다', () => {
    vi.spyOn(HighResolutionManager as any, 'isMemoryLow').mockReturnValue(true);
    // 100×100×4 ≈ 0.04MB <= 32 → DIRECT
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50);
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
  });
});

// ============================================================================
// quality 기반 전략 선택 — selectFastStrategy / selectHighQualityStrategy
// ============================================================================

describe('HighResolutionManager.validateProcessingCapability — quality 기반 전략 선택', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("quality='fast' + 소형 이미지(mem<=64) → DIRECT를 추천한다", () => {
    // 100×100 ≈ 0.04MB <= 64 → DIRECT
    const img = createMockImage(100, 100);
    const result = HighResolutionManager.validateProcessingCapability(img, 50, 50, { quality: 'fast' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
  });

  it("quality='fast' + 64<mem<=128 → CHUNKED를 추천한다", () => {
    // 5000×5000×4 ≈ 95MB → 64<95<=128 → CHUNKED (자동 분석 STEPPED를 fast 분기가 덮어씀)
    const img = createMockImage(5000, 5000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, { quality: 'fast' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.CHUNKED);
  });

  it("quality='fast' + mem>128 → TILED를 추천한다", () => {
    // 6000×6000×4 ≈ 137MB > 128 → TILED
    const img = createMockImage(6000, 6000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, { quality: 'fast' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
  });

  it("quality='high' + 큰 축소비(scaleRatio<0.3) + mem<=256 → STEPPED를 추천한다", () => {
    // 2000×2000(15MB) → scaleRatio=500/2000=0.25<0.3, mem<=256 → STEPPED
    const img = createMockImage(2000, 2000);
    const result = HighResolutionManager.validateProcessingCapability(img, 500, 500, { quality: 'high' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.STEPPED);
  });

  it("quality='high' + mem>256 → TILED를 추천한다", () => {
    // 9000×9000×4 ≈ 309MB > 256 → scaleRatio 조건 무시하고 TILED
    const img = createMockImage(9000, 9000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, { quality: 'high' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.TILED);
  });

  it("quality='high' + 완만한 축소비(scaleRatio>=0.3) → analysis.strategy 폴백(DIRECT)을 추천한다", () => {
    // 2000×2000(15MB) → scaleRatio=1000/2000=0.5>=0.3 → STEPPED 조건 미충족, mem<=256 → 폴백 analysis.strategy=DIRECT
    const img = createMockImage(2000, 2000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000, { quality: 'high' });
    expect(result.recommendedStrategy).toBe(ProcessingStrategy.DIRECT);
  });
});

// ============================================================================
// detector limitations 전파 — warnings 누적
// ============================================================================

describe('HighResolutionManager.validateProcessingCapability — detector limitations 전파', () => {
  it('estimatedMemoryMB>512이면 detector의 High memory usage 제한이 warnings에 전파된다', () => {
    // 12000×12000×4 ≈ 549MB > 512 → detector limitations에 "High memory usage" 추가
    const img = createMockImage(12000, 12000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000);
    const hasHighMem = result.warnings.some((w) => w.includes('High memory usage'));
    expect(hasHighMem).toBe(true);
  });

  it('처리 복잡도가 extreme이면 detector의 complex 처리 제한이 warnings에 전파된다', () => {
    // 12000×12000 → mem>256 → TILED → complexity=extreme → "Very complex processing..." 제한
    const img = createMockImage(12000, 12000);
    const result = HighResolutionManager.validateProcessingCapability(img, 1000, 1000);
    const hasComplex = result.warnings.some((w) => w.toLowerCase().includes('complex'));
    expect(hasComplex).toBe(true);
  });
});
