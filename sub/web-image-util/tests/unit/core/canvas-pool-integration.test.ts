/**
 * CanvasPool 통합 테스트 중 happy-dom 환경에 남는 케이스를 모은다.
 *
 * LazyRenderPipeline은 내부적으로 drawImage(naturalWidth만 설정된 Image)를 호출하고
 * jsdom + canvas는 src가 없는 이미지를 거부하므로, 파이프라인 실행 결과를 검증하는
 * 케이스만 happy-dom에 남긴다. OnehotRenderer 직접 호출과 pool 정책 검증은
 * `canvas-pool-integration-jsdom.test.ts`에 분리해 두었다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';

function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

describe('CanvasPool 통합 (LazyRenderPipeline 실행 경로)', () => {
  let pool: CanvasPool;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear();
  });

  afterEach(() => {
    pool.clear();
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

      expect(canvas.width).toBe(300);
      expect(canvas.height).toBe(200);

      releaseSpy.mockRestore();
    });

    it('연속 toBlob 호출 시 pool hit이 증가해야 한다', async () => {
      const mockImage = createMockImage(800, 600);

      const pipeline1 = new LazyRenderPipeline(mockImage);
      pipeline1.addResize({ fit: 'cover', width: 300, height: 200 });
      await pipeline1.toBlob();

      const statsAfterFirst = pool.getStats();
      expect(statsAfterFirst.poolSize).toBe(1);

      const pipeline2 = new LazyRenderPipeline(mockImage);
      pipeline2.addResize({ fit: 'cover', width: 300, height: 200 });
      await pipeline2.toBlob();

      const statsAfterSecond = pool.getStats();
      expect(statsAfterSecond.poolHits).toBeGreaterThan(0);
    });
  });
});
