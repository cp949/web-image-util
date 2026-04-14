/**
 * CanvasPool 통합 테스트
 *
 * 렌더링 경로에 CanvasPool이 올바르게 연결됐는지 검증한다.
 * - OnehotRenderer가 pool에서 canvas를 가져오는지 확인
 * - LazyRenderPipeline이 toBlob 후 중간 canvas를 pool에 반환하는지 확인
 * - 최종 출력 canvas는 pool에 조기 반환되지 않는지 확인
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';
import { OnehotRenderer } from '../../../src/core/onehot-renderer';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

// ============================================================================
// 테스트 유틸리티
// ============================================================================

/** 테스트용 Mock Canvas 생성 */
function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** 테스트용 Mock Image 생성 */
function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

// ============================================================================
// 테스트 케이스
// ============================================================================

describe('CanvasPool 통합', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear(); // 각 테스트 전에 pool 초기화
  });

  afterEach(() => {
    pool.clear();
  });

  describe('OnehotRenderer + CanvasPool 통합', () => {
    it('연속 렌더링 시 pool hit이 증가해야 한다', () => {
      const calculator = new ResizeCalculator();
      const renderer = new OnehotRenderer();
      const config: ResizeConfig = { fit: 'cover', width: 200, height: 200 };

      // 첫 번째 렌더링 - pool에 canvas가 없으므로 새로 생성
      const sourceCanvas1 = createMockCanvas(100, 100);
      const layout1 = calculator.calculateFinalLayout(100, 100, config);
      const result1 = renderer.render(sourceCanvas1, layout1, config);

      // 결과 canvas를 pool에 반환 (소비자가 다 쓴 것처럼)
      pool.release(result1);

      const statsAfterFirstRelease = pool.getStats();
      expect(statsAfterFirstRelease.poolSize).toBe(1);

      // 두 번째 렌더링 - pool에서 canvas를 재사용해야 한다
      const sourceCanvas2 = createMockCanvas(100, 100);
      const layout2 = calculator.calculateFinalLayout(100, 100, config);
      renderer.render(sourceCanvas2, layout2, config);

      const statsAfterSecond = pool.getStats();
      // pool hit이 발생해야 한다 (pool에서 canvas를 가져옴)
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

      // pool.acquire가 출력 canvas 생성에 사용돼야 한다
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

      // pool에서 가져왔더라도 올바른 크기로 설정돼야 한다
      expect(result.width).toBe(300);
      expect(result.height).toBe(200);
    });

    it('큰 canvas(2048x2048 초과)는 pool에 반환되지 않아야 한다', () => {
      // 2049x2049 canvas를 pool에 release 시도
      const largeCanvas = createMockCanvas(2049, 2049);
      pool.release(largeCanvas);

      const stats = pool.getStats();
      // 큰 canvas는 pool에 보관하지 않고 dispose한다
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

      // 렌더러가 반환한 canvas는 소비자 소유 - 크기가 유효해야 한다
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);

      // pool에서 자동으로 release 되지 않아야 한다 (pool에 없어야 함)
      const stats = pool.getStats();
      expect(stats.totalReleased).toBe(0);
    });
  });

  describe('LazyRenderPipeline + CanvasPool 통합', () => {
    it('toBlob 완료 후 내부 canvas가 pool에 반환돼야 한다', async () => {
      const mockImage = createMockImage(800, 600);
      const pipeline = new LazyRenderPipeline(mockImage);
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      const releasedBefore = pool.getStats().totalReleased;

      await pipeline.toBlob();

      // toBlob 완료 후 내부 렌더링 canvas가 pool에 반환돼야 한다
      const releasedAfter = pool.getStats().totalReleased;
      expect(releasedAfter - releasedBefore).toBe(1);
    });

    it('toCanvas는 canvas를 pool에 반환하지 않아야 한다', () => {
      const mockImage = createMockImage(800, 600);
      const pipeline = new LazyRenderPipeline(mockImage);
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      const releaseSpy = vi.spyOn(pool, 'release');

      const { canvas } = pipeline.toCanvas();

      // toCanvas는 canvas를 소비자에게 반환 - pool에 돌려보내면 안 된다
      expect(releaseSpy).not.toHaveBeenCalled();

      // 반환된 canvas는 유효한 크기를 가져야 한다
      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(200);

      releaseSpy.mockRestore();
    });

    it('연속 toBlob 호출 시 pool hit이 증가해야 한다', async () => {
      const mockImage = createMockImage(800, 600);

      // 첫 번째 파이프라인 실행 - 내부 canvas가 pool에 반환됨
      const pipeline1 = new LazyRenderPipeline(mockImage);
      pipeline1.addResize({ fit: 'cover', width: 300, height: 200 });
      await pipeline1.toBlob();

      const statsAfterFirst = pool.getStats();
      // 첫 번째 toBlob 후 canvas가 pool에 있어야 한다
      expect(statsAfterFirst.poolSize).toBe(1);

      // 두 번째 파이프라인 실행 - pool에서 canvas를 재사용해야 한다
      const pipeline2 = new LazyRenderPipeline(mockImage);
      pipeline2.addResize({ fit: 'cover', width: 300, height: 200 });
      await pipeline2.toBlob();

      const statsAfterSecond = pool.getStats();
      expect(statsAfterSecond.poolHits).toBeGreaterThan(0);
    });
  });

  describe('pool 정책 검증', () => {
    it('pool이 가득 찼을 때 초과 canvas는 dispose되야 한다', () => {
      // maxPoolSize를 2로 제한
      pool.setMaxPoolSize(2);

      // 3개의 canvas를 pool에 반환
      for (let i = 0; i < 3; i++) {
        pool.release(createMockCanvas(100, 100));
      }

      const stats = pool.getStats();
      // pool 크기는 maxPoolSize(2)를 초과하지 않아야 한다
      expect(stats.poolSize).toBeLessThanOrEqual(2);
      expect(stats.totalReleased).toBe(3);
    });

    it('pool.acquire는 항상 올바른 크기의 canvas를 반환해야 한다', () => {
      // 200x200 canvas를 pool에 추가
      const canvas = createMockCanvas(200, 200);
      pool.release(canvas);

      // 300x150 크기로 acquire
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
