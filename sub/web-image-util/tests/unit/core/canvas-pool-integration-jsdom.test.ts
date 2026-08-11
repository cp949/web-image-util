/**
 * CanvasPool 통합 테스트 중 jsdom에서 안전한 케이스만 모은다.
 * - renderLayout 직접 호출은 Canvas 입력을 소스로 쓰면 jsdom 가능.
 * - pool 정책 검증은 Image 로드 없이 pool API만 사용하므로 jsdom 가능.
 *
 * LazyRenderPipeline + Canvas 입력 출력 흐름 케이스는 production이 내부적으로
 * drawImage(naturalWidth만 설정된 Image)를 호출해 jsdom에서 실패하므로
 * browser 테스트에서 대표 실제 로딩 경로를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import type { LazyOperation } from '../../../src/core/lazy-render-pipeline.internal';
import { analyzeAllOperations, renderLayout } from '../../../src/core/single-renderer.internal';

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// drawImage 를 안전하게 수행할 수 있는 소스 캔버스를 이미지처럼 사용
// node-canvas 는 drawImage 의 소스로 Canvas 를 수락한다
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = createMockCanvas(width, height);
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

// 소스와 연산으로 레이아웃 계산 후 렌더링하는 헬퍼
function renderWithOps(source: HTMLImageElement, ops: LazyOperation[]) {
  return renderLayout(source, analyzeAllOperations(source, ops));
}

describe('CanvasPool 통합 (jsdom-safe)', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear();
  });

  afterEach(() => {
    pool.clear();
  });

  describe('renderLayout + CanvasPool 통합', () => {
    const resizeOps: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 200, height: 200 } }];

    it('lease 반환 후 다시 렌더링하면 pool hit이 증가해야 한다', () => {
      const lease1 = renderWithOps(createDrawableSource(100, 100), resizeOps);
      lease1.release();

      const statsAfterFirstRelease = pool.getStats();
      expect(statsAfterFirstRelease.poolSize).toBe(1);

      const lease2 = renderWithOps(createDrawableSource(100, 100), resizeOps);

      const statsAfterSecond = pool.getStats();
      expect(statsAfterSecond.poolHits).toBeGreaterThan(0);
      lease2.release();
    });

    it('렌더링 직후 lease를 소비하기 전에는 pool로 반환되지 않아야 한다', () => {
      const lease = renderWithOps(createDrawableSource(100, 100), resizeOps);

      const stats = pool.getStats();
      expect(stats.totalReleased).toBe(0);
      lease.release();
    });
  });

  describe('pool 정책 검증', () => {
    it('큰 canvas(2048x2048 초과)는 pool에 반환되지 않아야 한다', () => {
      const largeCanvas = createMockCanvas(2049, 2049);
      pool.release(largeCanvas);

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
      expect(stats.totalReleased).toBe(1);
    });

    it('pool이 가득 찼을 때 초과 canvas는 dispose되야 한다', () => {
      pool.setMaxPoolSize(2);

      for (let i = 0; i < 3; i++) {
        pool.release(createMockCanvas(100, 100));
      }

      const stats = pool.getStats();
      expect(stats.poolSize).toBeLessThanOrEqual(2);
      expect(stats.totalReleased).toBe(3);
    });

    it('pool.acquire는 항상 올바른 크기의 canvas를 반환해야 한다', () => {
      const canvas = createMockCanvas(200, 200);
      pool.release(canvas);

      const acquired = pool.acquire(300, 150);

      expect(acquired.width).toBe(300);
      expect(acquired.height).toBe(150);
    });

    it('pool.acquire는 pool이 비어있을 때 새 canvas를 생성해야 한다', () => {
      const statsBefore = pool.getStats();
      expect(statsBefore.poolSize).toBe(0);

      pool.acquire(100, 100);

      const statsAfter = pool.getStats();
      expect(statsAfter.totalCreated).toBe(1);
      expect(statsAfter.poolHits).toBe(0);
    });
  });
});
