/**
 * canvas-utils.ts 단위 테스트
 *
 * ManagedCanvas 클래스, withManagedCanvas / withMultipleManagedCanvas 헬퍼,
 * copyCanvas, setupHighQualityCanvas, 풀 관리 함수의
 * 구조적 속성(dimension, 호출 횟수, dispose 상태)을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import {
  canvasToBlob,
  clearCanvasPool,
  copyCanvas,
  getCanvasPoolStats,
  ManagedCanvas,
  setCanvasPoolMaxSize,
  setupHighQualityCanvas,
  withManagedCanvas,
  withMultipleManagedCanvas,
} from '../../../src/base/canvas-utils';
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
    it('fillRect를 전체 캔버스 크기로 호출한다', () => {
      const mc = new ManagedCanvas(80, 60);
      const fillRectSpy = vi.spyOn(mc.getContext(), 'fillRect');
      mc.setBackgroundColor('#ff0000');
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
// withMultipleManagedCanvas
// ============================================================================

describe('withMultipleManagedCanvas', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear();
  });

  it('지정한 개수만큼 캔버스를 오퍼레이션에 전달한다', async () => {
    const sizes = [
      { width: 100, height: 50 },
      { width: 200, height: 100 },
      { width: 150, height: 75 },
    ];
    await withMultipleManagedCanvas(sizes, (canvases) => {
      expect(canvases).toHaveLength(3);
    });
  });

  it('각 캔버스가 지정한 크기를 갖는다', async () => {
    const sizes = [
      { width: 80, height: 60 },
      { width: 320, height: 240 },
    ];
    await withMultipleManagedCanvas(sizes, (canvases) => {
      expect(canvases[0].canvas.width).toBe(80);
      expect(canvases[0].canvas.height).toBe(60);
      expect(canvases[1].canvas.width).toBe(320);
      expect(canvases[1].canvas.height).toBe(240);
    });
  });

  it('오퍼레이션 완료 후 모든 캔버스를 풀에 반환한다', async () => {
    const statsBefore = pool.getStats().totalReleased;
    await withMultipleManagedCanvas(
      [
        { width: 50, height: 50 },
        { width: 50, height: 50 },
      ],
      () => 'done'
    );
    expect(pool.getStats().totalReleased).toBe(statsBefore + 2);
  });

  it('오퍼레이션 결과를 반환한다', async () => {
    const result = await withMultipleManagedCanvas([{ width: 50, height: 50 }], () => 99);
    expect(result).toBe(99);
  });
});

// ============================================================================
// copyCanvas
// ============================================================================

describe('copyCanvas', () => {
  it('대상 크기 미지정 시 소스와 동일한 dimension을 가진 캔버스를 반환한다', async () => {
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 50;
    const copy = await copyCanvas(source);
    expect(copy.width).toBe(100);
    expect(copy.height).toBe(50);
  });

  it('대상 크기 지정 시 해당 dimension을 가진 캔버스를 반환한다', async () => {
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 50;
    const copy = await copyCanvas(source, 200, 100);
    expect(copy.width).toBe(200);
    expect(copy.height).toBe(100);
  });
});

// ============================================================================
// canvasToBlob (canvas-utils 버전)
// ============================================================================

describe('canvasToBlob (canvas-utils)', () => {
  it('PNG Blob으로 resolve한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const blob = await canvasToBlob(canvas, 'image/png', 1);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('toBlob이 null을 반환하면 ImageProcessError로 reject한다', async () => {
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi
      .spyOn(canvas, 'toBlob')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((cb: any) => cb(null));
    await expect(canvasToBlob(canvas, 'image/png', 1)).rejects.toBeInstanceOf(ImageProcessError);
    toBlobSpy.mockRestore();
  });
});

// ============================================================================
// setupHighQualityCanvas
// ============================================================================

describe('setupHighQualityCanvas', () => {
  it('기본 옵션으로 논리 크기와 동일한 캔버스를 생성한다', () => {
    const { canvas } = setupHighQualityCanvas(200, 150);
    // useDevicePixelRatio 기본값 false이고 scale 기본값 1이므로 totalScale=1
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(150);
  });

  it('scale 옵션이 적용되어 캔버스 크기가 배율에 맞게 커진다', () => {
    const { canvas } = setupHighQualityCanvas(100, 80, { scale: 2 });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(160);
  });

  it('scale이 4를 초과하면 4로 클램프된다', () => {
    const { canvas } = setupHighQualityCanvas(100, 100, { scale: 10 });
    // Math.min(4, Math.max(1, 10)) = 4
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
  });

  it('scale이 1 미만이면 1로 클램프된다', () => {
    const { canvas } = setupHighQualityCanvas(100, 100, { scale: 0.1 });
    // Math.min(4, Math.max(1, 0.1)) = 1
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(100);
  });

  it('CSS 논리 크기가 width/height로 설정된다', () => {
    const { canvas } = setupHighQualityCanvas(300, 200, { scale: 2 });
    expect(canvas.style.width).toBe('300px');
    expect(canvas.style.height).toBe('200px');
  });

  it('imageSmoothingEnabled는 true이다', () => {
    const { context } = setupHighQualityCanvas(100, 100);
    expect(context.imageSmoothingEnabled).toBe(true);
  });

  it('기본 imageSmoothingQuality는 high이다', () => {
    const { context } = setupHighQualityCanvas(100, 100);
    expect(context.imageSmoothingQuality).toBe('high');
  });

  it('imageSmoothingQuality 옵션을 지정하면 해당 값이 적용된다', () => {
    const { context } = setupHighQualityCanvas(100, 100, { imageSmoothingQuality: 'low' });
    expect(context.imageSmoothingQuality).toBe('low');
  });

  it('useDevicePixelRatio=true이면 devicePixelRatio가 scale에 반영된다', () => {
    const originalDpr = window.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    try {
      const { canvas } = setupHighQualityCanvas(100, 100, { useDevicePixelRatio: true });
      // totalScale = Math.min(4, Math.max(1, 2 * 1)) = 2
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
    } finally {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
    }
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
