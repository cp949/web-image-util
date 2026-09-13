/**
 * single-renderer의 maxOutputPixels 하드 리젝트 테스트.
 *
 * 축 길이 경고(기존 동작)와는 별개로, opt-in 픽셀 수 상한을 지정했을 때만 동작하는
 * 신규 하드 거부를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { type FinalLayout, renderLayout } from '../../../src/core/single-renderer.internal';

function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

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

describe('renderLayout — maxOutputPixels', () => {
  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  afterEach(() => {
    CanvasPool.getInstance().clear();
  });

  it('maxOutputPixels 생략 시 초대형 canvas도 거부하지 않는다(기존 동작 보존)', () => {
    const source = createDrawableSource(100, 100);
    const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));
    lease.detach();
  });

  it('canvas 면적이 maxOutputPixels를 넘으면 PIXEL_BUDGET_EXCEEDED를 던진다', () => {
    const source = createDrawableSource(100, 100);
    expect(() => renderLayout(source, makeLayout({ width: 200, height: 200 }), 10_000)).toThrow(
      expect.objectContaining({
        code: 'PIXEL_BUDGET_EXCEEDED',
        details: expect.objectContaining({ direction: 'output', actualPixels: 40_000, maxPixels: 10_000 }),
      })
    );
  });

  it('canvas 면적이 maxOutputPixels 이하면 통과한다', () => {
    const source = createDrawableSource(100, 100);
    const lease = renderLayout(source, makeLayout({ width: 100, height: 100 }), 10_000);
    lease.release();
  });

  it('반올림 후 면적이 maxOutputPixels를 넘으면 소수점 치수로도 거부한다(반올림 우회 방지)', () => {
    // 원시값 150.6*150.6=22680.36은 한도(22700) 이하지만, 실제 canvas는
    // Math.round(150.6)=151로 할당돼 151*151=22801로 한도를 넘는다.
    const source = createDrawableSource(100, 100);
    expect(() => renderLayout(source, makeLayout({ width: 150.6, height: 150.6 }), 22_700)).toThrow(
      expect.objectContaining({ code: 'PIXEL_BUDGET_EXCEEDED' })
    );
  });

  it('거부되면 Canvas pool에서 아무 것도 임대하지 않는다', () => {
    const acquireSpy = vi.spyOn(CanvasPool.getInstance(), 'acquire');
    const source = createDrawableSource(100, 100);
    expect(() => renderLayout(source, makeLayout({ width: 200, height: 200 }), 10_000)).toThrow();
    expect(acquireSpy).not.toHaveBeenCalled();
    acquireSpy.mockRestore();
  });
});
