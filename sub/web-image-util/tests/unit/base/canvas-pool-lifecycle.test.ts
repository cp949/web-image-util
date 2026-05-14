import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';

describe('CanvasPool lifecycle', () => {
  let pool: CanvasPool;
  let originalMaxPoolSize: number;
  let originalMemoryThreshold: number;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    originalMaxPoolSize = pool.getStats().maxPoolSize;
    originalMemoryThreshold = pool.getMemoryThreshold();
    pool.clear();
  });

  afterEach(() => {
    // 다른 테스트에 영향을 주지 않도록 maxPoolSize와 임계값을 원래 값으로 복원한다
    pool.setMaxPoolSize(originalMaxPoolSize);
    pool.setMemoryThreshold(originalMemoryThreshold);
    pool.clear();
  });

  // ---------------------------------------------------------------------------
  // 재사용 (pool hit)
  // ---------------------------------------------------------------------------

  describe('재사용 (pool hit)', () => {
    it('release 후 acquire하면 poolHits 카운터가 증가한다', () => {
      const canvas = pool.acquire(100, 100);
      pool.release(canvas);
      pool.acquire(100, 100);

      const stats = pool.getStats();
      expect(stats.poolHits).toBe(1);
    });

    it('release 후 acquire하면 동일 Canvas 인스턴스가 반환된다', () => {
      const canvas = pool.acquire(100, 100);
      pool.release(canvas);
      const reacquired = pool.acquire(100, 100);

      // 풀에서 꺼낸 것이므로 동일 참조
      expect(reacquired).toBe(canvas);
    });

    it('풀이 비어 있으면 acquire 시 새 Canvas를 생성한다', () => {
      pool.acquire(100, 100);

      const stats = pool.getStats();
      expect(stats.totalCreated).toBe(1);
      expect(stats.poolHits).toBe(0);
    });

    it('여러 번 release-acquire를 반복해도 poolHits가 누적된다', () => {
      const canvas = pool.acquire(100, 100);
      pool.release(canvas);
      const c2 = pool.acquire(100, 100);
      pool.release(c2);
      pool.acquire(100, 100);

      const stats = pool.getStats();
      expect(stats.poolHits).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 풀 용량 제한 (eviction)
  // ---------------------------------------------------------------------------

  describe('풀 용량 제한 (eviction)', () => {
    it('풀이 가득 찬 상태에서 release하면 초과 Canvas는 풀에 들어가지 않는다', () => {
      pool.setMaxPoolSize(2);

      for (let i = 0; i < 3; i++) {
        const c = document.createElement('canvas');
        c.width = 100;
        c.height = 100;
        pool.release(c);
      }

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(2);
      expect(stats.totalReleased).toBe(3);
    });

    it('setMaxPoolSize를 줄이면 초과 Canvas가 즉시 제거된다', () => {
      for (let i = 0; i < 3; i++) {
        const c = document.createElement('canvas');
        c.width = 100;
        c.height = 100;
        pool.release(c);
      }
      expect(pool.getStats().poolSize).toBe(3);

      pool.setMaxPoolSize(1);

      expect(pool.getStats().poolSize).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 대형 Canvas 처리
  // ---------------------------------------------------------------------------

  describe('대형 Canvas 처리', () => {
    it('2048×2048 이하 Canvas는 풀에 반환된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      pool.release(canvas);

      expect(pool.getStats().poolSize).toBe(1);
    });

    it('2048×2048을 초과하는 Canvas는 풀에 들어가지 않는다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2049;
      canvas.height = 2049;
      pool.release(canvas);

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
      expect(stats.totalReleased).toBe(1);
    });

    it('dispose된 Canvas는 width/height가 0으로 초기화된다', () => {
      // 풀이 가득 찬 상태를 만들어 dispose 경로를 강제한다
      pool.setMaxPoolSize(0);

      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      pool.release(canvas);

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 크기 설정 (acquire dimensions)
  // ---------------------------------------------------------------------------

  describe('크기 설정 (acquire dimensions)', () => {
    it('acquire 시 크기를 지정하면 해당 크기로 설정된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      pool.release(canvas);

      const acquired = pool.acquire(300, 150);

      expect(acquired.width).toBe(300);
      expect(acquired.height).toBe(150);
    });

    it('acquire 시 크기를 지정하지 않으면 기존 Canvas 크기가 유지된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      pool.release(canvas);

      const acquired = pool.acquire(); // 크기 미지정

      expect(acquired.width).toBe(100);
      expect(acquired.height).toBe(100);
    });

    it('풀이 비어 있을 때 acquire(width, height)는 지정된 크기의 새 Canvas를 반환한다', () => {
      const acquired = pool.acquire(400, 300);

      expect(acquired.width).toBe(400);
      expect(acquired.height).toBe(300);
    });
  });

  // ---------------------------------------------------------------------------
  // clear / reset
  // ---------------------------------------------------------------------------

  describe('clear / reset', () => {
    it('clear() 후 poolSize가 0이 된다', () => {
      for (let i = 0; i < 3; i++) {
        const c = document.createElement('canvas');
        c.width = 100;
        c.height = 100;
        pool.release(c);
      }

      pool.clear();

      expect(pool.getStats().poolSize).toBe(0);
    });

    it('clear() 후 통계가 모두 0으로 초기화된다', () => {
      const canvas = pool.acquire(100, 100);
      pool.release(canvas);

      pool.clear();

      const stats = pool.getStats();
      expect(stats.totalCreated).toBe(0);
      expect(stats.totalAcquired).toBe(0);
      expect(stats.totalReleased).toBe(0);
      expect(stats.poolHits).toBe(0);
    });

    it('clear() 시 보관 중인 Canvas는 dispose된다 (width/height = 0)', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      pool.release(canvas);

      pool.clear();

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // release 시 Canvas 정리
  // ---------------------------------------------------------------------------

  describe('release 시 Canvas 정리', () => {
    it('release 시 clearRect가 호출된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      const clearRectSpy = vi.spyOn(ctx, 'clearRect');

      pool.release(canvas);

      expect(clearRectSpy).toHaveBeenCalled();
    });

    it('release 시 globalAlpha가 1로 초기화된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.globalAlpha = 0.3;

      pool.release(canvas);

      expect(ctx.globalAlpha).toBe(1);
    });

    it('release 시 globalCompositeOperation이 source-over로 초기화된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'multiply';

      pool.release(canvas);

      expect(ctx.globalCompositeOperation).toBe('source-over');
    });

    it('acquire 시에도 clearRect가 호출되어 잔여 픽셀이 없음이 보장된다', () => {
      // 풀에 canvas를 넣고 꺼낼 때 acquire 쪽에서 한 번 더 clearRect 호출
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      pool.release(canvas);

      const ctx = canvas.getContext('2d')!;
      const clearRectSpy = vi.spyOn(ctx, 'clearRect');

      pool.acquire(100, 100);

      expect(clearRectSpy).toHaveBeenCalled();
    });

    it('release 시 변환 행렬이 단위 행렬로 초기화된다', () => {
      // acquire 초기화 블록에는 setTransform이 없으므로 cleanCanvas의 해당 호출이
      // 단일 회귀 지점이다. 누락되면 풀에서 꺼낸 캔버스에 이전 변환이 남는다.
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      // 비단위 변환을 적용한다
      ctx.setTransform(2, 0, 0, 2, 10, 20);

      const setTransformSpy = vi.spyOn(ctx, 'setTransform');
      pool.release(canvas);

      // cleanCanvas가 단위 행렬(1,0,0,1,0,0)로 복원했는지 spy 인자로 확인한다
      expect(setTransformSpy).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // 이중 release
  // ---------------------------------------------------------------------------

  describe('이중 release', () => {
    it('같은 Canvas를 두 번 release해도 예외가 발생하지 않는다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      expect(() => {
        pool.release(canvas);
        pool.release(canvas);
      }).not.toThrow();
    });

    it('이중 release 시 totalReleased는 2가 된다', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      pool.release(canvas);
      pool.release(canvas);

      expect(pool.getStats().totalReleased).toBe(2);
    });

    it('이중 release 시 풀에 동일 참조가 두 번 들어간다 (현재 동작 문서화)', () => {
      // 이중 해제 방어 로직이 없으므로 동일 Canvas가 풀에 두 번 추가된다.
      // 이 동작을 인지하고 호출자가 이중 release를 피해야 한다.
      pool.setMaxPoolSize(5);
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;

      pool.release(canvas);
      pool.release(canvas);

      expect(pool.getStats().poolSize).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 풀 미반환 케이스 (toCanvas 경로 시뮬레이션)
  // ---------------------------------------------------------------------------

  describe('풀 미반환 케이스', () => {
    it('release()를 호출하지 않으면 acquire된 Canvas는 풀로 돌아가지 않는다', () => {
      // toCanvas() 처럼 사용자에게 소유권이 이전되는 경로를 시뮬레이션한다.
      // 풀은 release() 호출 없이 Canvas를 자동 회수하지 않는다.
      const canvas = pool.acquire(100, 100);

      // release 호출하지 않음
      const stats = pool.getStats();
      expect(stats.totalReleased).toBe(0);
      expect(stats.poolSize).toBe(0);

      // Canvas 자체는 여전히 유효하게 사용 가능
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);
    });

    it('사용자 소유 Canvas를 명시적으로 release하면 그때서야 풀에 들어간다', () => {
      const canvas = pool.acquire(100, 100);
      // 처음에는 풀 크기 0
      expect(pool.getStats().poolSize).toBe(0);

      // 명시적 반환
      pool.release(canvas);
      expect(pool.getStats().poolSize).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 통계 (getStats)
  // ---------------------------------------------------------------------------

  describe('통계 (getStats)', () => {
    it('acquire 횟수만큼 totalAcquired가 증가한다', () => {
      pool.acquire(100, 100);
      pool.acquire(200, 200);
      pool.acquire(300, 300);

      expect(pool.getStats().totalAcquired).toBe(3);
    });

    it('hitRatio는 poolHits / totalAcquired 비율이다', () => {
      const c = pool.acquire(100, 100); // totalAcquired=1, hit=0
      pool.release(c);
      pool.acquire(100, 100); // totalAcquired=2, hit=1

      // hitRatio = 1/2 = 0.5
      expect(pool.getStats().hitRatio).toBe(0.5);
    });

    it('acquire가 한 번도 없으면 hitRatio는 0이다', () => {
      expect(pool.getStats().hitRatio).toBe(0);
    });

    it('getStats의 poolSize는 현재 풀에 있는 Canvas 수를 반영한다', () => {
      expect(pool.getStats().poolSize).toBe(0);

      const c1 = document.createElement('canvas');
      c1.width = 100;
      c1.height = 100;
      pool.release(c1);
      expect(pool.getStats().poolSize).toBe(1);

      const c2 = document.createElement('canvas');
      c2.width = 100;
      c2.height = 100;
      pool.release(c2);
      expect(pool.getStats().poolSize).toBe(2);

      pool.acquire();
      expect(pool.getStats().poolSize).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 메모리 압박 (memory pressure)
  // ---------------------------------------------------------------------------

  describe('메모리 압박 (memory pressure)', () => {
    it('임계값 초과 시 acquire가 풀을 축소하고 memoryOptimizations를 증가시킨다', () => {
      // 임계값을 1 바이트로 낮춰 어떤 Canvas도 임계를 초과하게 한다
      pool.setMemoryThreshold(1);

      for (let i = 0; i < 3; i++) {
        const c = document.createElement('canvas');
        c.width = 200;
        c.height = 200;
        pool.release(c);
      }
      const sizeBeforeAcquire = pool.getStats().poolSize; // 3

      pool.acquire(10, 10);

      const stats = pool.getStats();
      expect(stats.memoryOptimizations).toBeGreaterThanOrEqual(1);
      expect(stats.poolSize).toBeLessThan(sizeBeforeAcquire);
    });

    it('임계값 미만에서는 acquire 후에도 memoryOptimizations가 0으로 유지된다', () => {
      // 임계값을 매우 높게 설정하여 압박이 발생하지 않도록 한다
      pool.setMemoryThreshold(Number.MAX_SAFE_INTEGER);

      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      pool.release(c);

      pool.acquire(10, 10);

      expect(pool.getStats().memoryOptimizations).toBe(0);
    });
  });
});
