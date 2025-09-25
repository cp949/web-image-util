/**
 * 에러 시스템 순수 로직 테스트
 * Node.js 환경에서 실행 가능한 브라우저 API 독립적 테스트
 */

import { describe, it, expect } from 'vitest';
import { ImageProcessError, type ImageErrorCode } from '../../src/types';

describe('에러 시스템 - 순수 로직', () => {
  describe('ImageProcessError', () => {
    it('기본 에러 생성', () => {
      const error = new ImageProcessError('테스트 에러', 'INVALID_SOURCE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageProcessError);
      expect(error.message).toBe('테스트 에러');
      expect(error.code).toBe('INVALID_SOURCE');
      expect(error.name).toBe('ImageProcessError');
      expect(error.originalError).toBeUndefined();
    });

    it('원본 에러와 함께 에러 생성', () => {
      const originalError = new Error('원본 에러');
      const error = new ImageProcessError('처리 에러', 'SOURCE_LOAD_FAILED', originalError);

      expect(error.message).toBe('처리 에러');
      expect(error.code).toBe('SOURCE_LOAD_FAILED');
      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe('원본 에러');
    });

    it('스택 추적이 올바르게 설정됨', () => {
      const error = new ImageProcessError('스택 테스트', 'CANVAS_CREATION_FAILED');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ImageProcessError');
    });

    it('에러 직렬화', () => {
      const error = new ImageProcessError('직렬화 테스트', 'CONVERSION_FAILED');

      // 에러 객체의 기본 속성들 검사 (JSON.stringify는 Error 객체 속성을 직렬화하지 않을 수 있음)
      expect(error.message).toBe('직렬화 테스트');
      expect(error.code).toBe('CONVERSION_FAILED');
      expect(error.name).toBe('ImageProcessError');

      // 수동 직렬화 테스트
      const manualSerialized = {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      };

      expect(manualSerialized.message).toBe('직렬화 테스트');
      expect(manualSerialized.code).toBe('CONVERSION_FAILED');
      expect(manualSerialized.name).toBe('ImageProcessError');
    });
  });

  describe('ImageErrorCode', () => {
    it('모든 에러 코드가 유효한 문자열', () => {
      const errorCodes: ImageErrorCode[] = [
        // 소스 관련 에러
        'INVALID_SOURCE',
        'UNSUPPORTED_FORMAT',
        'SOURCE_LOAD_FAILED',
        // 처리 관련 에러
        'CANVAS_CREATION_FAILED',
        'RESIZE_FAILED',
        'CONVERSION_FAILED',
        'BLUR_FAILED',
        // 파일 관련 에러
        'OUTPUT_FAILED',
        'DOWNLOAD_FAILED',
        'FILE_TOO_LARGE',
        // 브라우저 호환성 에러
        'BROWSER_NOT_SUPPORTED',
        'FEATURE_NOT_SUPPORTED'
      ];

      errorCodes.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
        expect(code).toMatch(/^[A-Z_]+$/); // 대문자와 언더스코어만
      });
    });

    it('에러 코드별 에러 생성', () => {
      const errorScenarios: Array<{
        code: ImageErrorCode;
        message: string;
        category: string;
      }> = [
        // 소스 관련
        { code: 'INVALID_SOURCE', message: '유효하지 않은 소스', category: 'source' },
        { code: 'UNSUPPORTED_FORMAT', message: '지원하지 않는 형식', category: 'source' },
        { code: 'SOURCE_LOAD_FAILED', message: '소스 로딩 실패', category: 'source' },

        // 처리 관련
        { code: 'CANVAS_CREATION_FAILED', message: 'Canvas 생성 실패', category: 'processing' },
        { code: 'RESIZE_FAILED', message: '리사이징 실패', category: 'processing' },
        { code: 'CONVERSION_FAILED', message: '변환 실패', category: 'processing' },
        { code: 'BLUR_FAILED', message: '블러 처리 실패', category: 'processing' },

        // 파일 관련
        { code: 'OUTPUT_FAILED', message: '출력 실패', category: 'output' },
        { code: 'DOWNLOAD_FAILED', message: '다운로드 실패', category: 'output' },
        { code: 'FILE_TOO_LARGE', message: '파일이 너무 큼', category: 'output' },

        // 브라우저 호환성
        { code: 'BROWSER_NOT_SUPPORTED', message: '브라우저 미지원', category: 'compatibility' },
        { code: 'FEATURE_NOT_SUPPORTED', message: '기능 미지원', category: 'compatibility' }
      ];

      errorScenarios.forEach(scenario => {
        const error = new ImageProcessError(scenario.message, scenario.code);

        expect(error.code).toBe(scenario.code);
        expect(error.message).toBe(scenario.message);
        expect(error).toBeInstanceOf(ImageProcessError);
      });
    });
  });

  describe('에러 체인 및 상속', () => {
    it('Error 프로토타입 체인 유지', () => {
      const error = new ImageProcessError('체인 테스트', 'INVALID_SOURCE');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ImageProcessError).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(ImageProcessError.prototype);
      expect(Object.getPrototypeOf(ImageProcessError.prototype)).toBe(Error.prototype);
    });

    it('에러 상속 구조', () => {
      class CustomImageError extends ImageProcessError {
        constructor(message: string, code: ImageErrorCode, public customData: any) {
          super(message, code);
          this.name = 'CustomImageError';
        }
      }

      const customError = new CustomImageError('커스텀 에러', 'BLUR_FAILED', { extra: 'data' });

      expect(customError instanceof Error).toBe(true);
      expect(customError instanceof ImageProcessError).toBe(true);
      expect(customError instanceof CustomImageError).toBe(true);
      expect(customError.customData.extra).toBe('data');
      expect(customError.name).toBe('CustomImageError');
    });

    it('원본 에러 체인 유지', () => {
      const rootError = new TypeError('타입 에러');
      const sourceError = new ImageProcessError('소스 에러', 'SOURCE_LOAD_FAILED', rootError);
      const processingError = new ImageProcessError('처리 에러', 'CONVERSION_FAILED', sourceError);

      // 에러 체인 검증
      expect(processingError.originalError).toBe(sourceError);
      expect(processingError.originalError?.originalError).toBe(rootError);
      expect(processingError.originalError?.originalError?.message).toBe('타입 에러');
    });
  });

  describe('에러 메시지 및 정보', () => {
    it('다양한 언어의 에러 메시지', () => {
      const messages = [
        '이미지 소스가 유효하지 않습니다',
        'Invalid image source',
        '画像ソースが無効です',
        'Source d\'image invalide'
      ];

      messages.forEach(message => {
        const error = new ImageProcessError(message, 'INVALID_SOURCE');
        expect(error.message).toBe(message);
        expect(error.toString()).toContain(message);
      });
    });

    it('에러 정보 접근성', () => {
      const error = new ImageProcessError('접근성 테스트', 'RESIZE_FAILED');

      // 표준 Error 인터페이스 준수
      expect(error.name).toBeDefined();
      expect(error.message).toBeDefined();
      expect(error.stack).toBeDefined();

      // 커스텀 속성 접근성
      expect(error.code).toBeDefined();
      expect(error.hasOwnProperty('code')).toBe(true);
      expect(error.hasOwnProperty('originalError')).toBe(true);
    });

    it('에러 문자열 표현', () => {
      const error = new ImageProcessError('문자열 테스트', 'OUTPUT_FAILED');
      const errorString = error.toString();

      expect(errorString).toContain('ImageProcessError');
      expect(errorString).toContain('문자열 테스트');
      expect(typeof errorString).toBe('string');
    });
  });

  describe('에러 처리 시나리오', () => {
    it('에러 코드별 처리 로직', () => {
      const errorHandlers = new Map<ImageErrorCode, (error: ImageProcessError) => string>([
        ['INVALID_SOURCE', (e) => `소스 오류: ${e.message}`],
        ['SOURCE_LOAD_FAILED', (e) => `로딩 오류: ${e.message}`],
        ['CANVAS_CREATION_FAILED', (e) => `Canvas 오류: ${e.message}`],
        ['CONVERSION_FAILED', (e) => `변환 오류: ${e.message}`],
        ['BROWSER_NOT_SUPPORTED', (e) => `브라우저 호환성 오류: ${e.message}`]
      ]);

      errorHandlers.forEach((handler, code) => {
        const error = new ImageProcessError(`${code} 테스트`, code);
        const result = handler(error);

        expect(result).toContain(error.message);
        expect(typeof result).toBe('string');
      });
    });

    it('에러 복구 전략', () => {
      const executeWithFallback = <T>(
        operation: () => T,
        fallback: T,
        expectedErrorCode?: ImageErrorCode
      ): T => {
        try {
          return operation();
        } catch (error) {
          if (error instanceof ImageProcessError) {
            if (!expectedErrorCode || error.code === expectedErrorCode) {
              return fallback;
            }
          }
          throw error;
        }
      };

      // 성공 케이스
      const successResult = executeWithFallback(() => 'success', 'fallback');
      expect(successResult).toBe('success');

      // 실패 케이스 - 예상된 에러
      const failureResult = executeWithFallback(() => {
        throw new ImageProcessError('예상된 에러', 'CONVERSION_FAILED');
      }, 'fallback', 'CONVERSION_FAILED');
      expect(failureResult).toBe('fallback');

      // 실패 케이스 - 예상치 못한 에러
      expect(() => {
        executeWithFallback(() => {
          throw new ImageProcessError('예상치 못한 에러', 'INVALID_SOURCE');
        }, 'fallback', 'CONVERSION_FAILED');
      }).toThrow();
    });
  });
});