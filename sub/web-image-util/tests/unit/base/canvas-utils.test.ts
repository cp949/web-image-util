/**
 * canvas-utils.ts 단위 테스트
 *
 * ManagedCanvas 클래스, withManagedCanvas 헬퍼, createOwnedCanvas,
 * 풀 관리 함수의
 * 구조적 속성(dimension, 호출 횟수, dispose 상태)을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import {
  canvasToBlob,
  clearCanvasPool,
  createOwnedCanvas,
  getCanvasPoolStats,
  ManagedCanvas,
  setCanvasPoolMaxSize,
  withManagedCanvas,
} from '../../../src/base/canvas-utils.internal';
import { ImageProcessError } from '../../../src/types';

// ============================================================================
// ManagedCanvas
// ============================================================================

describe('ManagedCanvas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('생성자', () => {
    it('지정한 크기로 캔버스를 생성한다', () => {
      const mc = new ManagedCanvas(120, 80);
      expect(mc.getCanvas().width).toBe(120);
      expect(mc.getCanvas().height).toBe(80);
      mc.dispose();
    });

    it('크기 미지정 시 HTMLCanvasElement를 생성한다', () => {
      const mc = new ManagedCanvas();
      expect(mc.getCanvas()).toBeInstanceOf(HTMLCanvasElement);
      mc.dispose();
    });

    it('생성 직후 isDisposed는 false이다', () => {
      const mc = new ManagedCanvas(10, 10);
      expect(mc.isDisposed()).toBe(false);
      mc.dispose();
    });
  });

  describe('getCanvas / getContext', () => {
    it('getCanvas는 HTMLCanvasElement를 반환한다', () => {
      const mc = new ManagedCanvas(50, 50);
      expect(mc.getCanvas()).toBeInstanceOf(HTMLCanvasElement);
      mc.dispose();
    });

    it('getContext는 truthy 2D 컨텍스트를 반환한다', () => {
      const mc = new ManagedCanvas(50, 50);
      expect(mc.getContext()).toBeTruthy();
      mc.dispose();
    });
  });

  describe('setSize', () => {
    it('캔버스 dimension을 변경한다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.setSize(200, 300);
      expect(mc.getCanvas().width).toBe(200);
      expect(mc.getCanvas().height).toBe(300);
      mc.dispose();
    });
  });

  describe('clear', () => {
    it('clearRect를 전체 캔버스 크기로 호출한다', () => {
      const mc = new ManagedCanvas(80, 60);
      const clearRectSpy = vi.spyOn(mc.getContext(), 'clearRect');
      mc.clear();
      expect(clearRectSpy).toHaveBeenCalledWith(0, 0, 80, 60);
      mc.dispose();
    });
  });

  describe('setBackgroundColor', () => {
    it('fillRect를 전체 캔버스 크기로 호출하고 fillStyle을 요청한 색으로 설정한다', () => {
      const mc = new ManagedCanvas(80, 60);
      const ctx = mc.getContext();
      const fillRectSpy = vi.spyOn(ctx, 'fillRect');
      mc.setBackgroundColor('#ff0000');
      expect(ctx.fillStyle).toBe('#ff0000');
      expect(fillRectSpy).toHaveBeenCalledWith(0, 0, 80, 60);
      mc.dispose();
    });
  });

  describe('dispose / isDisposed', () => {
    it('dispose 후 isDisposed가 true가 된다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(mc.isDisposed()).toBe(true);
    });

    it('dispose 후 getCanvas 호출 시 에러를 던진다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.getCanvas()).toThrow();
    });

    it('dispose 후 getContext 호출 시 에러를 던진다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.getContext()).toThrow();
    });

    it('dispose 후 setSize 호출 시 에러를 던진다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.setSize(100, 100)).toThrow();
    });

    it('dispose 후 clear 호출 시 에러를 던진다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.clear()).toThrow();
    });

    it('이중 dispose는 에러를 던지지 않는다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.dispose()).not.toThrow();
    });

    it('dispose 후 setBackgroundColor 호출 시 에러를 던진다', () => {
      const mc = new ManagedCanvas(50, 50);
      mc.dispose();
      expect(() => mc.setBackgroundColor('#ffffff')).toThrow();
    });
  });
});

// ============================================================================
// withManagedCanvas
// ============================================================================

describe('withManagedCanvas', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear();
  });

  it('오퍼레이션 반환값을 그대로 반환한다', async () => {
    const result = await withManagedCanvas(100, 100, () => 'hello');
    expect(result).toBe('hello');
  });

  it('임대 canvas를 오퍼레이션 결과로 반환할 수 없다', async () => {
    // @ts-expect-error pool에서 빌린 canvas는 withManagedCanvas 밖으로 내보낼 수 없다.
    await withManagedCanvas(100, 100, (canvas) => canvas);
  });

  it('오퍼레이션에 지정한 크기의 캔버스를 전달한다', async () => {
    await withManagedCanvas(120, 80, (canvas) => {
      expect(canvas.width).toBe(120);
      expect(canvas.height).toBe(80);
    });
  });

  it('오퍼레이션에 2D 컨텍스트를 전달한다', async () => {
    await withManagedCanvas(50, 50, (_canvas, ctx) => {
      expect(ctx).toBeTruthy();
    });
  });

  it('오퍼레이션 완료 후 캔버스를 풀에 반환한다', async () => {
    const statsBefore = pool.getStats().totalReleased;
    await withManagedCanvas(100, 100, () => 'done');
    expect(pool.getStats().totalReleased).toBe(statsBefore + 1);
  });

  it('오퍼레이션 에러 시에도 캔버스를 풀에 반환한다', async () => {
    const statsBefore = pool.getStats().totalReleased;
    await expect(
      withManagedCanvas(100, 100, () => {
        throw new Error('테스트 에러');
      })
    ).rejects.toThrow('테스트 에러');
    expect(pool.getStats().totalReleased).toBe(statsBefore + 1);
  });

  it('비동기 오퍼레이션을 지원한다', async () => {
    const result = await withManagedCanvas(50, 50, async () => {
      await Promise.resolve();
      return 42;
    });
    expect(result).toBe(42);
  });
});

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
