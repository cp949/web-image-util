/**
 * single-renderer 대형 canvas 경고 테스트
 *
 * 브라우저별 Canvas 최대 안전 치수가 메모리 경고 면적 임계값에 반영되는지 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { type FinalLayout, renderLayout } from '../../../src/core/single-renderer.internal';
import {
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../src/utils/browser-capabilities/canvas-limits.internal';
import { productionLog } from '../../../src/utils/debug.internal';

/** drawImage 소스로 쓸 수 있도록 natural 크기를 가진 canvas를 만든다. */
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

/** 경고 검증에 필요한 유효한 FinalLayout 기본값을 만든다. */
function makeLayout(overrides: Partial<FinalLayout> = {}): FinalLayout {
  return {
    width: 100,
    height: 100,
    position: { x: 0, y: 0 },
    imageSize: { width: 100, height: 100 },
    background: 'transparent',
    filters: [],
    ...overrides,
  };
}

describe('renderLayout — 대형 canvas 경고', () => {
  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  afterEach(() => {
    resetCanvasLimitProbe();
    vi.restoreAllMocks();
    CanvasPool.getInstance().clear();
  });

  it('면적이 16384^2를 넘으면 오류 없이 경고만 남긴다', () => {
    const small = document.createElement('canvas');
    small.width = 10;
    small.height = 10;
    vi.spyOn(CanvasPool.getInstance(), 'acquire').mockReturnValue(small);
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    lease.detach();
  });

  it('일반 크기에서는 경고하지 않는다', () => {
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    const lease = renderLayout(source, makeLayout());

    expect(warnSpy).not.toHaveBeenCalled();
    lease.release();
  });

  it('probe가 더 큰 상한을 돌려주면 이전에 경고하던 면적을 경고하지 않는다', () => {
    setCanvasLimitProbe({ read: () => 40000 });
    const small = document.createElement('canvas');
    small.width = 10;
    small.height = 10;
    vi.spyOn(CanvasPool.getInstance(), 'acquire').mockReturnValue(small);
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));

    expect(warnSpy).not.toHaveBeenCalled();
    lease.detach();
  });

  it('probe가 더 작은 상한을 돌려주면 이전에 경고하지 않던 면적도 경고한다', () => {
    setCanvasLimitProbe({ read: () => 1000 });
    const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
    const source = createDrawableSource(100, 100);

    const lease = renderLayout(source, makeLayout({ width: 2000, height: 2000 }));

    expect(warnSpy).toHaveBeenCalledTimes(1);
    lease.release();
  });
});
