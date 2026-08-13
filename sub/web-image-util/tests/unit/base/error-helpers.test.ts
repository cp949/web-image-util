/**
 * error-helpers.ts 헬퍼 함수 단위 테스트.
 *
 * createImageError, createQuickError, getErrorStats,
 * createAndHandleError, withErrorHandling 등의 입출력 계약을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageErrorCode, ImageProcessError } from '../../../src';
import { ImageErrorHandler } from '../../../src/base/error-handler';
import {
  createAndHandleError,
  createImageError,
  createQuickError,
  getErrorStats,
  isFormatSupported,
  withErrorHandling,
} from '../../../src/base/error-helpers';

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

describe('isFormatSupported', () => {
  it('Promise<boolean>을 반환한다', async () => {
    const result = await isFormatSupported('png');
    expect(typeof result).toBe('boolean');
  });

  it('알 수 없는 포맷은 PNG 폴백으로 지원 판정하지 않는다', async () => {
    await expect(isFormatSupported('unknown-format')).resolves.toBe(false);
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
