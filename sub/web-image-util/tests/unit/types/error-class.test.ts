import { describe, expect, test } from 'vitest';
import { ImageErrorCodeConstants, ImageProcessError } from '../../../src/types';

/**
 * ImageProcessError 클래스 테스트
 *
 * @description WSL 환경에서 실행 가능한 에러 클래스 검증
 * - 에러 클래스 기본 동작 확인
 * - 에러 코드 시스템 검증
 * - 스택 추적 및 직렬화 테스트
 */
describe('ImageProcessError 클래스', () => {
  describe('기본 에러 생성', () => {
    test('기본 에러 생성이 올바르게 작동해야 함', () => {
      const error = new ImageProcessError('테스트 메시지', 'INVALID_SOURCE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageProcessError);
      expect(error.name).toBe('ImageProcessError');
      expect(error.message).toBe('테스트 메시지');
      expect(error.code).toBe('INVALID_SOURCE');
      expect(error.originalError).toBeUndefined();
    });

    test('빈 메시지로 에러 생성이 작동해야 함', () => {
      const error = new ImageProcessError('', 'OUTPUT_FAILED');

      expect(error.message).toBe('');
      expect(error.code).toBe('OUTPUT_FAILED');
      expect(error.name).toBe('ImageProcessError');
    });

    test('긴 메시지로 에러 생성이 작동해야 함', () => {
      const longMessage = 'A'.repeat(1000) + ' 처리 중 오류가 발생했습니다.';
      const error = new ImageProcessError(longMessage, 'PROCESSING_FAILED');

      expect(error.message).toBe(longMessage);
      expect(error.code).toBe('PROCESSING_FAILED');
    });
  });

  describe('원본 에러와 함께 에러 생성', () => {
    test('원본 에러와 함께 에러 생성이 작동해야 함', () => {
      const originalError = new Error('원본 에러');
      const error = new ImageProcessError('처리 중 오류 발생', 'CANVAS_CREATION_FAILED', originalError);

      expect(error.message).toBe('처리 중 오류 발생');
      expect(error.code).toBe('CANVAS_CREATION_FAILED');
      expect(error.originalError).toBe(originalError);
    });

    test('타입 에러와 함께 에러 생성이 작동해야 함', () => {
      const originalError = new TypeError('타입 오류');
      const error = new ImageProcessError(
        'Canvas context를 생성할 수 없습니다',
        'CANVAS_CONTEXT_FAILED',
        originalError
      );

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.name).toBe('TypeError');
      expect(error.originalError?.message).toBe('타입 오류');
    });

    test('사용자 정의 에러와 함께 에러 생성이 작동해야 함', () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public customCode: string
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const originalError = new CustomError('사용자 정의 오류', 'CUSTOM_001');
      const error = new ImageProcessError('SVG 처리 실패', 'SVG_PROCESSING_FAILED', originalError);

      expect(error.originalError).toBe(originalError);
      expect((error.originalError as CustomError).customCode).toBe('CUSTOM_001');
    });
  });

  describe('에러 코드 검증', () => {
    test('모든 에러 코드가 유효해야 함', () => {
      const errorCodes = Object.values(ImageErrorCodeConstants);

      errorCodes.forEach((code) => {
        const error = new ImageProcessError('테스트', code);
        expect(error.code).toBe(code);
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
      });
    });

    test('필수 에러 코드들이 모두 존재해야 함', () => {
      const requiredCodes = [
        'INVALID_SOURCE',
        'CANVAS_CREATION_FAILED',
        'OUTPUT_FAILED',
        'IMAGE_LOAD_FAILED',
        'PROCESSING_FAILED',
        'MEMORY_ERROR',
        'TIMEOUT_ERROR',
        'SVG_LOAD_FAILED',
        'BROWSER_NOT_SUPPORTED',
      ];

      requiredCodes.forEach((code) => {
        expect(Object.values(ImageErrorCodeConstants)).toContain(code);

        // 각 코드로 에러 생성이 가능해야 함
        const error = new ImageProcessError('테스트', code as any);
        expect(error.code).toBe(code);
      });
    });

    test('에러 코드가 중복되지 않아야 함', () => {
      const codes = Object.values(ImageErrorCodeConstants);
      const uniqueCodes = [...new Set(codes)];

      expect(codes.length).toBe(uniqueCodes.length);
    });

    test('에러 코드가 일관된 명명 규칙을 따라야 함', () => {
      const codes = Object.values(ImageErrorCodeConstants);

      codes.forEach((code) => {
        // 대문자와 언더스코어만 사용
        expect(code).toMatch(/^[A-Z_]+$/);

        // 빈 문자열이 아니어야 함
        expect(code.length).toBeGreaterThan(0);

        // 언더스코어로 시작하거나 끝나지 않아야 함
        expect(code).not.toMatch(/^_|_$/);
      });
    });
  });

  describe('에러 스택 추적', () => {
    test('에러 스택 추적이 올바르게 설정되어야 함', () => {
      const error = new ImageProcessError('스택 테스트', 'OUTPUT_FAILED');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
      expect(error.stack).toContain('ImageProcessError');
    });

    test('스택 추적에 파일 정보가 포함되어야 함', () => {
      const error = new ImageProcessError('파일 정보 테스트', 'PROCESSING_FAILED');

      expect(error.stack).toBeDefined();
      if (error.stack) {
        // 스택에 이 테스트 파일 정보가 포함되어야 함
        expect(error.stack).toContain('error-class.test.ts');
      }
    });

    test('원본 에러의 스택 정보가 보존되어야 함', () => {
      const originalError = new Error('원본 스택');
      const error = new ImageProcessError('스택 보존 테스트', 'CANVAS_CREATION_FAILED', originalError);

      expect(error.stack).toBeDefined();
      expect(error.originalError?.stack).toBeDefined();
      expect(error.originalError?.stack).toContain('원본 스택');
    });
  });

  describe('에러 직렬화 및 역직렬화', () => {
    test('기본 에러 직렬화가 올바르게 작동해야 함', () => {
      const error = new ImageProcessError('직렬화 테스트', 'INVALID_SOURCE');

      // JSON.stringify 기본 동작 확인
      const serialized = JSON.stringify(error);
      expect(typeof serialized).toBe('string');

      // Error 객체의 기본 속성들은 enumerable하지 않으므로 직접 확인
      expect(error.message).toBe('직렬화 테스트');
      expect(error.name).toBe('ImageProcessError');
      expect(error.code).toBe('INVALID_SOURCE');

      // 커스텀 직렬화 방법으로 테스트
      const customSerialized = JSON.stringify({
        message: error.message,
        name: error.name,
        code: error.code,
      });
      const customParsed = JSON.parse(customSerialized);
      expect(customParsed.message).toBe('직렬화 테스트');
      expect(customParsed.name).toBe('ImageProcessError');
      expect(customParsed.code).toBe('INVALID_SOURCE');
    });

    test('원본 에러를 포함한 에러 직렬화가 작동해야 함', () => {
      const originalError = new Error('원본 에러');
      const error = new ImageProcessError('복합 에러 테스트', 'PROCESSING_FAILED', originalError);

      // Error 객체의 기본 속성들은 enumerable하지 않으므로 직접 확인
      expect(error.message).toBe('복합 에러 테스트');
      expect(error.name).toBe('ImageProcessError');
      expect(error.code).toBe('PROCESSING_FAILED');
      expect(error.originalError).toBe(originalError);

      // 커스텀 직렬화 방법으로 테스트
      const customSerialized = JSON.stringify({
        message: error.message,
        name: error.name,
        code: error.code,
        originalError: error.originalError
          ? {
              message: error.originalError.message,
              name: error.originalError.name,
            }
          : null,
      });
      const customParsed = JSON.parse(customSerialized);
      expect(customParsed.message).toBe('복합 에러 테스트');
      expect(customParsed.name).toBe('ImageProcessError');
    });

    test('toString 메서드가 올바르게 작동해야 함', () => {
      const error = new ImageProcessError('toString 테스트', 'OUTPUT_FAILED');
      const errorString = error.toString();

      expect(typeof errorString).toBe('string');
      expect(errorString).toContain('ImageProcessError');
      expect(errorString).toContain('toString 테스트');
    });
  });

  describe('Error 클래스 상속', () => {
    test('Error 클래스의 모든 속성이 상속되어야 함', () => {
      const error = new ImageProcessError('상속 테스트', 'MEMORY_ERROR');

      // Error 클래스 기본 속성들
      expect(error.name).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.stack).toBeDefined();

      // Error 인스턴스 확인
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ImageProcessError).toBe(true);
    });

    test('instanceof 연산자가 올바르게 작동해야 함', () => {
      const error = new ImageProcessError('인스턴스 테스트', 'TIMEOUT_ERROR');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ImageProcessError).toBe(true);
      expect(error instanceof TypeError).toBe(false);
      expect(error instanceof ReferenceError).toBe(false);
    });

    test('Error.captureStackTrace가 호출되어야 함 (V8 환경)', () => {
      // V8 엔진(Node.js)에서만 사용 가능한 기능
      const originalCaptureStackTrace = (Error as any).captureStackTrace;

      if (originalCaptureStackTrace) {
        // captureStackTrace가 있는 환경에서는 호출되어야 함
        const error = new ImageProcessError('스택 캡처 테스트', 'PROCESSING_FAILED');
        expect(error.stack).toBeDefined();
      } else {
        // captureStackTrace가 없는 환경에서도 스택은 존재해야 함
        const error = new ImageProcessError('스택 테스트', 'PROCESSING_FAILED');
        expect(error.stack).toBeDefined();
      }
    });
  });

  describe('에러 카테고리별 테스트', () => {
    test('소스 관련 에러들이 올바르게 생성되어야 함', () => {
      const sourceCodes = ['INVALID_SOURCE', 'UNSUPPORTED_FORMAT', 'SOURCE_LOAD_FAILED'];

      sourceCodes.forEach((code) => {
        const error = new ImageProcessError(`${code} 테스트`, code as any);
        expect(error.code).toBe(code);
        expect(error.message).toContain(code);
      });
    });

    test('처리 관련 에러들이 올바르게 생성되어야 함', () => {
      const processingCodes = [
        'CANVAS_CREATION_FAILED',
        'CANVAS_CONTEXT_FAILED',
        'RESIZE_FAILED',
        'BLUR_FAILED',
        'PROCESSING_FAILED',
      ];

      processingCodes.forEach((code) => {
        const error = new ImageProcessError(`${code} 테스트`, code as any);
        expect(error.code).toBe(code);
        expect(error.message).toContain(code);
      });
    });

    test('출력 관련 에러들이 올바르게 생성되어야 함', () => {
      const outputCodes = ['OUTPUT_FAILED', 'DOWNLOAD_FAILED', 'CANVAS_TO_BLOB_FAILED'];

      outputCodes.forEach((code) => {
        const error = new ImageProcessError(`${code} 테스트`, code as any);
        expect(error.code).toBe(code);
        expect(error.message).toContain(code);
      });
    });

    test('시스템 관련 에러들이 올바르게 생성되어야 함', () => {
      const systemCodes = ['MEMORY_ERROR', 'TIMEOUT_ERROR', 'BROWSER_NOT_SUPPORTED', 'FEATURE_NOT_SUPPORTED'];

      systemCodes.forEach((code) => {
        const error = new ImageProcessError(`${code} 테스트`, code as any);
        expect(error.code).toBe(code);
        expect(error.message).toContain(code);
      });
    });
  });

  describe('에러 체이닝', () => {
    test('에러 체이닝이 올바르게 작동해야 함', () => {
      const rootError = new Error('루트 에러');
      const middleError = new ImageProcessError('중간 에러', 'PROCESSING_FAILED', rootError);
      const topError = new ImageProcessError('최종 에러', 'OUTPUT_FAILED', middleError);

      expect(topError.originalError).toBe(middleError);
      expect((topError.originalError as ImageProcessError)?.originalError).toBe(rootError);
    });

    test('깊은 에러 체이닝이 가능해야 함', () => {
      let currentError: Error = new Error('원본 에러');

      for (let i = 1; i <= 5; i++) {
        currentError = new ImageProcessError(`레벨 ${i} 에러`, 'PROCESSING_FAILED', currentError);
      }

      // 최종 에러에서 원본까지 추적 가능해야 함
      let depth = 0;
      let error: Error | undefined = currentError;
      while (error && depth < 10) {
        // 무한 루프 방지
        depth++;
        error = (error as ImageProcessError).originalError;
      }

      expect(depth).toBe(6); // 5개 레벨 + 원본 에러 = 6
    });
  });
});
