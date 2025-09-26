/**
 * 간소화된 성능 설정 - 리사이저 전용
 *
 * @description 최소한 성능 옵션만 제공
 * 복잡한 모니터링이나 이벤트 처리는 제거
 */

/**
 * 리사이저 성능 옵션 - 최소한으로 간소화
 */
export interface ResizePerformanceOptions {
  /** 동시 처리 가능한 이미지 수 (기본: 2) */
  concurrency?: number;

  /** 처리 타임아웃 (초, 기본: 30) */
  timeout?: number;

  /** Canvas 풀 사용 여부 (기본: true) */
  useCanvasPool?: boolean;

  /** 메모리 제한 (MB, 기본: 256) */
  memoryLimitMB?: number;
}

/**
 * 3가지 간단한 성능 프로파일
 */
export type ResizeProfile = 'fast' | 'balanced' | 'quality';

/**
 * 프로파일별 설정 - 간단하게
 */
export const RESIZE_PROFILES: Record<ResizeProfile, ResizePerformanceOptions> = {
  /** 속도 우선 - 4개 동시 처리, 적은 메모리 */
  fast: {
    concurrency: 4,
    timeout: 15,
    useCanvasPool: true,
    memoryLimitMB: 128,
  },

  /** 균형 - 기본 설정 */
  balanced: {
    concurrency: 2,
    timeout: 30,
    useCanvasPool: true,
    memoryLimitMB: 256,
  },

  /** 품질 우선 - 1개씩 처리, 충분한 메모리 */
  quality: {
    concurrency: 1,
    timeout: 60,
    useCanvasPool: true,
    memoryLimitMB: 512,
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
