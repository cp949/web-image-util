/**
 * error-helpers.ts 헬퍼 함수 단위 테스트.
 *
 * createImageError, createQuickError, isFormatSupported의 입출력 계약을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageErrorCode, ImageProcessError } from '../../../src';
import { createImageError, createQuickError, isFormatSupported } from '../../../src/base/error-helpers';

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

describe('isFormatSupported', () => {
  it('Promise<boolean>을 반환한다', async () => {
    const result = await isFormatSupported('png');
    expect(typeof result).toBe('boolean');
  });

  it('알 수 없는 포맷은 PNG 폴백으로 지원 판정하지 않는다', async () => {
    await expect(isFormatSupported('unknown-format')).resolves.toBe(false);
  });
});
