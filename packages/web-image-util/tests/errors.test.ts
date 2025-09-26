/**
 * 에러 시스템 유닛 테스트
 *
 * @description 커스텀 에러 클래스들과 에러 코드 시스템을 검증하는 테스트
 * Node.js 환경에서 실행 가능한 순수 로직 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  ImageSourceError,
  ImageConversionError,
  ImageCanvasError,
  ImageResizeError,
} from '../src/base/errors';
import {
  ImageProcessError,
  ImageErrorCode,
} from '../src/types';

describe('ImageProcessError (기본 에러 클래스)', () => {
  describe('생성자', () => {
    it('메시지와 코드로 에러 생성', () => {
      const error = new ImageProcessError(
        '테스트 에러 메시지',
        ImageErrorCode.INVALID_SOURCE
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageProcessError);
      expect(error.message).toBe('테스트 에러 메시지');
      expect(error.code).toBe('INVALID_SOURCE');
      expect(error.name).toBe('ImageProcessError');
      expect(error.originalError).toBeUndefined();
    });

    it('원본 에러를 포함하여 생성', () => {
      const originalError = new Error('원본 에러');
      const error = new ImageProcessError(
        '래핑된 에러',
        ImageErrorCode.CONVERSION_FAILED,
        originalError
      );

      expect(error.message).toBe('래핑된 에러');
      expect(error.code).toBe('CONVERSION_FAILED');
      expect(error.originalError).toBe(originalError);
    });

    it('스택 트레이스 설정', () => {
      const error = new ImageProcessError(
        '스택 테스트',
        ImageErrorCode.CANVAS_CREATION_FAILED
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ImageProcessError');
    });
  });

  describe('에러 속성', () => {
    it('enumerable 속성 확인', () => {
      const error = new ImageProcessError(
        '속성 테스트',
        ImageErrorCode.RESIZE_FAILED
      );

      const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
      expect(descriptor?.enumerable).toBe(true); // TypeScript public 속성은 enumerable
      expect(descriptor?.writable).toBe(true); // public readonly가 아니므로 writable
    });

    it('JSON 직렬화', () => {
      const error = new ImageProcessError(
        'JSON 테스트',
        ImageErrorCode.FILE_TOO_LARGE
      );

      const serialized = JSON.parse(JSON.stringify(error));
      // public 속성은 JSON 직렬화됩니다
      expect(serialized.code).toBe('FILE_TOO_LARGE');
      expect(serialized.originalError).toBe(undefined); // Error는 직렬화 안됨
    });
  });
});

describe('ImageErrorCode 상수', () => {
  describe('타입 일치성', () => {
    it('모든 에러 코드가 문자열', () => {
      const codes = Object.values(ImageErrorCode);
      codes.forEach(code => {
        expect(typeof code).toBe('string');
      });
    });

    it('에러 코드 카테고리 확인', () => {
      // 소스 관련 에러
      expect(ImageErrorCode.INVALID_SOURCE).toBe('INVALID_SOURCE');
      expect(ImageErrorCode.UNSUPPORTED_FORMAT).toBe('UNSUPPORTED_FORMAT');
      expect(ImageErrorCode.SOURCE_LOAD_FAILED).toBe('SOURCE_LOAD_FAILED');

      // 처리 관련 에러
      expect(ImageErrorCode.CANVAS_CREATION_FAILED).toBe('CANVAS_CREATION_FAILED');
      expect(ImageErrorCode.RESIZE_FAILED).toBe('RESIZE_FAILED');
      expect(ImageErrorCode.CONVERSION_FAILED).toBe('CONVERSION_FAILED');

      // 파일 관련 에러
      expect(ImageErrorCode.DOWNLOAD_FAILED).toBe('DOWNLOAD_FAILED');
      expect(ImageErrorCode.FILE_TOO_LARGE).toBe('FILE_TOO_LARGE');

      // 브라우저 호환성 에러
      expect(ImageErrorCode.BROWSER_NOT_SUPPORTED).toBe('BROWSER_NOT_SUPPORTED');
      expect(ImageErrorCode.FEATURE_NOT_SUPPORTED).toBe('FEATURE_NOT_SUPPORTED');
    });

    it('중복 에러 코드 없음', () => {
      const codes = Object.values(ImageErrorCode);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });
  });

  describe('as const 어설션', () => {
    it('에러 코드가 리터럴 타입', () => {
      // TypeScript 컴파일 타임에서 검증됨
      const sourceCode: 'INVALID_SOURCE' = ImageErrorCode.INVALID_SOURCE;
      const conversionCode: 'CONVERSION_FAILED' = ImageErrorCode.CONVERSION_FAILED;

      expect(sourceCode).toBe('INVALID_SOURCE');
      expect(conversionCode).toBe('CONVERSION_FAILED');
    });
  });
});

describe('ImageSourceError (소스 로딩 에러)', () => {
  it('기본 생성', () => {
    const source = 'invalid-image.jpg';
    const error = new ImageSourceError('이미지 로딩 실패', source);

    expect(error).toBeInstanceOf(ImageSourceError);
    expect(error).toBeInstanceOf(ImageProcessError);
    expect(error.name).toBe('ImageSourceError');
    expect(error.code).toBe('SOURCE_LOAD_FAILED');
    expect(error.source).toBe(source);
    expect(error.message).toBe('이미지 로딩 실패');
  });

  it('원본 에러와 함께 생성', () => {
    const originalError = new Error('네트워크 에러');
    const source = { url: 'https://example.com/image.jpg' };
    const error = new ImageSourceError(
      '네트워크에서 이미지를 불러올 수 없습니다',
      source,
      originalError
    );

    expect(error.source).toBe(source);
    expect(error.originalError).toBe(originalError);
    expect(error.code).toBe('SOURCE_LOAD_FAILED');
  });

  it('다양한 소스 타입 지원', () => {
    const sources = [
      'string-url',
      { blob: new Blob() },
      123,
      null,
      undefined
    ];

    sources.forEach(source => {
      const error = new ImageSourceError('테스트', source);
      expect(error.source).toBe(source);
    });
  });
});

describe('ImageConversionError (변환 에러)', () => {
  it('포맷 변환 에러', () => {
    const error = new ImageConversionError(
      '지원하지 않는 포맷입니다',
      'tiff',
      'webp'
    );

    expect(error).toBeInstanceOf(ImageConversionError);
    expect(error.name).toBe('ImageConversionError');
    expect(error.code).toBe('CONVERSION_FAILED');
    expect(error.message).toBe('지원하지 않는 포맷입니다 (tiff → webp)');
  });

  it('원본 에러와 함께', () => {
    const originalError = new Error('Canvas toBlob 실패');
    const error = new ImageConversionError(
      '변환 실패',
      'png',
      'jpeg',
      originalError
    );

    expect(error.message).toBe('변환 실패 (png → jpeg)');
    expect(error.originalError).toBe(originalError);
  });

  it('빈 포맷 이름 처리', () => {
    const error = new ImageConversionError('에러', '', 'png');
    expect(error.message).toBe('에러 ( → png)');
  });
});

describe('ImageCanvasError (Canvas 에러)', () => {
  it('기본 Canvas 에러', () => {
    const error = new ImageCanvasError('Canvas 컨텍스트를 생성할 수 없습니다');

    expect(error).toBeInstanceOf(ImageCanvasError);
    expect(error.name).toBe('ImageCanvasError');
    expect(error.code).toBe('CANVAS_CREATION_FAILED');
    expect(error.message).toBe('Canvas 컨텍스트를 생성할 수 없습니다');
  });

  it('WebGL 컨텍스트 에러', () => {
    const webglError = new Error('WebGL not supported');
    const error = new ImageCanvasError('WebGL 컨텍스트 실패', webglError);

    expect(error.originalError).toBe(webglError);
  });
});

describe('ImageResizeError (리사이징 에러)', () => {
  it('기본 리사이징 에러', () => {
    const error = new ImageResizeError('이미지가 너무 큽니다');

    expect(error).toBeInstanceOf(ImageResizeError);
    expect(error.name).toBe('ImageResizeError');
    expect(error.code).toBe('RESIZE_FAILED');
    expect(error.message).toBe('이미지가 너무 큽니다');
  });

  it('메모리 부족 에러', () => {
    const memoryError = new Error('Out of memory');
    const error = new ImageResizeError('메모리 부족으로 리사이징 실패', memoryError);

    expect(error.originalError).toBe(memoryError);
  });
});

describe('에러 체인 및 상속 구조', () => {
  it('모든 커스텀 에러가 ImageProcessError 상속', () => {
    const errors = [
      new ImageSourceError('test', 'source'),
      new ImageConversionError('test', 'png', 'jpg'),
      new ImageCanvasError('test'),
      new ImageResizeError('test'),
    ];

    errors.forEach(error => {
      expect(error).toBeInstanceOf(ImageProcessError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  it('instanceof 체인 확인', () => {
    const error = new ImageSourceError('test', 'source');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof ImageProcessError).toBe(true);
    expect(error instanceof ImageSourceError).toBe(true);

    // 다른 타입은 아님
    expect(error instanceof ImageConversionError).toBe(false);
    expect(error instanceof ImageCanvasError).toBe(false);
  });

  it('에러 타입 검증 함수', () => {
    function isImageError(error: unknown): error is ImageProcessError {
      return error instanceof ImageProcessError;
    }

    const imageError = new ImageResizeError('test');
    const regularError = new Error('regular');

    expect(isImageError(imageError)).toBe(true);
    expect(isImageError(regularError)).toBe(false);
  });
});

describe('에러 메시지 로케일화 대비', () => {
  it('에러 코드와 메시지 분리', () => {
    const error = new ImageProcessError(
      'English error message',
      ImageErrorCode.INVALID_SOURCE
    );

    // 에러 코드는 언어에 독립적
    expect(error.code).toBe('INVALID_SOURCE');
    // 메시지는 로케일에 따라 변경 가능
    expect(error.message).toBe('English error message');
  });

  it('메시지 없이 에러 코드만으로 생성', () => {
    const error = new ImageProcessError('', ImageErrorCode.FILE_TOO_LARGE);

    expect(error.code).toBe('FILE_TOO_LARGE');
    expect(error.message).toBe('');
  });
});

describe('에러 필터링 및 분류', () => {
  it('소스 관련 에러 필터링', () => {
    const errors = [
      new ImageProcessError('msg1', ImageErrorCode.INVALID_SOURCE),
      new ImageProcessError('msg2', ImageErrorCode.SOURCE_LOAD_FAILED),
      new ImageProcessError('msg3', ImageErrorCode.RESIZE_FAILED),
      new ImageProcessError('msg4', ImageErrorCode.UNSUPPORTED_FORMAT),
    ];

    const sourceErrors = errors.filter(error =>
      ['INVALID_SOURCE', 'SOURCE_LOAD_FAILED', 'UNSUPPORTED_FORMAT'].includes(error.code)
    );

    expect(sourceErrors).toHaveLength(3);
  });

  it('심각도별 에러 분류', () => {
    const criticalCodes = ['BROWSER_NOT_SUPPORTED', 'CANVAS_CREATION_FAILED'];
    const warningCodes = ['FILE_TOO_LARGE', 'UNSUPPORTED_FORMAT'];

    const error1 = new ImageProcessError('critical', ImageErrorCode.BROWSER_NOT_SUPPORTED);
    const error2 = new ImageProcessError('warning', ImageErrorCode.FILE_TOO_LARGE);

    const isCritical = (error: ImageProcessError) =>
      criticalCodes.includes(error.code);
    const isWarning = (error: ImageProcessError) =>
      warningCodes.includes(error.code);

    expect(isCritical(error1)).toBe(true);
    expect(isWarning(error1)).toBe(false);
    expect(isCritical(error2)).toBe(false);
    expect(isWarning(error2)).toBe(true);
  });
});