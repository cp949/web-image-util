/**
 * CanvasPool 통합 테스트 중 jsdom에서 안전한 케이스만 모은다.
 * - OnehotRenderer 직접 호출은 Canvas 입력만 받으므로 jsdom 가능.
 * - pool 정책 검증은 Image 로드 없이 pool API만 사용하므로 jsdom 가능.
 *
 * LazyRenderPipeline + Canvas 입력 출력 흐름 케이스는 production이 내부적으로
 * drawImage(naturalWidth만 설정된 Image)를 호출해 jsdom에서 실패하므로
 * browser 테스트에서 대표 실제 로딩 경로를 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import { OnehotRenderer } from '../../../src/core/onehot-renderer';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
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

  describe('OnehotRenderer + CanvasPool 통합', () => {
    it('연속 렌더링 시 pool hit이 증가해야 한다', () => {
      const calculator = new ResizeCalculator();
      const renderer = new OnehotRenderer();
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };

      const sourceCanvas1 = createMockCanvas(100, 100);
      const layout1 = calculator.calculateFinalLayout(100, 100, config);
      const result1 = renderer.render(sourceCanvas1, layout1, config);

      pool.release(result1);

      const statsAfterFirstRelease = pool.getStats();
      expect(statsAfterFirstRelease.poolSize).toBe(1);

      const sourceCanvas2 = createMockCanvas(100, 100);
      const layout2 = calculator.calculateFinalLayout(100, 100, config);
      renderer.render(sourceCanvas2, layout2, config);

      const statsAfterSecond = pool.getStats();
      expect(statsAfterSecond.poolHits).toBeGreaterThan(0);
    });

    it('렌더링 시 pool.acquire를 사용해야 한다', () => {
      const calculator = new ResizeCalculator();
      const renderer = new OnehotRenderer();
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };

      const acquireSpy = vi.spyOn(pool, 'acquire');

      const sourceCanvas = createMockCanvas(100, 100);
      const layout = calculator.calculateFinalLayout(100, 100, config);
      renderer.render(sourceCanvas, layout, config);

      expect(acquireSpy).toHaveBeenCalled();

      acquireSpy.mockRestore();
    });

    it('렌더링 결과로 반환된 canvas는 올바른 크기를 가져야 한다', () => {
      const calculator = new ResizeCalculator();
      const renderer = new OnehotRenderer();
      const config: ResizeConfig = { fit: 'fill', width: 300, height: 200 };

      const sourceCanvas = createMockCanvas(100, 100);
      const layout = calculator.calculateFinalLayout(100, 100, config);
      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(300);
      expect(result.height).toBe(200);
    });

    it('큰 canvas(2048x2048 초과)는 pool에 반환되지 않아야 한다', () => {
      const largeCanvas = createMockCanvas(2049, 2049);
      pool.release(largeCanvas);

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
      expect(stats.totalReleased).toBe(1);
    });

    it('렌더링 직후 반환된 canvas는 pool에서 조기 해제되지 않아야 한다', () => {
      const calculator = new ResizeCalculator();
      const renderer = new OnehotRenderer();
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };

      const sourceCanvas = createMockCanvas(100, 100);
      const layout = calculator.calculateFinalLayout(100, 100, config);
      const result = renderer.render(sourceCanvas, layout, config);

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);

      const stats = pool.getStats();
      expect(stats.totalReleased).toBe(0);
    });
  });

  describe('pool 정책 검증', () => {
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
