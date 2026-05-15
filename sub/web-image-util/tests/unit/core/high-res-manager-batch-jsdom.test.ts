/**
 * HighResolutionManager.batchSmartResize 행동 테스트
 *
 * 배치 함수는 내부적으로 smartResize 를 위임하므로 vi.spyOn 으로 격리하고
 * - 반환 배열 길이 / globalIndex 매핑
 * - onBatchProgress 콜백 계약
 * - smartResize 전달 인자(targetWidth/Height/processingOptions)
 * - 한 이미지 실패 시 ImageProcessError(RESIZE_FAILED) 래핑과 컨텍스트 보존
 * 을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HighResolutionManager } from '../../../src/base/high-res-manager';
import { createMockImage, makeProcessingResult } from './high-res-manager-helpers';

describe('HighResolutionManager.batchSmartResize', () => {
  let smartResizeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // batchSmartResize 는 내부적으로 smartResize 를 위임하므로 spy 로 격리
    // mockImplementation 으로 호출마다 고유한 canvas 를 반환해
    // 결과 배열의 구멍(undefined)과 globalIndex 매핑 오류를 검출 가능하게 한다
    smartResizeSpy = vi.spyOn(HighResolutionManager, 'smartResize').mockImplementation(async (img) => {
      const canvas = document.createElement('canvas');
      (canvas as any).__imageRef = img;
      return makeProcessingResult({ canvas }) as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('이미지 2개 → 결과 배열 길이 2', async () => {
    const images = [createMockImage(100, 100), createMockImage(100, 100)];
    const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

    expect(results).toHaveLength(2);
  });

  it('이미지 3개 → 결과 배열 길이 3', async () => {
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
    const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

    expect(results).toHaveLength(3);
  });

  it('각 결과는 canvas 를 갖는다', async () => {
    const images = [createMockImage(100, 100), createMockImage(100, 100)];
    const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

    for (const r of results) {
      expect(r).toHaveProperty('canvas');
      expect(r.canvas).toBeInstanceOf(HTMLCanvasElement);
    }
  });

  it('smartResize 는 이미지 수만큼 호출된다', async () => {
    const images = [createMockImage(100, 100), createMockImage(100, 100), createMockImage(100, 100)];
    await HighResolutionManager.batchSmartResize(images, 50, 50);

    expect(smartResizeSpy).toHaveBeenCalledTimes(3);
  });

  it('onBatchProgress 는 이미지 완료마다 호출된다', async () => {
    const onBatchProgress = vi.fn();
    const images = [createMockImage(100, 100), createMockImage(100, 100)];
    await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

    expect(onBatchProgress).toHaveBeenCalledTimes(2);
  });

  it('마지막 onBatchProgress 호출 시 completed === images.length 다', async () => {
    const calls: Array<[number, number]> = [];
    const onBatchProgress = vi.fn((completed, total) => calls.push([completed, total]));
    const images = [createMockImage(100, 100), createMockImage(100, 100), createMockImage(100, 100)];
    await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

    const last = calls[calls.length - 1];
    expect(last?.[0]).toBe(images.length);
  });

  it('onBatchProgress 의 두 번째 인자(total)는 항상 images.length 다', async () => {
    const calls: Array<[number, number]> = [];
    const onBatchProgress = vi.fn((completed, total) => calls.push([completed, total]));
    const images = [createMockImage(100, 100), createMockImage(100, 100)];
    await HighResolutionManager.batchSmartResize(images, 50, 50, { onBatchProgress });

    for (const [, total] of calls) {
      expect(total).toBe(images.length);
    }
  });

  it('이미지 배열이 비어 있으면 빈 배열을 반환한다', async () => {
    const results = await HighResolutionManager.batchSmartResize([], 50, 50);

    expect(results).toHaveLength(0);
  });

  it('결과 배열에 undefined 구멍이 없다(3개 입력, 청크 2개)', async () => {
    // concurrency=2 기본값 → chunk[0]=[img0,img1], chunk[1]=[img2]
    // globalIndex 오류 시 results[2] 가 sparse hole 로 남을 수 있다
    // Array.from 으로 sparse hole 을 실제 undefined 로 구체화한 뒤 단정
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
    const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

    expect(Array.from(results)).not.toContain(undefined);
  });

  it('3개 이미지(청크 2개) — results[i]는 images[i]에 대응한다(globalIndex 매핑 검증)', async () => {
    // globalIndex = chunks.indexOf(chunk) * concurrency + chunkIndex
    // 오류 시 results[i].canvas.__imageRef 가 images[i] 와 불일치
    const images = [createMockImage(100, 100), createMockImage(200, 200), createMockImage(150, 150)];
    const results = await HighResolutionManager.batchSmartResize(images, 50, 50);

    for (let i = 0; i < images.length; i++) {
      expect((results[i].canvas as any).__imageRef).toBe(images[i]);
    }
  });

  it('smartResize 에 targetWidth/targetHeight/processingOptions 가 그대로 전달된다', async () => {
    // 회귀 위험: targetWidth/Height 뒤바뀜 or processingOptions 누락 시 배치 경로 전체가 조용히 오작동
    // concurrency/onBatchProgress 는 batchSmartResize 자체가 소비하고 smartResize 에는 전달하지 않는다
    const images = [createMockImage(100, 100), createMockImage(200, 200)];
    const onBatchProgress = vi.fn();
    const onProgress = vi.fn();

    await HighResolutionManager.batchSmartResize(images, 300, 200, {
      quality: 'high',
      forceStrategy: 'direct',
      concurrency: 1,
      onBatchProgress,
      onProgress,
    });

    expect(smartResizeSpy).toHaveBeenCalledTimes(2);

    for (let i = 0; i < images.length; i++) {
      const call = smartResizeSpy.mock.calls[i] as unknown[];
      // 2번 인자: targetWidth, 3번 인자: targetHeight
      expect(call[1]).toBe(300);
      expect(call[2]).toBe(200);
      // 4번 인자: processingOptions — quality/forceStrategy/onProgress 포함
      const processingOptions = call[3] as Record<string, unknown>;
      expect(processingOptions).toMatchObject({ quality: 'high', forceStrategy: 'direct', onProgress });
      // concurrency/onBatchProgress 는 전달되면 안 된다
      expect(processingOptions).not.toHaveProperty('concurrency');
      expect(processingOptions).not.toHaveProperty('onBatchProgress');
    }
  });

  // --------------------------------------------------------------------------
  // 오류 래핑 — 한 이미지 실패 시 ImageProcessError(RESIZE_FAILED) + 컨텍스트 보존
  // --------------------------------------------------------------------------
  // 회귀 위험: 사용자가 의도된 ImageProcessError(코드/원인/실패 인덱스) 대신
  // raw 에러를 받게 되면 디버깅 컨텍스트가 사라진다.
  describe('오류 래핑', () => {
    it('한 이미지가 실패하면 ImageProcessError(코드=RESIZE_FAILED)로 래핑되어 던져진다', async () => {
      const innerError = new Error('boom');
      // beforeEach 의 mockImplementation 위에 1회 실패를 큐잉한다
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      await expect(HighResolutionManager.batchSmartResize(images, 50, 50)).rejects.toMatchObject({
        name: 'ImageProcessError',
        code: 'RESIZE_FAILED',
      });
    });

    it('래핑된 에러는 cause 로 원래 에러를 보존한다', async () => {
      const innerError = new Error('boom');
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      try {
        await HighResolutionManager.batchSmartResize(images, 50, 50);
        throw new Error('던져졌어야 한다');
      } catch (err: unknown) {
        expect((err as { cause?: unknown }).cause).toBe(innerError);
      }
    });

    it('래핑된 에러는 context.debug.stage="Batch processing" 과 실패 index 를 보존한다', async () => {
      const innerError = new Error('boom');
      // 첫 호출만 실패 → globalIndex=0 (concurrency=2 기본, chunk[0]=[img0,img1])
      smartResizeSpy.mockRejectedValueOnce(innerError);
      const images = [createMockImage(100, 100), createMockImage(100, 100)];

      try {
        await HighResolutionManager.batchSmartResize(images, 50, 50);
        throw new Error('던져졌어야 한다');
      } catch (err: unknown) {
        const ctx = (err as { context?: { debug?: { stage?: unknown; index?: unknown } } }).context;
        expect(ctx?.debug?.stage).toBe('Batch processing');
        expect(ctx?.debug?.index).toBe(0);
      }
    });
  });
});
