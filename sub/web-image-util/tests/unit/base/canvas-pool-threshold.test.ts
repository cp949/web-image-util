import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CanvasPool } from '../../../src/base/canvas-pool';
import { ImageProcessError } from '../../../src/types';

describe('캔버스 풀 메모리 임계값', () => {
  let pool: CanvasPool;
  let originalThreshold: number;

  beforeEach(() => {
    pool = CanvasPool.getInstance();
    originalThreshold = pool.getMemoryThreshold();
  });

  afterEach(() => {
    pool.setMemoryThreshold(originalThreshold);
  });

  it('기본값은 256MB이다', () => {
    expect(originalThreshold).toBe(256 * 1024 * 1024);
  });

  it('메모리 임계값 설정 메서드가 값을 갱신한다', () => {
    pool.setMemoryThreshold(64 * 1024 * 1024);
    expect(pool.getMemoryThreshold()).toBe(64 * 1024 * 1024);
  });

  it('0 또는 음수는 거부한다', () => {
    for (const invalidThreshold of [0, -1, NaN]) {
      expect(() => pool.setMemoryThreshold(invalidThreshold)).toThrow(ImageProcessError);

      try {
        pool.setMemoryThreshold(invalidThreshold);
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        expect((error as ImageProcessError).code).toBe('INVALID_DIMENSIONS');
      }
    }
  });
});
