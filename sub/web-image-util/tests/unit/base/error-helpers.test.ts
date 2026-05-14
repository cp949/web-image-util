/**
 * error-helpers.ts 헬퍼 함수 단위 테스트.
 *
 * createImageError, withErrorRecovery, estimateMemoryUsage,
 * createQuickError, getErrorStats 등의 입출력 계약을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkBrowserSupport,
  createAndHandleError,
  createImageError,
  createQuickError,
  estimateMemoryUsage,
  getErrorStats,
  isFormatSupported,
  logError,
  withErrorHandling,
  withErrorRecovery,
} from '../../../src/base/error-helpers';
import { ImageErrorHandler } from '../../../src/core/error-handler';
import { ImageErrorCode, ImageProcessError } from '../../../src/errors';

describe('createImageError', () => {
  it('반환값은 ImageProcessError 인스턴스이다', () => {
    const err = createImageError(ImageErrorCode.INVALID_SOURCE);
    expect(err).toBeInstanceOf(ImageProcessError);
  });

  it('전달한 code가 그대로 보존된다', () => {
    const err = createImageError(ImageErrorCode.RESIZE_FAILED);
    expect(err.code).toBe('RESIZE_FAILED');
  });

  it('cause 옵션이 에러에 전달된다', () => {
    const original = new Error('원본');
    const err = createImageError(ImageErrorCode.CONVERSION_FAILED, { cause: original });
    expect(err.cause).toBe(original);
  });

  it('details 옵션이 에러에 보존된다', () => {
    const details = { actualBytes: 100, maxBytes: 50 };
    const err = createImageError(ImageErrorCode.SOURCE_BYTES_EXCEEDED, { details });
    expect(err.details).toEqual(details);
  });

  it('모든 ImageErrorCode 값에 대해 에러를 생성할 수 있다', () => {
    for (const code of Object.values(ImageErrorCode)) {
      expect(() => createImageError(code)).not.toThrow();
    }
  });

  it('생성된 에러의 message는 비어있지 않다 (USER_FRIENDLY_MESSAGES 매핑 회귀 방어)', () => {
    const err = createImageError(ImageErrorCode.INVALID_SOURCE);
    expect(err.message.length).toBeGreaterThan(0);
  });
});

describe('createQuickError', () => {
  it('반환값은 ImageProcessError 인스턴스이다', () => {
    const err = createQuickError(ImageErrorCode.BLUR_FAILED);
    expect(err).toBeInstanceOf(ImageProcessError);
  });

  it('code가 그대로 보존된다', () => {
    const err = createQuickError(ImageErrorCode.SVG_LOAD_FAILED);
    expect(err.code).toBe('SVG_LOAD_FAILED');
  });

  it('cause를 전달하면 보존된다', () => {
    const original = new TypeError('타입 오류');
    const err = createQuickError(ImageErrorCode.OUTPUT_FAILED, original);
    expect(err.cause).toBe(original);
  });

  it('cause 없이 호출하면 cause는 undefined이다', () => {
    const err = createQuickError(ImageErrorCode.DOWNLOAD_FAILED);
    expect(err.cause).toBeUndefined();
  });
});

describe('withErrorRecovery', () => {
  it('기본 함수 성공 시 그 결과를 반환한다', async () => {
    const result = await withErrorRecovery(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('기본 함수 실패 + 폴백 성공 시 폴백 결과를 반환한다', async () => {
    const result = await withErrorRecovery(
      () => Promise.reject(new Error('기본 실패')),
      () => Promise.resolve('fallback')
    );
    expect(result).toBe('fallback');
  });

  it('기본·폴백 모두 실패하면 ImageProcessError(CONVERSION_FAILED)를 던진다', async () => {
    await expect(
      withErrorRecovery(
        () => Promise.reject(new Error('기본 실패')),
        () => Promise.reject(new Error('폴백 실패'))
      )
    ).rejects.toSatisfy((e: unknown) => {
      return e instanceof ImageProcessError && e.code === 'CONVERSION_FAILED';
    });
  });

  it('기본·폴백 모두 실패하면 cause는 폴백 에러이다 (원시 원인 아님)', async () => {
    // C 분기: cause: fallbackError — 폴백 에러가 직접 원인으로 연결된다
    const fallbackError = new Error('폴백 실패');
    await expect(
      withErrorRecovery(
        () => Promise.reject(new Error('기본 실패')),
        () => Promise.reject(fallbackError)
      )
    ).rejects.toSatisfy((e: unknown) => {
      return e instanceof ImageProcessError && e.cause === fallbackError;
    });
  });

  it('기본 함수 실패·폴백 없으면 ImageProcessError(CONVERSION_FAILED)를 던진다', async () => {
    await expect(withErrorRecovery(() => Promise.reject(new Error('실패')))).rejects.toSatisfy((e: unknown) => {
      return e instanceof ImageProcessError && e.code === 'CONVERSION_FAILED';
    });
  });

  it('기본 함수 실패·폴백 없으면 cause는 원본 에러이다', async () => {
    // D 분기: cause: error — 원본 일반 Error가 cause로 보존된다
    const originalError = new Error('실패');
    await expect(withErrorRecovery(() => Promise.reject(originalError))).rejects.toSatisfy((e: unknown) => {
      return e instanceof ImageProcessError && e.cause === originalError;
    });
  });

  it('기본 함수에서 ImageProcessError를 던지면 그대로 재전파된다', async () => {
    const original = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    await expect(withErrorRecovery(() => Promise.reject(original))).rejects.toBe(original);
  });

  it('기본 함수에서 ImageProcessError 발생 시에도 폴백이 있으면 폴백 결과를 반환한다', async () => {
    // 폴백 있음 + primary가 ImageProcessError + 폴백 성공 → 폴백 결과 반환
    // 이 분기를 빠뜨리면 "ImageProcessError면 폴백 없이 즉시 재전파" 최적화가 몰래 끼어들어도 탐지 불가
    const original = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    const result = await withErrorRecovery(
      () => Promise.reject(original),
      () => Promise.resolve('fallback')
    );
    expect(result).toBe('fallback');
  });
});

describe('estimateMemoryUsage', () => {
  it('RGBA 4 bytes 계산식이 맞다 (100×100 = 40000 bytes)', () => {
    const result = estimateMemoryUsage(100, 100);
    expect(result.bytes).toBe(100 * 100 * 4);
  });

  it('megabytes는 bytes / (1024*1024)이다', () => {
    const result = estimateMemoryUsage(1024, 1024);
    expect(result.megabytes).toBeCloseTo((1024 * 1024 * 4) / (1024 * 1024), 5);
  });

  it('100MB 미만이면 warning은 false이다', () => {
    // 100×100 → 약 0.04 MB
    const result = estimateMemoryUsage(100, 100);
    expect(result.warning).toBe(false);
  });

  it('100MB 초과 이미지는 warning이 true이다', () => {
    // 6000×6000 → 약 137 MB
    const result = estimateMemoryUsage(6000, 6000);
    expect(result.warning).toBe(true);
  });

  it('정확히 100 MB이면 warning은 false이다 (> 100이므로 경계값은 포함 안 됨)', () => {
    // 5120 × 5120 × 4 bytes = 104,857,600 bytes = 정확히 100.0 MB
    // `> 100` 조건이므로 100은 false; `>= 100`으로 잘못 바꾸면 이 테스트가 잡는다
    const result = estimateMemoryUsage(5120, 5120);
    expect(result.megabytes).toBeCloseTo(100, 5);
    expect(result.warning).toBe(false);
  });

  it('100 MB를 바로 초과하면 warning은 true이다', () => {
    // 5121 × 5120 × 4 bytes ≈ 100.02 MB → warning true
    // 임계치가 50이나 200으로 잘못 바뀌면 이 테스트가 잡는다
    const result = estimateMemoryUsage(5121, 5120);
    expect(result.warning).toBe(true);
  });
});

describe('checkBrowserSupport', () => {
  it('canvas 필드는 boolean이다', () => {
    const result = checkBrowserSupport();
    expect(typeof result.canvas).toBe('boolean');
  });

  it('webp, avif, offscreenCanvas 필드가 모두 존재한다', () => {
    const result = checkBrowserSupport();
    expect('webp' in result).toBe(true);
    expect('avif' in result).toBe(true);
    expect('offscreenCanvas' in result).toBe(true);
  });
});

describe('getErrorStats', () => {
  beforeEach(() => {
    ImageErrorHandler.getInstance().resetStats();
  });

  afterEach(() => {
    ImageErrorHandler.getInstance().resetStats();
    vi.restoreAllMocks();
  });

  it('반환 객체에 totalErrors, errorsByCode, lastErrorTime 필드가 있다', () => {
    const stats = getErrorStats();
    expect(stats).toHaveProperty('totalErrors');
    expect(stats).toHaveProperty('errorsByCode');
    expect(stats).toHaveProperty('lastErrorTime');
  });

  it('초기화 직후 totalErrors는 0이다', () => {
    const stats = getErrorStats();
    expect(stats.totalErrors).toBe(0);
  });
});

describe('logError', () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'trace').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('개발 모드에서 console.group이 호출된다', () => {
    const err = createImageError(ImageErrorCode.RESIZE_FAILED);
    logError(err);
    expect(console.group).toHaveBeenCalledWith('🚨 ImageProcessError');
  });

  it('cause가 Error 인스턴스이면 console.error로 출력된다', () => {
    const cause = new Error('원인 오류');
    const err = createImageError(ImageErrorCode.CONVERSION_FAILED, { cause });
    logError(err);
    expect(console.error).toHaveBeenCalledWith('Original Error:', cause);
  });
});

describe('isFormatSupported', () => {
  it('Promise<boolean>을 반환한다', async () => {
    const result = await isFormatSupported('png');
    expect(typeof result).toBe('boolean');
  });
});

describe('createAndHandleError', () => {
  beforeEach(() => {
    ImageErrorHandler.getInstance().resetStats();
  });

  afterEach(() => {
    ImageErrorHandler.getInstance().resetStats();
  });

  it('지정한 code를 가진 ImageProcessError를 반환한다', async () => {
    const err = await createAndHandleError(ImageErrorCode.RESIZE_FAILED);
    expect(err).toBeInstanceOf(ImageProcessError);
    expect(err.code).toBe('RESIZE_FAILED');
  });

  it('호출 후 핸들러 통계 totalErrors가 증가한다', async () => {
    await createAndHandleError(ImageErrorCode.CONVERSION_FAILED);
    expect(ImageErrorHandler.getInstance().getStats().totalErrors).toBe(1);
  });

  it('cause가 전달되면 에러에 보존된다', async () => {
    const cause = new Error('원본 원인');
    const err = await createAndHandleError(ImageErrorCode.PROCESSING_FAILED, cause);
    expect(err.cause).toBe(cause);
  });
});

describe('withErrorHandling', () => {
  beforeEach(() => {
    ImageErrorHandler.getInstance().resetStats();
  });

  afterEach(() => {
    ImageErrorHandler.getInstance().resetStats();
  });

  it('작업 성공 시 결과를 그대로 반환한다', async () => {
    const result = await withErrorHandling(() => Promise.resolve('ok'), 'test-op');
    expect(result).toBe('ok');
  });

  it('일반 Error 발생 시 PROCESSING_FAILED로 래핑해 던진다', async () => {
    await expect(withErrorHandling(() => Promise.reject(new Error('일반 에러')), 'test-op')).rejects.toSatisfy(
      (e: unknown) => e instanceof ImageProcessError && e.code === 'PROCESSING_FAILED'
    );
  });

  it('ImageProcessError 발생 시 동일 인스턴스를 재전파한다', async () => {
    const original = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    await expect(withErrorHandling(() => Promise.reject(original), 'test-op')).rejects.toBe(original);
  });

  it('ImageProcessError 발생 시에도 핸들러 통계가 증가한다', async () => {
    const original = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    await expect(withErrorHandling(() => Promise.reject(original), 'test-op')).rejects.toThrow();
    expect(ImageErrorHandler.getInstance().getStats().totalErrors).toBe(1);
  });
});
