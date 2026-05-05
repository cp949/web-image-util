/**
 * ResizePerformance 단위 테스트 (버그 수정용 회귀 테스트 포함)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResizePerformance } from '../../../src/core/performance-utils';

describe('ResizePerformance', () => {
  describe('getRecommendation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('메모리 압박이 high일 때 fast 프로파일을 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 900,
        limitMB: 1000,
        pressureLevel: 'high',
      });

      const result = ResizePerformance.getRecommendation(1, 1_000_000);

      expect(result.profile).toBe('fast');
      expect(result.reason).toBe('Fast profile recommended due to high memory pressure');
    });
  });
});
