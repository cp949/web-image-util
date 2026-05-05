/**
 * BatchResizer 단위 테스트 (버그 수정용 회귀 테스트 포함)
 */
import { describe, expect, it } from 'vitest';
import { BatchResizer } from '../../../src/core/batch-resizer';

describe('BatchResizer', () => {
  describe('processAll - undefined config 방어', () => {
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
  });
});
