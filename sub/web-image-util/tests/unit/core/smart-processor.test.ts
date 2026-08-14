/**
 * SmartProcessor 단위 테스트
 *
 * 자동 고해상도 분기 결정(HighResolutionDetector.shouldUseHighResolutionPath 위임)과
 * 내부 전략 변환 로직(selectInternalStrategy, mapStrategyToQuality)을 검증한다.
 * HighResolutionManager 와 AutoMemoryManager 는 spy 로 격리한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { AutoMemoryManager } from '../../../src/core/auto-memory-manager.internal';
import { SmartProcessor } from '../../../src/core/smart-processor.internal';

// img.width / img.height 를 제어하는 헬퍼 (고해상도 경로, 모킹됨)
function createMockImage(width: number, height: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'width', { value: width, configurable: true });
  Object.defineProperty(img, 'height', { value: height, configurable: true });
  return img;
}

// drawImage 소스로 사용 가능한 Canvas 기반 헬퍼
// jsdom+canvas 에서 표준 경로(simpleResize)가 drawImage 를 호출하므로
// Canvas 를 소스로 사용해야 한다
function createDrawableImage(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as HTMLImageElement;
}

// HighResolutionManager.smartResize 의 기본 반환값
function makeProcessingResult(canvasW = 800, canvasH = 600) {
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  return {
    canvas,
    analysis: {} as any,
    strategy: 'direct' as any,
    processingTime: 0,
    memoryPeakUsageMB: 0,
    quality: 'balanced' as const,
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe('SmartProcessor', () => {
  let highResSpy: ReturnType<typeof vi.spyOn>;
  let memoryManagerMock: { checkAndOptimize: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    // 고해상도 내부 처리기 격리
    highResSpy = vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(makeProcessingResult());

    // AutoMemoryManager 격리
    memoryManagerMock = { checkAndOptimize: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(AutoMemoryManager, 'getInstance').mockReturnValue(memoryManagerMock as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // shouldUseHighResProcessing — 픽셀 수 기반 분기
  // --------------------------------------------------------------------------
  describe('shouldUseHighResProcessing — 픽셀 수 기반 분기', () => {
    it('1MP 이미지(< 4MP)는 표준 경로를 사용하며 HighResolutionManager 를 호출하지 않는다', async () => {
      // 1000×1000 = 1MP, 스케일 1.25x < 4 → 표준 경로 → drawImage 필요 → drawable
      const img = createDrawableImage(1000, 1000);
      await SmartProcessor.process(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('4MP 초과 8MP 이하 이미지는 표준 경로를 사용한다(게이트 통합 — 임계값 4MP→8MP 상향)', async () => {
      // 2001×2001 ≈ 4.004MP — 이전엔 4MP 임계값으로 고해상도 경로였으나,
      // AutoHighResProcessor와 게이트를 공유하며 8MP로 상향돼 이제 표준 경로다
      const img = createDrawableImage(2001, 2001);
      await SmartProcessor.process(img, 800, 600);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('8MP 초과 이미지는 고해상도 경로를 사용한다', async () => {
      // 2829×2829 = 8,003,241 pixels > 8,000,000 → 고해상도 경로 → 모킹됨
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600);

      expect(highResSpy).toHaveBeenCalledOnce();
    });

    it('표준 경로의 결과 canvas 크기는 요청한 width×height 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const canvas = await SmartProcessor.process(img, 400, 300);

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });
  });

  // --------------------------------------------------------------------------
  // shouldUseHighResProcessing — 스케일 비율 기반 분기
  // --------------------------------------------------------------------------
  describe('shouldUseHighResProcessing — 스케일 비율 기반 분기', () => {
    it('스케일 비율이 4 초과이면 픽셀 수가 적어도 고해상도 경로를 사용한다', async () => {
      // 1000×100 = 0.1MP, 스케일 max(1000/100, 100/100) = 10 > 4
      const img = createMockImage(1000, 100);
      await SmartProcessor.process(img, 100, 100);

      expect(highResSpy).toHaveBeenCalledOnce();
    });

    it('스케일 비율이 4 이하이고 픽셀 수도 4MP 미만이면 표준 경로를 사용한다', async () => {
      // 800×600 = 0.48MP, 스케일 max(2, 1.5) = 2 <= 4 → 표준 경로 → drawable
      const img = createDrawableImage(800, 600);
      await SmartProcessor.process(img, 400, 400);

      expect(highResSpy).not.toHaveBeenCalled();
    });

    it('세로 방향 스케일이 4 초과이면 고해상도 경로를 사용한다', async () => {
      // 100×1000 = 0.1MP, 스케일 max(100/100, 1000/100) = 10 > 4
      const img = createMockImage(100, 1000);
      await SmartProcessor.process(img, 100, 100);

      expect(highResSpy).toHaveBeenCalledOnce();
    });
  });

  // --------------------------------------------------------------------------
  // selectInternalStrategy — 자동(auto) 전략 선택
  // --------------------------------------------------------------------------
  describe('selectInternalStrategy — auto 전략', () => {
    it('auto 전략 + 4MP 초과 이미지면 forceStrategy 가 "tiled" 다(옛 chunked 대역)', async () => {
      // 2829×2829 = 8,003,241 pixels — 4MP(selectInternalStrategy 경계, 이 카드의 비범위) 초과이면서
      // 8MP(진입 게이트, 이번 카드로 4MP→8MP 상향) 도 초과해야 HighResolutionManager 까지 도달한다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'auto' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('tiled');
    });

    it('auto 전략 + 16MP 초과 이미지면 forceStrategy 가 "tiled" 다', async () => {
      // 4001×4001 ≈ 16.01MP > 16MP → tiled
      const img = createMockImage(4001, 4001);
      await SmartProcessor.process(img, 800, 600, { strategy: 'auto' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('tiled');
    });

    it('auto 전략 + 저픽셀(4MP 이하) + 고스케일(4 초과)이면 forceStrategy 가 "stepped" 다', async () => {
      // 1000×1000 = 1MP ≤ 4MP → selectInternalStrategy 에서 'stepped' 반환
      // 스케일 max(1000/100, 1000/100) = 10 > 4 → shouldUseHighResProcessing = true
      // 이 경로가 'direct' 가 아님을 보장: 'stepped' 를 'direct' 로 바꾸면 이 테스트가 실패해야 한다
      const img = createMockImage(1000, 1000);
      await SmartProcessor.process(img, 100, 100, { strategy: 'auto' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('stepped');
    });
  });

  // --------------------------------------------------------------------------
  // selectInternalStrategy — 명시적 전략 선택
  // --------------------------------------------------------------------------
  describe('selectInternalStrategy — 명시적 전략', () => {
    it('strategy="fast" 이면 forceStrategy 가 "direct" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'fast' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('direct');
    });

    it('strategy="quality" 이면 forceStrategy 가 "stepped" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'quality' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('stepped');
    });

    it('strategy="memory-efficient" + 16MP 초과 이미지면 forceStrategy 가 "tiled" 다', async () => {
      // 4001×4001 > 16MP → tiled
      const img = createMockImage(4001, 4001);
      await SmartProcessor.process(img, 800, 600, { strategy: 'memory-efficient' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('tiled');
    });

    it('strategy="memory-efficient" + 4-16MP 이미지면 forceStrategy 가 "tiled" 다(옛 chunked 대역)', async () => {
      // 2829×2829 = 8,003,241 pixels ≈ 8MP — 진입 게이트(8MP)를 넘기면서도 4-16MP 대역 안이라
      // memory-efficient는 크기 무관 tiled(옛 chunked 대역이 흡수됨)
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'memory-efficient' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.forceStrategy).toBe('tiled');
    });
  });

  // --------------------------------------------------------------------------
  // mapStrategyToQuality — 전략↔품질 매핑
  // --------------------------------------------------------------------------
  describe('mapStrategyToQuality — 전략↔품질 매핑', () => {
    it('strategy="fast" 이면 quality 가 "fast" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'fast' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('fast');
    });

    it('strategy="memory-efficient" 이면 quality 가 "fast" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'memory-efficient' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('fast');
    });

    it('strategy="quality" 이면 quality 가 "high" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'quality' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('high');
    });

    it('strategy="auto"(기본값) 이면 quality 가 "balanced" 다', async () => {
      // 진입 게이트(8MP)를 넘겨야 highRes 경로로 들어가 convertToInternalOptions 가 실행된다
      const img = createMockImage(2829, 2829);
      await SmartProcessor.process(img, 800, 600, { strategy: 'auto' });

      const [, , , passedOpts] = highResSpy.mock.calls[0] as any[];
      expect(passedOpts.quality).toBe('balanced');
    });
  });

  // --------------------------------------------------------------------------
  // onProgress 래핑
  // --------------------------------------------------------------------------
  describe('onProgress 래핑', () => {
    it('표준 경로에서 onProgress 는 50과 100 으로 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(1000, 1000);
      await SmartProcessor.process(img, 800, 600, { onProgress });

      const progressValues = onProgress.mock.calls.map(([p]) => p);
      expect(progressValues).toContain(50);
      expect(progressValues).toContain(100);
    });
  });

  // --------------------------------------------------------------------------
  // 에러 처리
  // --------------------------------------------------------------------------
  describe('에러 처리', () => {
    it('HighResolutionManager.smartResize 가 에러를 던지면 ImageProcessError 로 래핑된다', async () => {
      vi.spyOn(HighResolutionManager, 'smartResize').mockRejectedValue(new Error('처리 실패'));

      // 진입 게이트(8MP)를 넘겨야 highRes 경로(HighResolutionManager.smartResize)로 들어간다
      const img = createMockImage(2829, 2829);

      await expect(SmartProcessor.process(img, 800, 600)).rejects.toThrow(
        expect.objectContaining({ code: 'PROCESSING_FAILED' })
      );
    });
  });
});
