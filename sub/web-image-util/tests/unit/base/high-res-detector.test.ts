/**
 * HighResolutionDetector 단위 테스트
 */
import { afterEach, describe, expect, it } from 'vitest';
import { HighResolutionDetector } from '../../../src/base/high-res-detector';

// ============================================================================
// 헬퍼
// ============================================================================

function createMockImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

const originalUA = navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
    writable: true,
  });
}

// ============================================================================
// analyzeImage()
// ============================================================================

describe('HighResolutionDetector', () => {
  describe('analyzeImage()', () => {
    describe('전략 결정', () => {
      afterEach(() => {
        Object.defineProperty(navigator, 'userAgent', {
          value: originalUA,
          configurable: true,
          writable: true,
        });
      });

      it('16MB 이하 이미지는 direct 전략을 사용한다', () => {
        // 2048*2048 = 4,194,304 pixels → 16MB 정확히 경계
        const img = createMockImage(2048, 2048);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('direct');
      });

      it('16MB 초과 64MB 이하는 chunked 전략을 사용한다', () => {
        // 2049*2049 = 4,198,401 pixels → 16MB 초과, 64MB 이하
        const img = createMockImage(2049, 2049);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('chunked');
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
        // Chrome UA로 설정해 maxSafeDimension = 32767
        setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        // 32768 > 32767 → tiled
        const img = createMockImage(32768, 100);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('tiled');
      });

      it('Canvas 한도를 초과하는 높이는 tiled 전략을 사용한다', () => {
        // Chrome UA로 설정해 maxSafeDimension = 32767
        setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
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

      it('chunked 전략은 medium 복잡도이다', () => {
        // 2049*2049 → chunked
        const img = createMockImage(2049, 2049);
        const result = HighResolutionDetector.analyzeImage(img);
        expect(result.strategy).toBe('chunked');
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

  // ============================================================================
  // getMaxSafeDimension()
  // ============================================================================

  describe('getMaxSafeDimension()', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
        writable: true,
      });
    });

    it('Chrome UA에서 32767을 반환한다', () => {
      setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(32767);
    });

    it('Firefox UA에서 32767을 반환한다', () => {
      setUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0');
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(32767);
    });

    it('Safari UA에서 16384를 반환한다', () => {
      // chrome/chromium이 없고 safari만 있는 순수 Safari UA
      setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      );
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(16384);
    });

    it('Edge UA에서 32767을 반환한다', () => {
      // chrome 없이 edg/만 있는 Edge UA
      setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/120.0.0.0');
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(32767);
    });

    it('알 수 없는 UA에서 기본값 16384를 반환한다', () => {
      setUserAgent('UnknownBrowser/1.0');
      expect(HighResolutionDetector.getMaxSafeDimension()).toBe(16384);
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
