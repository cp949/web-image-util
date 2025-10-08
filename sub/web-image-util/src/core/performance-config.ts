/**
 * Simplified performance settings - resizer only
 *
 * @description Provides only minimal performance options
 * Complex monitoring and event handling removed
 */

/**
 * Resizer performance options - minimally simplified
 */
export interface ResizePerformanceOptions {
  /** Number of images that can be processed simultaneously (default: 2) */
  concurrency?: number;

  /** Processing timeout (seconds, default: 30) */
  timeout?: number;

  /** Whether to use Canvas pool (default: true) */
  useCanvasPool?: boolean;

  /** Memory limit (MB, default: 256) */
  memoryLimitMB?: number;
}

/**
 * 3 simple performance profiles
 */
export type ResizeProfile = 'fast' | 'balanced' | 'quality';

/**
 * Profile-specific settings - simplified
 */
export const RESIZE_PROFILES: Record<ResizeProfile, ResizePerformanceOptions> = {
  /** Speed priority - 4 simultaneous processing, low memory */
  fast: {
    concurrency: 4,
    timeout: 15,
    useCanvasPool: true,
    memoryLimitMB: 128,
  },

  /** Balanced - default settings */
  balanced: {
    concurrency: 2,
    timeout: 30,
    useCanvasPool: true,
    memoryLimitMB: 256,
  },

  /** Quality priority - process one by one, sufficient memory */
  quality: {
    concurrency: 1,
    timeout: 60,
    useCanvasPool: true,
    memoryLimitMB: 512,
  },
};

/**
 * Profile application function
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
