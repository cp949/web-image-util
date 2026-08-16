/**
 * strategy-policy.internal.ts 단위 테스트
 *
 * high-res-detector.internal.ts(balanced)와 high-res-manager.ts(fast/high/memory-pressure)가
 * 공유하는 순수 정책 함수를 직접 검증한다. DOM/이미지 객체 없이 숫자만으로 호출한다.
 */
import { describe, expect, it } from 'vitest';
import {
  exceedsMaxSafeDimension,
  HIGH_QUALITY_STEPPED_SCALE_RATIO,
  LARGE_MEMORY_THRESHOLD_MB,
  MEDIUM_MEMORY_THRESHOLD_MB,
  MEMORY_EFFICIENT_THRESHOLD_MB,
  ProcessingStrategy,
  SMALL_MEMORY_THRESHOLD_MB,
  selectBalancedStrategy,
  selectFastStrategy,
  selectHighQualityStrategy,
  selectMemoryEfficientStrategy,
} from '../../../src/base/strategy-policy.internal';

describe('strategy-policy.internal', () => {
  describe('명명된 임계값', () => {
    it('기존 매직넘버와 동일한 값을 유지한다', () => {
      expect(SMALL_MEMORY_THRESHOLD_MB).toBe(16);
      expect(MEDIUM_MEMORY_THRESHOLD_MB).toBe(64);
      expect(LARGE_MEMORY_THRESHOLD_MB).toBe(256);
      expect(MEMORY_EFFICIENT_THRESHOLD_MB).toBe(32);
      expect(HIGH_QUALITY_STEPPED_SCALE_RATIO).toBe(0.3);
    });
  });

  describe('exceedsMaxSafeDimension()', () => {
    it('가로/세로 모두 한도 이하면 false', () => {
      expect(exceedsMaxSafeDimension(100, 100, 16384)).toBe(false);
    });
    it('가로가 한도를 넘으면 true', () => {
      expect(exceedsMaxSafeDimension(16385, 100, 16384)).toBe(true);
    });
    it('세로가 한도를 넘으면 true', () => {
      expect(exceedsMaxSafeDimension(100, 16385, 16384)).toBe(true);
    });
  });

  describe('selectBalancedStrategy()', () => {
    it('16MB 이하는 direct', () => {
      expect(selectBalancedStrategy(16, 2048, 2048, 16384)).toBe(ProcessingStrategy.DIRECT);
    });
    it('16MB 초과 64MB 이하는 tiled(옛 chunked 대역)', () => {
      expect(selectBalancedStrategy(16.01, 2049, 2049, 16384)).toBe(ProcessingStrategy.TILED);
    });
    it('64MB 초과 256MB 이하는 stepped', () => {
      expect(selectBalancedStrategy(64.01, 4097, 4097, 16384)).toBe(ProcessingStrategy.STEPPED);
    });
    it('256MB 초과는 tiled', () => {
      expect(selectBalancedStrategy(256.01, 8193, 8193, 16384)).toBe(ProcessingStrategy.TILED);
    });
    it('가로가 maxSafeDimension을 초과하면 메모리와 무관하게 tiled', () => {
      expect(selectBalancedStrategy(0.01, 32768, 100, 32767)).toBe(ProcessingStrategy.TILED);
    });
    it('세로가 maxSafeDimension을 초과하면 메모리와 무관하게 tiled', () => {
      expect(selectBalancedStrategy(0.01, 100, 32768, 32767)).toBe(ProcessingStrategy.TILED);
    });
  });

  describe('selectFastStrategy()', () => {
    it('64MB 이하는 direct', () => {
      expect(selectFastStrategy(64, 100, 100, 16384)).toBe(ProcessingStrategy.DIRECT);
    });
    it('64MB 초과는 tiled', () => {
      expect(selectFastStrategy(64.01, 100, 100, 16384)).toBe(ProcessingStrategy.TILED);
    });
    it('메모리가 작아도 캔버스 안전 치수를 초과하면 tiled(신규 가드)', () => {
      expect(selectFastStrategy(0.01, 20000, 1, 16384)).toBe(ProcessingStrategy.TILED);
    });
  });

  describe('selectMemoryEfficientStrategy()', () => {
    it('32MB 이하는 direct', () => {
      expect(selectMemoryEfficientStrategy(32, 100, 100, 16384)).toBe(ProcessingStrategy.DIRECT);
    });
    it('32MB 초과는 tiled', () => {
      expect(selectMemoryEfficientStrategy(32.01, 100, 100, 16384)).toBe(ProcessingStrategy.TILED);
    });
    it('메모리가 작아도 캔버스 안전 치수를 초과하면 tiled(신규 가드)', () => {
      expect(selectMemoryEfficientStrategy(0.01, 20000, 1, 16384)).toBe(ProcessingStrategy.TILED);
    });
  });

  describe('selectHighQualityStrategy()', () => {
    it('scaleRatio<0.3 이고 256MB 이하면 stepped', () => {
      expect(selectHighQualityStrategy(3.8, 1000, 1000, 16384, 0.2, ProcessingStrategy.TILED)).toBe(
        ProcessingStrategy.STEPPED
      );
    });
    it('256MB 초과면 scaleRatio 조건이 성립해도 tiled', () => {
      expect(selectHighQualityStrategy(309, 9000, 9000, 16384, 0.2, ProcessingStrategy.TILED)).toBe(
        ProcessingStrategy.TILED
      );
    });
    it('scaleRatio>=0.3 이고 256MB 이하면 balancedFallback을 그대로 반환', () => {
      expect(selectHighQualityStrategy(95.4, 5000, 5000, 16384, 0.5, ProcessingStrategy.STEPPED)).toBe(
        ProcessingStrategy.STEPPED
      );
      expect(selectHighQualityStrategy(95.4, 5000, 5000, 16384, 0.5, ProcessingStrategy.DIRECT)).toBe(
        ProcessingStrategy.DIRECT
      );
    });
    it('메모리·scaleRatio 조건과 무관하게 캔버스 안전 치수를 초과하면 tiled(신규 가드)', () => {
      expect(selectHighQualityStrategy(0.01, 20000, 1, 16384, 0.1, ProcessingStrategy.DIRECT)).toBe(
        ProcessingStrategy.TILED
      );
    });
  });
});
