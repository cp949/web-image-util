/**
 * HighResolutionDetector 단위 테스트
 */
import { afterEach, describe, expect, it } from 'vitest';
import { HighResolutionDetector } from '../../../src/base/high-res-detector.internal';
import {
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../src/utils/browser-capabilities/canvas-limits.internal';

// ============================================================================
// 헬퍼
// ============================================================================

/** 지정한 표시 치수를 가진 이미지 fixture를 만든다. */
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// ============================================================================
// analyzeImage()
// ============================================================================

describe('HighResolutionDetector', () => {
  describe('analyzeImage()', () => {
    describe('전략 결정', () => {
      afterEach(() => {
        resetCanvasLimitProbe();
      });

      it('16MB 이하 이미지는 direct 전략을 사용한다', () => {
        // 2048*2048 = 4,194,304 pixels → 16MB 정확히 경계
        const img = createMockImage(2048, 2048);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('direct');
      });

      it('16MB 초과 64MB 이하는 tiled 전략을 사용한다(옛 chunked 대역)', () => {
        // 2049*2049 = 4,198,401 pixels → 16MB 초과, 64MB 이하 → tiled(light preset 대역)
        const img = createMockImage(2049, 2049);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
      });

      it('64MB 초과 256MB 이하는 stepped 전략을 사용한다', () => {
        // 4097*4097 = 16,785,409 pixels → 64MB 초과, 256MB 이하
        const img = createMockImage(4097, 4097);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('stepped');
      });

      it('256MB 초과는 tiled 전략을 사용한다', () => {
        // 8193*8193 = 67,125,249 pixels → 256MB 초과
        // 단, Canvas 한도(기본 16384)를 초과하지 않아야 메모리 기반 tiled가 테스트됨
        // 8193 < 16384이므로 Canvas 한도는 통과하고 메모리 초과로 tiled
        const img = createMockImage(8193, 8193);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
      });

      it('Canvas 한도를 초과하는 너비는 tiled 전략을 사용한다', () => {
        // probe를 주입해 maxSafeDimension = 32767로 고정
        setCanvasLimitProbe({ read: () => 32767 });
        // 32768 > 32767 → tiled
        const img = createMockImage(32768, 100);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
      });

      it('Canvas 한도를 초과하는 높이는 tiled 전략을 사용한다', () => {
        // probe를 주입해 maxSafeDimension = 32767로 고정
        setCanvasLimitProbe({ read: () => 32767 });
        // 높이 32768 > 32767 → tiled
        const img = createMockImage(100, 32768);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
      });
    });

    describe('복잡도 분류', () => {
      it('direct 전략 소형 이미지는 low 복잡도이다', () => {
        // 100*100 = 10,000 pixels → megaPixels ≈ 0.0095 < 2 → low
        const img = createMockImage(100, 100);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('direct');
        expect(result.processingComplexity).toBe('low');
      });

      it('direct 전략에서 2MP 이상이면 medium 복잡도이다', () => {
        // 2048*1024 = 정확히 2MP, 8MB ≤ SMALL → direct, megaPixels >= 2 → medium
        const img = createMockImage(2048, 1024);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('direct');
        expect(result.processingComplexity).toBe('medium');
      });

      it('16~64MB의 tiled 전략(옛 chunked 대역)은 medium 복잡도이다', () => {
        // 2049*2049 → tiled, estimatedMemoryMB≈16.0 <= 64 → medium(light preset 대역)
        const img = createMockImage(2049, 2049);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
        expect(result.processingComplexity).toBe('medium');
      });

      it('stepped 전략은 high 복잡도이다', () => {
        // 4097*4097 → stepped
        const img = createMockImage(4097, 4097);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('stepped');
        expect(result.processingComplexity).toBe('high');
      });

      it('tiled 전략은 extreme 복잡도이다', () => {
        // 8193*8193 → tiled
        const img = createMockImage(8193, 8193);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
        expect(result.processingComplexity).toBe('extreme');
      });
    });

    describe('반환값 구조', () => {
      it('estimatedMemoryMB가 소수점 2자리로 반올림된다', () => {
        // 100*100*4 bytes / (1024*1024) = 0.0381... → 반올림 → 0.04
        const img = createMockImage(100, 100);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.estimatedMemoryMB).toBe(0.04);
      });

      it('pixelCount와 totalPixels는 width * height이다', () => {
        const img = createMockImage(1920, 1080);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.pixelCount).toBe(1920 * 1080);
        expect(result.totalPixels).toBe(1920 * 1080);
        expect(result.pixelCount).toBe(result.totalPixels);
      });

      it('maxSafeDimension과 recommendedChunkSize를 포함한다', () => {
        const img = createMockImage(100, 100);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.maxSafeDimension).toBeTypeOf('number');
        expect(result.maxSafeDimension).toBeGreaterThan(0);
        expect(result.recommendedChunkSize).toBeTypeOf('number');
        expect(result.recommendedChunkSize).toBeGreaterThan(0);
      });
    });
  });

  describe('shouldUseHighResolutionPath()', () => {
    it('픽셀 수가 기본 임계값(8,000,000)을 초과하면 true 를 반환한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(8_000_001)).toBe(true);
    });

    it('픽셀 수가 기본 임계값 이하이고 scaleRatio 도 4 이하면 false 를 반환한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(1_000_000, 2)).toBe(false);
    });

    it('픽셀 수는 낮아도 scaleRatio 가 4를 초과하면 true 를 반환한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(100_000, 5)).toBe(true);
    });

    it('scaleRatio 를 생략하면 기본값 1로 취급해 픽셀 수만으로 판정한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(1_000_000)).toBe(false);
      expect(HighResolutionDetector.shouldUseHighResolutionPath(9_000_000)).toBe(true);
    });

    it('커스텀 pixelThreshold 를 낮추면 더 작은 픽셀 수도 true 를 반환한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(500_000, 1, 400_000)).toBe(true);
    });

    it('경계값(정확히 임계값과 같음)은 초과가 아니므로 false 를 반환한다', () => {
      expect(HighResolutionDetector.shouldUseHighResolutionPath(8_000_000, 4)).toBe(false);
    });
  });

  // ============================================================================
  // getMaxSafeDimension()
  // ============================================================================

  // 브라우저별 UA → 치수 매핑 자체는 browser-capabilities/canvas-limits.internal.ts가
  // 단일 소유하며 canvas-limits.test.ts가 검증한다. 여기서는 getMaxSafeDimension()이
  // 그 leaf에 정확히 위임하는지만 probe 주입으로 확인한다.
  describe('getMaxSafeDimension()', () => {
    afterEach(() => {
      resetCanvasLimitProbe();
    });

    it('활성 probe가 반환한 값을 그대로 돌려준다', () => {
      setCanvasLimitProbe({ read: () => 32767 });
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(32767);
    });

    it('probe가 undefined면 browser-capabilities의 fallback(16384)을 따른다', () => {
      setCanvasLimitProbe({ read: () => undefined });
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(16384);
    });
  });

  describe('estimateProcessingTime()', () => {
    it('tiled light preset은 옛 chunked 시간 계수와 factor를 보존한다', () => {
      const analysis = HighResolutionDetector.analyzeImage(createMockImage(2049, 2049));

      expect(HighResolutionDetector.estimateProcessingTime(analysis)).toMatchObject({
        estimatedSeconds: 1,
        factors: ['Chunk processing - memory efficient'],
      });
    });

    it('tiled heavy preset은 옛 tiled 시간 계수와 factor를 보존한다', () => {
      const analysis = HighResolutionDetector.analyzeImage(createMockImage(8193, 8193));

      expect(HighResolutionDetector.estimateProcessingTime(analysis)).toMatchObject({
        estimatedSeconds: 128,
        factors: ['Tile processing - ultra-large images', 'Extremely high complexity'],
      });
    });
  });

  // ============================================================================
  // getOptimalChunkSize()
  // ============================================================================

  describe('getOptimalChunkSize()', () => {
    it('반환값은 512 이상 2048 이하이다', () => {
      const chunkSize = HighResolutionDetector.getOptimalChunkSize(1000000);
      expect(chunkSize).toBeGreaterThanOrEqual(512);
      expect(chunkSize).toBeLessThanOrEqual(2048);
    });

    it('2의 거듭제곱에 가까운 값을 반환한다', () => {
      // 현재 구현은 SMALL 임계값(16MB)을 기반으로 계산하여 2048(= 2^11)을 반환한다
      const chunkSize = HighResolutionDetector.getOptimalChunkSize(1000000);
      const log2 = Math.log2(chunkSize);
      expect(Number.isInteger(log2)).toBe(true);
      expect(chunkSize).toBe(2048);
    });

    it('픽셀 수가 클수록 더 큰 chunk를 반환하지 않는다 (상한 2048)', () => {
      const smallChunk = HighResolutionDetector.getOptimalChunkSize(100 * 100);
      const largeChunk = HighResolutionDetector.getOptimalChunkSize(10000 * 10000);
      // 입력값과 무관하게 상한(2048)에 클램핑된다
      expect(smallChunk).toBe(2048);
      expect(largeChunk).toBe(2048);
      expect(largeChunk).toBeLessThanOrEqual(smallChunk);
    });
  });
});
