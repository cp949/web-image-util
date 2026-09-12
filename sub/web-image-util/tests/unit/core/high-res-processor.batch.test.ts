import { describe, expect, it, vi } from 'vitest';
import { HighResolutionProcessor } from '../../../src/core/high-res-processor';
import { createDrawableImage } from './high-res-processor.helpers';

describe('HighResolutionProcessor.batchResize', () => {
  it('bare HTMLImageElement 항목은 공용 targetWidth/targetHeight 로 처리된다', async () => {
    const img1 = createDrawableImage(800, 600);
    const img2 = createDrawableImage(800, 600);

    const results = await HighResolutionProcessor.batchResize([img1, img2], 400, 300);

    expect(results).toHaveLength(2);
    expect(results[0].canvas.width).toBe(400);
    expect(results[1].canvas.width).toBe(400);
  });

  it('{img, width, height} 항목은 개별 크기로 오버라이드된다', async () => {
    const img1 = createDrawableImage(800, 600);
    const img2 = createDrawableImage(800, 600);

    const results = await HighResolutionProcessor.batchResize(
      [img1, { img: img2, width: 100, height: 50 }],
      400,
      300
    );

    expect(results[0].canvas.width).toBe(400);
    expect(results[1].canvas.width).toBe(100);
    expect(results[1].canvas.height).toBe(50);
  });

  it('bare 항목과 개별 크기 항목을 섞어도 순서를 보존한다', async () => {
    const img1 = createDrawableImage(800, 600);
    const img2 = createDrawableImage(800, 600);
    const img3 = createDrawableImage(800, 600);

    const results = await HighResolutionProcessor.batchResize(
      [{ img: img1, width: 10, height: 10 }, img2, { img: img3, width: 20, height: 20 }],
      400,
      300
    );

    expect(results[0].canvas.width).toBe(10);
    expect(results[1].canvas.width).toBe(400);
    expect(results[2].canvas.width).toBe(20);
  });

  it('onProgress 는 완료 개수/전체/이름으로 호출된다', async () => {
    const onProgress = vi.fn();
    const img1 = createDrawableImage(800, 600);
    const img2 = createDrawableImage(800, 600);

    await HighResolutionProcessor.batchResize([{ img: img1, name: 'a' }, { img: img2, name: 'b' }], 400, 300, {
      onProgress,
      concurrency: 1,
    });

    expect(onProgress).toHaveBeenCalledWith(1, 2, 'a');
    expect(onProgress).toHaveBeenCalledWith(2, 2, 'b');
  });

  it('onItemComplete 는 인덱스와 결과로 호출된다', async () => {
    const onItemComplete = vi.fn();
    const img1 = createDrawableImage(800, 600);

    await HighResolutionProcessor.batchResize([img1], 400, 300, { onItemComplete });

    expect(onItemComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: expect.anything() }));
  });

  it('항목 하나가 실패하면 전체가 reject 된다', async () => {
    const resizeSpy = vi.spyOn(HighResolutionProcessor, 'resize').mockRejectedValueOnce(new Error('실패'));
    const img1 = createDrawableImage(800, 600);
    const img2 = createDrawableImage(800, 600);

    await expect(HighResolutionProcessor.batchResize([img1, img2], 400, 300)).rejects.toThrow('실패');
    resizeSpy.mockRestore();
  });
});
