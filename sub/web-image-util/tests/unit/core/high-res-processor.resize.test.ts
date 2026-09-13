import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { SteppedProcessor } from '../../../src/base/stepped-processor.internal';
import { TiledProcessor } from '../../../src/base/tiled-processor.internal';
import { HighResolutionProcessor, ProcessingStrategy } from '../../../src/core/high-res-processor';
import { createDrawableImage, createMockImage } from './high-res-processor.helpers';

describe('HighResolutionProcessor.resize', () => {
  describe('기본 동작', () => {
    it('반환 canvas 크기는 targetWidth×targetHeight 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
    });

    it('priority 를 생략하면 결과의 priority 는 balanced 다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.priority).toBe('balanced');
    });

    it('결과에 analysis 가 소스 이미지 크기를 반영해 포함된다', async () => {
      const img = createDrawableImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.analysis.width).toBe(1000);
      expect(result.analysis.height).toBe(1000);
    });

    it('작은 이미지(8MP 미만)는 direct 전략으로 처리된다', async () => {
      const img = createDrawableImage(800, 600);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.strategy).toBe('direct');
      expect(result.memoryOptimized).toBe(false);
    });

    it('processingTime 은 0 이상의 숫자다', async () => {
      const img = createDrawableImage(800, 600);
      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HighResolutionProcessor.resize — 고해상도 경로', () => {
    it('총 픽셀 수가 8MP 이상이면 tiled 전략이 선택될 수 있다(강제 전략으로 검증)', async () => {
      const img = createDrawableImage(4000, 4000);
      const result = await HighResolutionProcessor.resize(img, 800, 600, { forceStrategy: 'tiled' });

      expect(result.strategy).toBe('tiled');
      expect(result.memoryOptimized).toBe(true);
      expect(result.userMessage).toBeDefined();
    });

    it('forceStrategy 를 지정하면 8MP 미만이어도 그 전략을 그대로 쓴다', async () => {
      const img = createDrawableImage(800, 600);
      const result = await HighResolutionProcessor.resize(img, 400, 300, { forceStrategy: 'stepped' });

      expect(result.strategy).toBe('stepped');
    });

    it('onProgress 콜백은 시작(10)과 완료(100) 진행도로 호출된다', async () => {
      const onProgress = vi.fn();
      const img = createDrawableImage(4000, 4000);
      await HighResolutionProcessor.resize(img, 800, 600, { forceStrategy: 'tiled', onProgress });

      expect(onProgress).toHaveBeenCalledWith(10, expect.any(String));
      expect(onProgress).toHaveBeenCalledWith(100, expect.any(String));
    });

    it('onMemoryWarning 콜백은 메모리 추정치가 경고 임계치를 넘으면 문자열 메시지로 호출된다', async () => {
      const onMemoryWarning = vi.fn();
      // createMockImage 는 draw 가 불가능한 스텁이라(analyzeImage/validate 전용) 여기서는 쓸 수 없다.
      // 이 테스트는 실제로 고해상도 경로(stepped)까지 실행되어 real drawImage 를 거치므로
      // createDrawableImage 로 그려질 수 있는 소스를 써야 한다.
      const img = createDrawableImage(7300, 7300);
      await HighResolutionProcessor.resize(img, 800, 600, { onMemoryWarning });

      expect(onMemoryWarning).toHaveBeenCalledOnce();
      expect(onMemoryWarning.mock.calls[0][0]).toEqual(expect.any(String));
    });

    it('정적 메모리 추정치 경고와 고해상도 경로 내부의 가용 메모리 경고가 동시에 성립해도 onMemoryWarning은 한 번만 호출된다', async () => {
      const onMemoryWarning = vi.fn();
      const img = createDrawableImage(4000, 4000);

      // jsdom fallback(readMemoryBudget)의 availableMB=384 를 밑도는 autoTileThreshold(500)로
      // checkAndManageMemory 쪽 조건도 성립시켜, 정적 추정치 경고(memoryWarningThreshold)와
      // 두 조건이 같은 호출에서 동시에 만족되도록 만든다.
      await HighResolutionProcessor.resize(img, 800, 600, {
        forceStrategy: 'tiled',
        onMemoryWarning,
        thresholds: { memoryWarningThreshold: 1, autoTileThreshold: 500 },
      });

      expect(onMemoryWarning).toHaveBeenCalledOnce();
    });

    it('고해상도 경로 실행이 실패하면 표준 경로로 폴백해 canvas 를 반환한다', async () => {
      const executeSpy = vi
        .spyOn(HighResolutionProcessor as any, 'executeProcessing')
        .mockRejectedValueOnce(new Error('GPU 오류'));
      const img = createDrawableImage(4000, 4000);

      const result = await HighResolutionProcessor.resize(img, 400, 300, {
        forceStrategy: 'tiled',
        thresholds: { highResPixelThreshold: 1 },
      });

      expect(result.canvas.width).toBe(400);
      expect(result.canvas.height).toBe(300);
      executeSpy.mockRestore();
    });

    it('고해상도 경로 폴백 시 onProgress 는 50 이후 100 순서로 호출된다', async () => {
      const executeSpy = vi
        .spyOn(HighResolutionProcessor as any, 'executeProcessing')
        .mockRejectedValueOnce(new Error('GPU 오류'));
      const onProgress = vi.fn();
      const img = createDrawableImage(4000, 4000);

      await HighResolutionProcessor.resize(img, 400, 300, {
        forceStrategy: 'tiled',
        thresholds: { highResPixelThreshold: 1 },
        onProgress,
      });

      const values = onProgress.mock.calls.map((c) => c[0] as number);
      expect(values.indexOf(50)).toBeGreaterThanOrEqual(0);
      expect(values.lastIndexOf(100)).toBeGreaterThan(values.indexOf(50));
      executeSpy.mockRestore();
    });

    it('고해상도 경로가 폴백되면 폴백 결과가 tiled여도 고해상도 성공 메시지를 붙이지 않는다', async () => {
      const runHighResSpy = vi
        .spyOn(HighResolutionProcessor as any, 'runHighResPath')
        .mockRejectedValueOnce(new Error('실행 실패'));
      const runStandardSpy = vi.spyOn(HighResolutionProcessor as any, 'runStandardPath').mockResolvedValueOnce({
        canvas: document.createElement('canvas'),
        strategy: ProcessingStrategy.TILED,
        processingTime: 0,
        memoryPeakUsageMB: 0,
      });
      // totalPixels(16MP)가 기본 임계값(8MP)을 넘어 shouldUseHighResPath가 true가 되게 한다
      const img = createDrawableImage(4000, 4000);

      const result = await HighResolutionProcessor.resize(img, 400, 300);

      expect(result.memoryOptimized).toBe(true);
      expect(result.userMessage).toBeUndefined();

      runHighResSpy.mockRestore();
      runStandardSpy.mockRestore();
    });

    it('지원하지 않는 forceStrategy 값은 폴백 없이 FEATURE_NOT_SUPPORTED로 reject된다', async () => {
      const img = createDrawableImage(800, 600);
      await expect(
        HighResolutionProcessor.resize(img, 400, 300, { forceStrategy: 'unknown-strategy' as any })
      ).rejects.toMatchObject({ code: 'FEATURE_NOT_SUPPORTED' });
    });
  });

  describe('HighResolutionProcessor.resize — priority 기반 전략 선택(forceStrategy 미지정)', () => {
    // 모든 케이스에서 highResPixelThreshold 를 낮춰 고해상도 경로를 강제로 연다.
    // forceStrategy 는 selectOptimalStrategy 를 즉시 우회시키므로 이 describe 안에서는 쓰지 않는다.
    const FORCE_HIGH_RES = { thresholds: { highResPixelThreshold: 1 } };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('priority="fast" + 이미지 메모리 추정치 ≤ 64MB 이면 selectFastStrategy가 direct를 고른다', async () => {
      // 300×300×4 ≈ 0.34MB ≤ 64MB → direct
      const img = createDrawableImage(300, 300);
      const result = await HighResolutionProcessor.resize(img, 100, 100, { priority: 'fast', ...FORCE_HIGH_RES });

      expect(result.strategy).toBe('direct');
    });

    it('priority="fast" + 이미지 메모리 추정치 > 64MB 이면 selectFastStrategy가 tiled를 고른다', async () => {
      const stubCanvas = document.createElement('canvas');
      const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

      // 9000×9000×4 ≈ 309MB > 64MB → tiled
      const img = createMockImage(9000, 9000);
      const result = await HighResolutionProcessor.resize(img, 800, 600, { priority: 'fast', ...FORCE_HIGH_RES });

      expect(tiledSpy).toHaveBeenCalledOnce();
      expect(result.strategy).toBe('tiled');
    });

    it('priority="quality" + scaleRatio < 0.3 + 이미지 메모리 추정치 ≤ 256MB 이면 selectHighQualityStrategy가 stepped를 고른다', async () => {
      const stubCanvas = document.createElement('canvas');
      const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

      // 1000×1000(≈3.8MB ≤ 256MB), target 200×200 → scaleRatio = min(200/1000, 200/1000) = 0.2 < 0.3
      const img = createMockImage(1000, 1000);
      const result = await HighResolutionProcessor.resize(img, 200, 200, { priority: 'quality', ...FORCE_HIGH_RES });

      expect(steppedSpy).toHaveBeenCalledOnce();
      expect(result.strategy).toBe('stepped');
    });

    it('priority="quality" + 이미지 메모리 추정치 > 256MB 이면 scaleRatio 조건이 성립해도 tiled를 고른다', async () => {
      const stubCanvas = document.createElement('canvas');
      const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(stubCanvas);

      // 9000×9000×4 ≈ 309MB > 256MB → estimatedMemoryMB<=256 조건이 깨져 stepped 분기를 건너뛰고 tiled로 간다
      const img = createMockImage(9000, 9000);
      const result = await HighResolutionProcessor.resize(img, 800, 600, { priority: 'quality', ...FORCE_HIGH_RES });

      expect(tiledSpy).toHaveBeenCalledOnce();
      expect(result.strategy).toBe('tiled');
    });

    it('priority 생략(기본 balanced, 위 두 조건 모두 미해당)이면 analysis.strategy 를 그대로 쓴다', async () => {
      const stubCanvas = document.createElement('canvas');
      const steppedSpy = vi.spyOn(SteppedProcessor, 'resizeWithSteps').mockResolvedValue(stubCanvas);

      // 5000×5000×4 ≈ 95.4MB — selectBalancedStrategy()의 64~256MB 구간 → analysis.strategy = 'stepped'
      const img = createMockImage(5000, 5000);
      const result = await HighResolutionProcessor.resize(img, 800, 600, { ...FORCE_HIGH_RES });

      expect(steppedSpy).toHaveBeenCalledOnce();
      expect(result.strategy).toBe('stepped');
    });

    it('isMemoryLow()=true 이면 priority 와 무관하게 selectMemoryEfficientStrategy 가 적용된다(32MB 초과 → tiled, 이하 → direct)', async () => {
      vi.spyOn(HighResolutionProcessor as any, 'isMemoryLow').mockReturnValue(true);

      // 3000×3000×4 ≈ 34.3MB > 32MB → tiled — priority="quality"라면 원래 stepped/tiled 분기를 타지만
      // memory-pressure 검사가 그보다 먼저 실행되어 결과를 덮어쓴다.
      const tiledSpy = vi.spyOn(TiledProcessor, 'resizeInTiles').mockResolvedValue(document.createElement('canvas'));
      const largeImg = createMockImage(3000, 3000);
      const largeResult = await HighResolutionProcessor.resize(largeImg, 800, 600, {
        priority: 'quality',
        ...FORCE_HIGH_RES,
      });

      expect(tiledSpy).toHaveBeenCalledOnce();
      expect(largeResult.strategy).toBe('tiled');

      // 1000×1000×4 ≈ 3.8MB ≤ 32MB → direct — 같은 크기가 priority="quality" 단독이라면 stepped가
      // 됐을 조합(위 stepped 테스트 참고)인데도 memory-pressure 검사가 우선해 direct로 바뀐다.
      const smallImg = createDrawableImage(1000, 1000);
      const smallResult = await HighResolutionProcessor.resize(smallImg, 200, 200, {
        priority: 'quality',
        ...FORCE_HIGH_RES,
      });

      expect(smallResult.strategy).toBe('direct');
    });

    it('isMemoryLow()=true 이면 CanvasPool.getInstance().clear()가 호출된다', async () => {
      vi.spyOn(HighResolutionProcessor as any, 'isMemoryLow').mockReturnValue(true);
      const clearSpy = vi.spyOn(CanvasPool.prototype, 'clear');

      const img = createDrawableImage(1000, 1000);
      await HighResolutionProcessor.resize(img, 200, 200, { priority: 'quality', ...FORCE_HIGH_RES });

      expect(clearSpy).toHaveBeenCalledOnce();
    });

    it('isMemoryLow()=false(기본, mock 안 함) 이면 CanvasPool.clear()가 호출되지 않는다', async () => {
      const clearSpy = vi.spyOn(CanvasPool.prototype, 'clear');

      const img = createDrawableImage(1000, 1000);
      await HighResolutionProcessor.resize(img, 200, 200, { priority: 'quality', ...FORCE_HIGH_RES });

      expect(clearSpy).not.toHaveBeenCalled();
    });
  });
});
