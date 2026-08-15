/**
 * 단순화된 성능 설정 - 리사이저 전용
 *
 * @description 최소한의 성능 옵션만 제공한다
 * 복잡한 모니터링과 이벤트 처리는 제거했다
 */

/**
 * 리사이저 성능 옵션 - 최소한으로 단순화
 */
export interface ResizePerformanceOptions {
  /** 동시에 처리 가능한 이미지 개수 (기본값: 2) */
  concurrency?: number;

  /** 처리 타임아웃 (초, 기본값: 30) */
  timeout?: number;
}

/**
 * 3가지 단순 성능 프로파일
 */
export type ResizeProfile = 'fast' | 'balanced' | 'quality';

/**
 * 프로파일별 설정 - 단순화
 */
export const RESIZE_PROFILES: Record<ResizeProfile, ResizePerformanceOptions> = {
  /** 속도 우선 - 4개 동시 처리 */
  fast: {
    concurrency: 4,
    timeout: 15,
  },

  /** 균형 - 기본 설정 */
  balanced: {
    concurrency: 2,
    timeout: 30,
  },

  /** 품질 우선 - 하나씩 처리 */
  quality: {
    concurrency: 1,
    timeout: 60,
  },
};

/**
 * 프로파일 적용 함수
 */
export function getPerformanceConfig(
  profile: ResizeProfile = 'balanced',
  overrides: Partial<ResizePerformanceOptions> = {}
): ResizePerformanceOptions {
  return {
    ...RESIZE_PROFILES[profile],
    ...overrides,
  };
}
