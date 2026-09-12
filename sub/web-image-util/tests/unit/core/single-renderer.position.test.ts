/**
 * single-renderer position(gravity/focal-point) 통합 테스트
 *
 * analyzeAllOperations가 계산한 position이 renderLayout의 단 한 번의 drawImage 호출에
 * 정확한 정수 인자로 전달되는지 확인한다. 픽셀 비교는 하지 않는다 — 오프셋 산술 자체는
 * resize-calculator.position.test.ts가 이미 전수 검증했다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { analyzeAllOperations, type LazyOperation, renderLayout } from '../../../src/core/single-renderer.internal';

// node-canvas 는 drawImage 소스로 Canvas 를 수락한다
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

/** drawImage 호출 인자(소스 제외)를 모으고 정확히 1회 호출됐는지 함께 확인한다 */
function captureDrawImageCall(run: () => CanvasLease): unknown[] {
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  const calls: unknown[][] = [];
  const spy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation((...args: unknown[]) => {
    calls.push(args);
  });
  let lease: CanvasLease | null = null;

  try {
    lease = run();
    expect(calls).toHaveLength(1);
    return calls[0].slice(1);
  } finally {
    lease?.release();
    spy.mockRestore();
  }
}

describe('single-renderer — position 통합', () => {
  // jsdom은 ctx 메서드를 생성 시점에 인스턴스 own property로 바인딩하므로,
  // pool이 재활용한 canvas의 ctx는 이전 테스트의 spy를 물고 있을 수 있다.
  // 테스트 간 pool을 비워 항상 새 ctx가 만들어지게 한다.
  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    CanvasPool.getInstance().clear();
  });

  it('cover + gravity: top-left는 (0, 0)에서 1회 drawImage된다', () => {
    const source = createDrawableSource(200, 100);
    const ops: LazyOperation[] = [
      { type: 'resize', config: { fit: 'cover', width: 100, height: 100, position: 'top-left' } },
    ];

    const args = captureDrawImageCall(() => renderLayout(source, analyzeAllOperations(source, ops)));

    expect(args).toEqual([0, 0, 200, 100]);
  });

  it('cover + gravity: bottom-right는 우하단 정렬로 1회 drawImage된다', () => {
    const source = createDrawableSource(200, 100);
    const ops: LazyOperation[] = [
      { type: 'resize', config: { fit: 'cover', width: 100, height: 100, position: 'bottom-right' } },
    ];

    const args = captureDrawImageCall(() => renderLayout(source, analyzeAllOperations(source, ops)));

    expect(args).toEqual([-100, 0, 200, 100]);
  });

  it('cover + focal-point는 계산된 오프셋으로 1회 drawImage된다', () => {
    const source = createDrawableSource(1000, 500);
    const ops: LazyOperation[] = [
      { type: 'resize', config: { fit: 'cover', width: 500, height: 500, position: { x: 0.35, y: 0.5 } } },
    ];

    const args = captureDrawImageCall(() => renderLayout(source, analyzeAllOperations(source, ops)));

    expect(args).toEqual([-100, 0, 1000, 500]);
  });

  it('contain + gravity: bottom-center는 세로 margin을 아래로 몰아 1회 drawImage된다', () => {
    const source = createDrawableSource(100, 50);
    const ops: LazyOperation[] = [
      { type: 'resize', config: { fit: 'contain', width: 200, height: 200, position: 'bottom-center' } },
    ];

    const args = captureDrawImageCall(() => renderLayout(source, analyzeAllOperations(source, ops)));

    expect(args).toEqual([0, 100, 200, 100]);
  });

  it('position을 생략하면 기존 중앙 정렬로 1회 drawImage된다(회귀 없음)', () => {
    const source = createDrawableSource(200, 100);
    const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 100, height: 100 } }];

    const args = captureDrawImageCall(() => renderLayout(source, analyzeAllOperations(source, ops)));

    expect(args).toEqual([-50, 0, 200, 100]);
  });
});
