/**
 * concurrency 크기로 나눈 청크 단위로 항목을 실행하는 일괄 처리 seam.
 *
 * HighResolutionManager.batchSmartResize, AutoHighResProcessor.batchSmartResize,
 * AdvancedImageProcessor.batchProcess, BatchResizer.processAll이 각자 재구현하던
 * "concurrency 크기로 잘라 Promise.all 실행" 루프를 여기 하나로 모은다. 네 곳이
 * 갈리는 지점(timeout, 메모리 점검, progress 콜백, 에러 래핑)은 fn과 hooks로만
 * 주입한다 — 이 seam 자체는 에러를 감싸거나 삼키지 않는다.
 *
 * 청크는 순차 실행하고(청크 N+1은 청크 N이 모두 settle된 뒤 시작), 청크 내부는
 * Promise.all로 동시 실행한다. hooks를 아무것도 넘기지 않으면 첫 청크는 호출 즉시
 * (동기 구간 안에서) 시작된다 — 호출자들의 "동기 구간에 in-flight N개" 테스트가
 * 이 성질에 의존하므로, beforeChunk가 없을 때는 불필요한 await로 microtask 한 틱을
 * 소비하지 않도록 조건부로만 await한다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

export interface ChunkedRunnerHooks<R> {
  /** 각 청크의 Promise.all 시작 전에 1회 호출된다. 메모리 점검처럼 청크 단위 부수 작업에 쓴다. */
  beforeChunk?: () => Promise<void> | void;
  /**
   * 항목 하나가 성공적으로 끝날 때마다 (원본 배열 기준 index, 결과)로 호출된다.
   * fn이 resolve된 뒤 fn의 에러 처리 범위 밖에서 실행되므로, 훅이 던진 에러는 그대로 전파된다.
   */
  onItemComplete?: (index: number, result: R) => void;
}

/**
 * items를 concurrency 크기로 청크를 나눠 fn을 실행하고, 입력 순서를 보존한 결과
 * 배열을 반환한다. concurrency가 1 미만이거나 숫자가 아니면 1로 처리한다.
 * fn이 reject하면 그 즉시 원본 에러 그대로 처리 전체가 reject된다.
 */
export async function processInChunks<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  hooks: ChunkedRunnerHooks<R> = {}
): Promise<R[]> {
  const { beforeChunk, onItemComplete } = hooks;
  const results: R[] = new Array(items.length);
  const step = concurrency >= 1 ? Math.floor(concurrency) : 1;

  for (let start = 0; start < items.length; start += step) {
    const chunk = items.slice(start, start + step);

    if (beforeChunk) {
      await beforeChunk();
    }

    const chunkPromises = chunk.map(async (item, chunkIndex) => {
      const index = start + chunkIndex;
      const result = await fn(item, index);
      results[index] = result;
      onItemComplete?.(index, result);
      return result;
    });

    await Promise.all(chunkPromises);
  }

  return results;
}
