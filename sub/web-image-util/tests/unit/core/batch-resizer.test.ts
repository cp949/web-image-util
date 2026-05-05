/**
 * BatchResizer의 설정 복사, 실행 순서, timeout, 오류 전파, 동시성 제어를 검증한다.
 */
import { describe, expect, it, vi } from 'vitest';
import { BatchResizer } from '../../../src/core/batch-resizer';

/** 테스트에서 비동기 job의 완료 시점을 직접 제어한다. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe('BatchResizer 동작', () => {
  describe('설정 조회', () => {
    it('getConfig가 내부 설정을 변경할 수 없는 복사본을 반환한다', () => {
      const batcher = new BatchResizer({
        concurrency: 1,
        timeout: 10,
        useCanvasPool: false,
        memoryLimitMB: 64,
      });

      const config = batcher.getConfig();
      config.concurrency = 99;
      config.timeout = 99;
      config.useCanvasPool = true;
      config.memoryLimitMB = 999;

      expect(batcher.getConfig()).toEqual({
        concurrency: 1,
        timeout: 10,
        useCanvasPool: false,
        memoryLimitMB: 64,
      });
    });

    it('fast 프로필 문자열로 빠른 처리 설정을 사용한다', () => {
      const batcher = new BatchResizer('fast');

      expect(batcher.getConfig()).toEqual({
        concurrency: 4,
        timeout: 15,
        useCanvasPool: true,
        memoryLimitMB: 128,
      });
    });

    it('balanced 프로필 문자열로 기본 균형 설정을 사용한다', () => {
      const batcher = new BatchResizer('balanced');

      expect(batcher.getConfig()).toMatchObject({
        concurrency: 2,
        timeout: 30,
      });
    });

    it('quality 프로필 문자열로 품질 우선 설정을 사용한다', () => {
      const batcher = new BatchResizer('quality');

      expect(batcher.getConfig()).toEqual({
        concurrency: 1,
        timeout: 60,
        useCanvasPool: true,
        memoryLimitMB: 512,
      });
    });
  });

  describe('일괄 처리', () => {
    it('job이 없으면 빈 배열을 반환한다', async () => {
      const batcher = new BatchResizer({ concurrency: 2, timeout: 10 });

      await expect(batcher.processAll([])).resolves.toEqual([]);
    });

    it('concurrency/timeout을 생략한 config로 생성해도 모든 job을 처리한다', async () => {
      // concurrency, timeout 없이 생성하면 기존 코드에서는 빈 배열이 반환된다.
      const batcher = new BatchResizer({ useCanvasPool: false });

      const jobs = [
        { id: 'a', operation: async () => 'result-a' },
        { id: 'b', operation: async () => 'result-b' },
        { id: 'c', operation: async () => 'result-c' },
      ];

      const results = await batcher.processAll(jobs);

      expect(results).toHaveLength(3);
      expect(results).toEqual(['result-a', 'result-b', 'result-c']);
    });

    it('job 완료 순서와 관계없이 입력 순서대로 결과를 반환한다', async () => {
      const batcher = new BatchResizer({ concurrency: 3, timeout: 10 });
      const first = createDeferred<string>();
      const second = createDeferred<string>();
      const third = createDeferred<string>();

      const results = batcher.processAll([
        { id: 'first', operation: () => first.promise },
        { id: 'second', operation: () => second.promise },
        { id: 'third', operation: () => third.promise },
      ]);

      third.resolve('third-result');
      first.resolve('first-result');
      second.resolve('second-result');

      await expect(results).resolves.toEqual(['first-result', 'second-result', 'third-result']);
    });

    it('job 오류를 그대로 전파한다', async () => {
      const batcher = new BatchResizer({ concurrency: 2, timeout: 10 });
      const error = new Error('job failed');

      await expect(
        batcher.processAll([
          { id: 'ok', operation: async () => 'ok' },
          { id: 'fail', operation: async () => Promise.reject(error) },
        ])
      ).rejects.toBe(error);
    });

    it('timeout 시간이 지나면 처리 실패로 거부한다', async () => {
      vi.useFakeTimers();
      const batcher = new BatchResizer({ concurrency: 1, timeout: 1 });
      const slowJob = createDeferred<string>();

      try {
        const promise = batcher.processAll([{ id: 'slow', operation: () => slowJob.promise }]);
        const assertion = expect(promise).rejects.toThrow('Operation timed out after 1000ms');

        await vi.advanceTimersByTimeAsync(1000);

        await assertion;
      } finally {
        slowJob.resolve('late-result');
        await Promise.resolve();
        vi.useRealTimers();
      }
    });

    it('concurrency=2이면 동시에 실행 중인 job이 최대 2개다', async () => {
      const batcher = new BatchResizer({ concurrency: 2, timeout: 10 });
      const deferredJobs = [createDeferred<string>(), createDeferred<string>(), createDeferred<string>()];
      const started: string[] = [];
      let activeCount = 0;
      let maxActiveCount = 0;

      const results = batcher.processAll(
        deferredJobs.map((deferredJob, index) => ({
          id: `job-${index + 1}`,
          operation: () => {
            activeCount++;
            maxActiveCount = Math.max(maxActiveCount, activeCount);
            started.push(`job-${index + 1}`);

            return deferredJob.promise.finally(() => {
              activeCount--;
            });
          },
        }))
      );

      await Promise.resolve();
      expect(started).toEqual(['job-1', 'job-2']);
      expect(maxActiveCount).toBe(2);

      deferredJobs[1].resolve('second');
      deferredJobs[0].resolve('first');
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(started).toEqual(['job-1', 'job-2', 'job-3']);
      expect(maxActiveCount).toBe(2);

      deferredJobs[2].resolve('third');

      await expect(results).resolves.toEqual(['first', 'second', 'third']);
      expect(maxActiveCount).toBe(2);
    });
  });
});
