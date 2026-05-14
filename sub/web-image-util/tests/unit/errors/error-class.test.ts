/**
 * ImageProcessError 클래스 계층 단위 테스트.
 *
 * 에러 코드, name, cause 보존, instanceof 체계가 회귀하지 않도록 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { ImageErrorCode, ImageProcessError } from '../../../src/errors';

describe('ImageProcessError 기본 생성', () => {
  it('name 필드는 항상 ImageProcessError이다', () => {
    const err = new ImageProcessError('테스트', ImageErrorCode.PROCESSING_FAILED);
    expect(err.name).toBe('ImageProcessError');
  });

  it('전달한 code가 그대로 보존된다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    expect(err.code).toBe('RESIZE_FAILED');
  });

  it('options 없이 생성하면 cause와 details는 undefined이다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.INVALID_SOURCE);
    expect(err.cause).toBeUndefined();
    expect(err.details).toBeUndefined();
  });
});

describe('ImageProcessError instanceof 체계', () => {
  it('instanceof Error가 true이다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.OUTPUT_FAILED);
    expect(err).toBeInstanceOf(Error);
  });

  it('instanceof ImageProcessError가 true이다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.OUTPUT_FAILED);
    expect(err).toBeInstanceOf(ImageProcessError);
  });
});

describe('ImageProcessError cause 보존', () => {
  it('Error 인스턴스를 cause로 전달하면 err.cause가 원본과 동일하다', () => {
    const original = new Error('원인 에러');
    const err = new ImageProcessError('msg', ImageErrorCode.CONVERSION_FAILED, { cause: original });
    expect(err.cause).toBe(original);
  });

  it('문자열도 cause로 전달할 수 있다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.CONVERSION_FAILED, { cause: '문자열 원인' });
    expect(err.cause).toBe('문자열 원인');
  });

  it('cause 없이 생성하면 cause는 undefined이다', () => {
    const err = new ImageProcessError('msg', ImageErrorCode.BLUR_FAILED, {});
    expect(err.cause).toBeUndefined();
  });
});

describe('ImageProcessError details 보존', () => {
  it('details 객체가 그대로 보존된다', () => {
    const details = { actualBytes: 1000, maxBytes: 500 };
    const err = new ImageProcessError('msg', ImageErrorCode.SOURCE_BYTES_EXCEEDED, { details });
    expect(err.details).toBe(details);
  });

  it('details의 개별 필드에 접근할 수 있다', () => {
    const details = { actualBytes: 2048, maxBytes: 1024 };
    const err = new ImageProcessError('msg', ImageErrorCode.SVG_BYTES_EXCEEDED, { details });
    expect((err.details as typeof details).actualBytes).toBe(2048);
    expect((err.details as typeof details).maxBytes).toBe(1024);
  });
});

describe('ImageErrorCode 상수 집합', () => {
  it('알려진 코드 값들이 문자열로 존재한다', () => {
    // 공개 API에서 자주 쓰이는 코드들이 정의되어 있어야 한다
    const expected = [
      'INVALID_SOURCE',
      'PROCESSING_FAILED',
      'RESIZE_FAILED',
      'CONVERSION_FAILED',
      'SVG_LOAD_FAILED',
      'CANVAS_CREATION_FAILED',
    ] as const;

    for (const code of expected) {
      expect(ImageErrorCode[code]).toBe(code);
    }
  });

  it('코드 값은 키와 동일한 문자열이다', () => {
    // as const 객체 특성: 값 === 키
    for (const [key, value] of Object.entries(ImageErrorCode)) {
      expect(value).toBe(key);
    }
  });
});

describe('ImageProcessError 직렬화', () => {
  it('String() 변환 시 name과 message가 포함된다', () => {
    const err = new ImageProcessError('처리 실패', ImageErrorCode.PROCESSING_FAILED);
    const str = String(err);
    expect(str).toContain('ImageProcessError');
    expect(str).toContain('처리 실패');
  });
});
