/**
 * ResizePerformance 단위 테스트 (버그 수정용 회귀 테스트 포함)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResizePerformance } from '../../../src/core/performance-utils';

describe('ResizePerformance', () => {
  describe('setProfile / getProfile', () => {
    afterEach(() => {
      // 전역 상태 초기화
      ResizePerformance.setProfile('balanced');
      vi.restoreAllMocks();
    });

    it('기본 프로파일은 balanced이다', () => {
      // 모듈 임포트 직후 상태
      expect(ResizePerformance.getProfile()).toBe('balanced');
    });

    it('setProfile로 프로파일을 변경할 수 있다', () => {
      ResizePerformance.setProfile('fast');
      expect(ResizePerformance.getProfile()).toBe('fast');
    });

    it('setProfile 이후 getConfig는 변경된 프로파일 기준 config를 반환한다', () => {
      ResizePerformance.setProfile('quality');
      const config = ResizePerformance.getConfig();
      expect(config.concurrency).toBe(1);
      expect(config.timeout).toBe(60);
    });
  });

  describe('getConfig', () => {
    afterEach(() => {
      // 전역 상태 초기화
      ResizePerformance.setProfile('balanced');
    });

    it('profile 인자 없이 호출하면 현재 전역 프로파일 config를 반환한다', () => {
      ResizePerformance.setProfile('fast');
      const config = ResizePerformance.getConfig();
      expect(config.concurrency).toBe(4);
      expect(config.memoryLimitMB).toBe(128);
    });

    it('profile 인자를 넘기면 해당 프로파일 config를 반환한다', () => {
      const config = ResizePerformance.getConfig('quality');
      expect(config.concurrency).toBe(1);
      expect(config.memoryLimitMB).toBe(512);
    });
  });

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

    it('이미지가 10개 초과이고 평균 크기가 2MP 초과이면 fast를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(11, 2_100_000);

      expect(result.profile).toBe('fast');
    });

    it('이미지가 5개 이하이면 quality를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(3, 500_000);

      expect(result.profile).toBe('quality');
    });

    it('일반 상황(6~10개, 압박 없음)이면 balanced를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(7, 500_000);

      expect(result.profile).toBe('balanced');
    });
  });

  describe('getMemoryInfo', () => {
    it('performance.memory가 없는 환경에서는 기본 pressureLevel low를 반환한다', () => {
      // jsdom은 performance.memory를 제공하지 않으므로 폴백 경로를 탄다
      const info = ResizePerformance.getMemoryInfo();

      expect(info.pressureLevel).toBe('low');
      expect(info.usedMB).toBe(0);
      expect(info.limitMB).toBe(0);
    });
  });
});
