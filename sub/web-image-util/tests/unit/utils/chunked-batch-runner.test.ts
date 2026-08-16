/**
 * processInChunks() 공유 청크 실행 seam의 동작을 검증하는 테스트.
 * concurrency 경계, 순서 보존, beforeChunk/onItemComplete 훅, 에러 그대로 전파,
 * beforeChunk 미지정 시 동기 시작을 함께 다룬다.
 */

import { describe, expect, it } from 'vitest';
import { processInChunks } from '../../../src/utils/chunked-batch-runner.internal';

/** 테스트에서 비동기 작업의 완료 시점을 직접 제어한다. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('processInChunks', () => {
  it('빈 배열이면 빈 배열을 반환한다', async () => {
    const results = await processInChunks([], 2, async (item) => item);
    expect(results).toEqual([]);
  });

  it('concurrency가 1 미만이거나 숫자가 아니면 1로 처리한다', async () => {
    for (const concurrency of [0, -2, Number.NaN, 0.5]) {
      const results = await processInChunks([1, 2, 3], concurrency, async (item) => item * 10);

      expect(results).toEqual([10, 20, 30]);
    }
  });

  it('concurrency 크기만큼만 동시에 실행하고 청크 경계를 지킨다', async () => {
    const deferredJobs = [createDeferred<string>(), createDeferred<string>(), createDeferred<string>()];
    let inFlight = 0;
    let maxInFlight = 0;
    const started: number[] = [];

    const resultsPromise = processInChunks([0, 1, 2], 2, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      started.push(item);
      const result = await deferredJobs[item].promise;
      inFlight--;
      return result;
    });

    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(maxInFlight).toBe(2);

    deferredJobs[0].resolve('r0');
    deferredJobs[1].resolve('r1');
    await new Promise((r) => setTimeout(r, 0));

    expect(started).toEqual([0, 1, 2]);

    deferredJobs[2].resolve('r2');
    await expect(resultsPromise).resolves.toEqual(['r0', 'r1', 'r2']);
    expect(maxInFlight).toBe(2);
  });

  it('완료 순서와 무관하게 입력 순서대로 결과를 반환한다', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();

    const resultsPromise = processInChunks([first, second], 2, async (deferred) => deferred.promise);

    second.resolve('second-result');
    first.resolve('first-result');

    await expect(resultsPromise).resolves.toEqual(['first-result', 'second-result']);
  });

  it('onItemComplete가 각 항목의 (index, result)를 완료 순서대로 전달한다', async () => {
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const calls: Array<[number, string]> = [];

    const resultsPromise = processInChunks([first, second], 2, async (item) => item.promise, {
      onItemComplete: (index, result) => calls.push([index, result]),
    });

    second.resolve('second-result');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual([[1, 'second-result']]);

    first.resolve('first-result');

    await resultsPromise;
    expect(calls).toEqual([
      [1, 'second-result'],
      [0, 'first-result'],
    ]);
  });

  it('beforeChunk가 청크 수만큼 청크 시작 전에 호출된다', async () => {
    const events: string[] = [];

    await processInChunks(
      [0, 1, 2, 3, 4],
      2,
      async (item) => {
        events.push(`item:${item}`);
        return item;
      },
      {
        beforeChunk: () => {
          events.push('chunk');
        },
      }
    );

    expect(events).toEqual(['chunk', 'item:0', 'item:1', 'chunk', 'item:2', 'item:3', 'chunk', 'item:4']);
  });

  it('beforeChunk가 실패하면 원본 에러를 그대로 reject하고 청크를 시작하지 않는다', async () => {
    const error = new Error('memory check failed');
    const started: number[] = [];

    await expect(
      processInChunks(
        [0, 1],
        2,
        async (item) => {
          started.push(item);
          return item;
        },
        {
          beforeChunk: () => {
            throw error;
          },
        }
      )
    ).rejects.toBe(error);

    expect(started).toEqual([]);
  });

  it('concurrency가 항목 수보다 크면 전체를 하나의 청크에서 동시에 시작한다', async () => {
    const deferredJobs = [createDeferred<number>(), createDeferred<number>(), createDeferred<number>()];
    const started: number[] = [];
    let chunkCount = 0;

    const resultsPromise = processInChunks(
      [0, 1, 2],
      10,
      async (item) => {
        started.push(item);
        return deferredJobs[item].promise;
      },
      {
        beforeChunk: () => {
          chunkCount++;
        },
      }
    );

    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    expect(chunkCount).toBe(1);

    deferredJobs.forEach((deferred, index) => {
      deferred.resolve(index * 10);
    });
    await expect(resultsPromise).resolves.toEqual([0, 10, 20]);
  });

  it('beforeChunk를 넘기지 않으면 첫 청크가 호출 즉시 동기적으로 시작된다', async () => {
    const started: number[] = [];
    const deferred = [createDeferred<void>(), createDeferred<void>()];

    void processInChunks([0, 1], 2, async (item) => {
      started.push(item);
      await deferred[item].promise;
    });

    // await 없이 바로 확인 — beforeChunk 훅이 없으면 불필요한 await로 microtask를
    // 소비하지 않아야 첫 청크가 동기 구간 안에서 즉시 시작된다
    expect(started).toEqual([0, 1]);

    deferred[0].resolve();
    deferred[1].resolve();
  });

  it('항목 하나가 실패하면 원본 에러를 그대로 reject한다(래핑하지 않는다)', async () => {
    const error = new Error('item failed');

    await expect(
      processInChunks([0, 1], 2, async (item) => {
        if (item === 1) throw error;
        return item;
      })
    ).rejects.toBe(error);
  });
});
