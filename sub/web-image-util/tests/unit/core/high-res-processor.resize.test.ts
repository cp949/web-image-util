import { describe, expect, it, vi } from 'vitest';
import { HighResolutionProcessor } from '../../../src/core/high-res-processor';
import { createDrawableImage } from './high-res-processor.helpers';

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

    it('지원하지 않는 forceStrategy 값은 폴백 없이 FEATURE_NOT_SUPPORTED로 reject된다', async () => {
      const img = createDrawableImage(800, 600);
      await expect(
        HighResolutionProcessor.resize(img, 400, 300, { forceStrategy: 'unknown-strategy' as any })
      ).rejects.toMatchObject({ code: 'FEATURE_NOT_SUPPORTED' });
    });
  });
});
