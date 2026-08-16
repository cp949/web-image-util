/**
 * AutoHighResProcessor.batchSmartResize 의 순서 보존, 콜백 인자, 실패 전파를 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoHighResProcessor } from '../../../src/core/auto-high-res';
import { createMockImage, makeAutoProcessingResult } from './auto-high-res.helpers';

describe('AutoHighResProcessor.batchSmartResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('결과 배열이 입력 이미지 순서를 유지한다', async () => {
    let callCount = 0;
    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = ++callCount * 100;
      return makeAutoProcessingResult(canvas);
    });

    const images = [
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img0' },
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img1' },
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img2' },
    ];

    const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1 });

    expect(results).toHaveLength(3);
    expect(results[0].canvas.width).toBe(100);
    expect(results[1].canvas.width).toBe(200);
    expect(results[2].canvas.width).toBe(300);
  });

  it('onProgress 에 완료 수, 전체 수, 이름을 순서대로 전달한다', async () => {
    vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult());

    const onProgress = vi.fn();
    const images = [
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'alpha' },
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'beta' },
    ];

    await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1, onProgress });

    expect(onProgress).toHaveBeenCalledWith(1, 2, 'alpha');
    expect(onProgress).toHaveBeenCalledWith(2, 2, 'beta');
  });

  it('onImageComplete에 원본 배열 index와 결과를 전달한다', async () => {
    vi.spyOn(AutoHighResProcessor, 'smartResize').mockResolvedValue(makeAutoProcessingResult());

    const onImageComplete = vi.fn();
    const images = [
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'alpha' },
      { img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'beta' },
    ];

    await AutoHighResProcessor.batchSmartResize(images, { concurrency: 1, onImageComplete });

    expect(onImageComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) }));
    expect(onImageComplete).toHaveBeenCalledWith(1, expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) }));
  });

  it('concurrency=2 환경에서 beta 가 먼저 완료돼도 결과 배열은 입력 순서(alpha→beta)를 유지한다', async () => {
    const imgAlpha = createMockImage(100, 100);
    const imgBeta = createMockImage(100, 100);
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = 111;
    const betaCanvas = document.createElement('canvas');
    betaCanvas.width = 222;

    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
      if (img === imgAlpha) {
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        return makeAutoProcessingResult(alphaCanvas);
      }
      return makeAutoProcessingResult(betaCanvas);
    });

    const images = [
      { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
      { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
    ];

    const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2 });

    expect(results[0].canvas.width).toBe(111);
    expect(results[1].canvas.width).toBe(222);
  });

  it('concurrency=2 환경에서 onImageComplete는 완료 순서와 무관하게 원본 배열 index를 전달한다', async () => {
    const imgAlpha = createMockImage(100, 100);
    const imgBeta = createMockImage(100, 100);
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = 111;
    const betaCanvas = document.createElement('canvas');
    betaCanvas.width = 222;

    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
      if (img === imgAlpha) {
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
        return makeAutoProcessingResult(alphaCanvas);
      }
      return makeAutoProcessingResult(betaCanvas);
    });

    const onImageComplete = vi.fn();
    const images = [
      { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
      { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
    ];

    await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

    expect(onImageComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: alphaCanvas }));
    expect(onImageComplete).toHaveBeenCalledWith(1, expect.objectContaining({ canvas: betaCanvas }));
  });

  it('한 항목이 처리 실패하면 전체 batchSmartResize Promise 가 reject 된다', async () => {
    vi.spyOn(AutoHighResProcessor, 'smartResize').mockRejectedValue(new Error('처리 실패'));

    const images = [{ img: createMockImage(100, 100), targetWidth: 50, targetHeight: 50, name: 'img0' }];

    await expect(AutoHighResProcessor.batchSmartResize(images, { concurrency: 1 })).rejects.toThrow('처리 실패');
  });

  it('concurrency=2 + 3장에서 두 번째 청크의 첫 항목 index는 2다', async () => {
    const imgs = [0, 1, 2].map(() => createMockImage(100, 100));
    const resultCanvases = [0, 1, 2].map((i) => {
      const c = document.createElement('canvas');
      c.width = (i + 1) * 100;
      return c;
    });

    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
      const imgIndex = imgs.indexOf(img as HTMLImageElement);
      return makeAutoProcessingResult(resultCanvases[imgIndex]);
    });

    const onImageComplete = vi.fn();
    const images = imgs.map((img, i) => ({ img, targetWidth: 50, targetHeight: 50, name: `img${i}` }));
    const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

    expect(results).toHaveLength(3);
    expect(results[0].canvas.width).toBe(100);
    expect(results[1].canvas.width).toBe(200);
    expect(results[2].canvas.width).toBe(300);
    expect(onImageComplete).toHaveBeenCalledWith(0, expect.objectContaining({ canvas: resultCanvases[0] }));
    expect(onImageComplete).toHaveBeenCalledWith(1, expect.objectContaining({ canvas: resultCanvases[1] }));
    expect(onImageComplete).toHaveBeenCalledWith(2, expect.objectContaining({ canvas: resultCanvases[2] }));
  });

  it('concurrency=2 + 4장에서 두 번째 청크의 항목은 index 2와 3에 매핑된다', async () => {
    const imgs = [0, 1, 2, 3].map(() => createMockImage(100, 100));
    const resultCanvases = [0, 1, 2, 3].map((i) => {
      const c = document.createElement('canvas');
      c.width = (i + 1) * 100;
      return c;
    });

    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
      const imgIndex = imgs.indexOf(img as HTMLImageElement);
      return makeAutoProcessingResult(resultCanvases[imgIndex]);
    });

    const onImageComplete = vi.fn();
    const images = imgs.map((img, i) => ({ img, targetWidth: 50, targetHeight: 50, name: `img${i}` }));
    const results = await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onImageComplete });

    expect(results).toHaveLength(4);
    expect(results[0].canvas.width).toBe(100);
    expect(results[1].canvas.width).toBe(200);
    expect(results[2].canvas.width).toBe(300);
    expect(results[3].canvas.width).toBe(400);
    expect(onImageComplete).toHaveBeenCalledWith(2, expect.objectContaining({ canvas: resultCanvases[2] }));
    expect(onImageComplete).toHaveBeenCalledWith(3, expect.objectContaining({ canvas: resultCanvases[3] }));
  });

  it('concurrency=2 환경에서 onProgress 마지막 호출은 전체 완료 수와 마지막 완료 이름을 전달한다', async () => {
    const imgAlpha = createMockImage(100, 100);
    const imgBeta = createMockImage(100, 100);

    vi.spyOn(AutoHighResProcessor, 'smartResize').mockImplementation(async (img) => {
      if (img === imgAlpha) {
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
      }
      return makeAutoProcessingResult();
    });

    const onProgress = vi.fn();
    const images = [
      { img: imgAlpha, targetWidth: 50, targetHeight: 50, name: 'alpha' },
      { img: imgBeta, targetWidth: 50, targetHeight: 50, name: 'beta' },
    ];

    await AutoHighResProcessor.batchSmartResize(images, { concurrency: 2, onProgress });

    const calls = onProgress.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toBe(2);
    expect(lastCall[1]).toBe(2);
    expect(lastCall[2]).toBe('alpha');
  });
});
