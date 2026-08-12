/**
 * canvas-utils.ts 단위 테스트
 *
 * createOwnedCanvas(owned canvas 어휘), canvasToBlob 인코더,
 * 풀 관리 함수의 구조적 속성(dimension, 호출 횟수, 통계)을 검증한다.
 *
 * pool 임대(lease) 어휘는 canvas-lease.test.ts가 담당한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import {
  canvasToBlob,
  clearCanvasPool,
  createOwnedCanvas,
  getCanvasPoolStats,
  setCanvasPoolMaxSize,
} from '../../../src/base/canvas-utils.internal';
import { ImageProcessError } from '../../../src/types';

// ============================================================================
// createOwnedCanvas
// ============================================================================

describe('createOwnedCanvas', () => {
  it('지정한 크기의 canvas와 context를 반환한다', () => {
    const { canvas, ctx } = createOwnedCanvas(120, 80);
    expect(canvas.width).toBe(120);
    expect(canvas.height).toBe(80);
    expect(ctx).toBeTruthy();
  });

  it('pool을 거치지 않는다 — acquire/release 통계가 변하지 않는다', () => {
    const pool = CanvasPool.getInstance();
    pool.clear();
    const before = pool.getStats();

    createOwnedCanvas(64, 64);

    const after = pool.getStats();
    expect(after.totalCreated).toBe(before.totalCreated);
    expect(after.totalReleased).toBe(before.totalReleased);
  });
});

// ============================================================================
// canvasToBlob — 통합 canvas→Blob 인코더
// ============================================================================

describe('canvasToBlob (통합 인코더)', () => {
  it('mimeType과 quality를 canvas.toBlob에 전달하고 Blob으로 resolve한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const toBlobSpy = vi.spyOn(canvas, 'toBlob');

    const blob = await canvasToBlob(canvas, { mimeType: 'image/png', quality: 1 });

    expect(blob).toBeInstanceOf(Blob);
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/png', 1);
    toBlobSpy.mockRestore();
  });

  it('1차 인코딩 실패 시 fallbackMimeType으로 1회 재시도한다', async () => {
    const canvas = document.createElement('canvas');
    const fakeBlob = new Blob(['x'], { type: 'image/png' });
    const toBlobSpy = vi
      .spyOn(canvas, 'toBlob')
      .mockImplementationOnce((cb: any) => cb(null))
      .mockImplementationOnce((cb: any) => cb(fakeBlob));

    const blob = await canvasToBlob(canvas, {
      mimeType: 'image/webp',
      quality: 0.5,
      fallbackMimeType: 'image/png',
    });

    expect(blob).toBe(fakeBlob);
    expect(toBlobSpy).toHaveBeenCalledTimes(2);
    expect(toBlobSpy.mock.calls[1][1]).toBe('image/png');
    expect(toBlobSpy.mock.calls[1][2]).toBe(0.5);
    toBlobSpy.mockRestore();
  });

  it('fallbackMimeType 미지정이면 재시도 없이 reject한다', async () => {
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((cb: any) => cb(null));

    await expect(canvasToBlob(canvas, { mimeType: 'image/png' })).rejects.toBeInstanceOf(ImageProcessError);
    expect(toBlobSpy).toHaveBeenCalledTimes(1);
    toBlobSpy.mockRestore();
  });

  it('재시도까지 실패하면 기본 코드 CANVAS_TO_BLOB_FAILED와 고정 메시지로 reject한다', async () => {
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((cb: any) => cb(null));

    await expect(canvasToBlob(canvas, { mimeType: 'image/webp', fallbackMimeType: 'image/png' })).rejects.toMatchObject(
      {
        code: 'CANVAS_TO_BLOB_FAILED',
        message: 'Canvas to Blob conversion failed',
      }
    );
    expect(toBlobSpy).toHaveBeenCalledTimes(2);
    toBlobSpy.mockRestore();
  });

  it('toBlob이 동기로 throw하면(tainted canvas 등) 원인을 cause로 보존한 ImageProcessError로 reject한다', async () => {
    const canvas = document.createElement('canvas');
    const securityError = new Error('SecurityError: tainted canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation(() => {
      throw securityError;
    });

    await expect(canvasToBlob(canvas, { mimeType: 'image/png' })).rejects.toMatchObject({
      code: 'CANVAS_TO_BLOB_FAILED',
      cause: securityError,
    });
    toBlobSpy.mockRestore();
  });

  it('errorCode 옵션이 에러 code에 반영된다', async () => {
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi.spyOn(canvas, 'toBlob').mockImplementation((cb: any) => cb(null));

    await expect(canvasToBlob(canvas, { mimeType: 'image/png', errorCode: 'OUTPUT_FAILED' })).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
    });
    toBlobSpy.mockRestore();
  });
});

// ============================================================================
// 풀 관리 헬퍼
// ============================================================================

describe('풀 관리 헬퍼', () => {
  let pool: CanvasPool;
  let originalMaxSize: number;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    originalMaxSize = pool.getStats().maxPoolSize;
    pool.clear();
  });

  afterEach(() => {
    pool.setMaxPoolSize(originalMaxSize);
    pool.clear();
  });

  it('getCanvasPoolStats는 통계 객체를 반환한다', () => {
    const stats = getCanvasPoolStats();
    expect(stats).toBeDefined();
    expect(typeof stats.poolSize).toBe('number');
  });

  it('clearCanvasPool은 풀을 비운다', () => {
    pool.release(document.createElement('canvas'));
    clearCanvasPool();
    expect(getCanvasPoolStats().poolSize).toBe(0);
  });

  it('setCanvasPoolMaxSize는 최대 크기를 설정한다', () => {
    setCanvasPoolMaxSize(5);
    expect(getCanvasPoolStats().maxPoolSize).toBe(5);
  });
});
