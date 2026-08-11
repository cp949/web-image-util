/**
 * CanvasLease 단위 테스트.
 *
 * pool에서 빌린 canvas의 소유권 규칙을 타입/상태로 강제하는 handle을 검증한다:
 * - consume: 파생물 생성 후 pool로 반환
 * - detach: 소유권을 호출자에게 이전 (pool로 돌아가지 않음)
 * - 이중 반환/사용 후 접근은 오류
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';

describe('CanvasLease', () => {
  let pool: CanvasPool;
  let leased: HTMLCanvasElement;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    pool.clear();
    leased = pool.acquire(100, 50);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('canvas 접근', () => {
    it('active 상태에서는 임대 canvas에 접근할 수 있다', () => {
      const lease = new CanvasLease(leased);
      expect(lease.canvas).toBe(leased);
    });
  });

  describe('consume', () => {
    it('콜백 결과를 반환하고 canvas를 pool로 반환한다', async () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      const result = await lease.consume((canvas) => canvas.width * 2);

      expect(result).toBe(200);
      expect(releaseSpy).toHaveBeenCalledTimes(1);
      expect(releaseSpy).toHaveBeenCalledWith(leased);
    });

    it('임대 canvas를 콜백 결과로 반환할 수 없다', async () => {
      const lease = new CanvasLease(leased);

      // @ts-expect-error 임대 canvas는 consume 결과로 module 밖에 노출할 수 없다.
      await lease.consume((canvas) => canvas);
    });

    it('콜백이 throw해도 canvas를 pool로 반환한다', async () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      await expect(
        lease.consume(() => {
          throw new Error('변환 실패');
        })
      ).rejects.toThrow('변환 실패');
      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });

    it('consume 후 canvas 접근은 오류다', async () => {
      const lease = new CanvasLease(leased);
      await lease.consume(() => undefined);

      expect(() => lease.canvas).toThrow();
    });

    it('consume 후 detach는 오류다', async () => {
      const lease = new CanvasLease(leased);
      await lease.consume(() => undefined);

      expect(() => lease.detach()).toThrow();
    });
  });

  describe('detach', () => {
    it('canvas를 반환하고 pool로 돌려보내지 않는다', () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      const detached = lease.detach();

      expect(detached).toBe(leased);
      expect(releaseSpy).not.toHaveBeenCalled();
    });

    it('detach 후 release를 호출해도 pool로 돌아가지 않는다 (소유권 이전 유지)', () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      lease.detach();
      lease.release();

      expect(releaseSpy).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('active 상태에서 canvas를 pool로 반환한다', () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      lease.release();

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });

    it('멱등이다 — 두 번 호출해도 pool 반환은 1회다', () => {
      const releaseSpy = vi.spyOn(pool, 'release');
      const lease = new CanvasLease(leased);

      lease.release();
      lease.release();

      expect(releaseSpy).toHaveBeenCalledTimes(1);
    });
  });
});
