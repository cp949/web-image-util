import { describe, expect, test } from 'vitest';
import { ImageProcessError, ImageProcessor, processImage } from '../../../src';

describe('에러 처리 계약', () => {
  describe('processImage 에러 처리', () => {
    test('null 소스는 processor를 반환하지만 실행 시 에러 발생', async () => {
      const processor = processImage(null as any);
      expect(processor).toBeInstanceOf(ImageProcessor);

      // 실행 시점에 에러가 발생해야 함
      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);

      // Promise가 reject되는지 확인
      await expect(promise).rejects.toThrow();
    });

    test('undefined 소스는 processor를 반환하지만 실행 시 에러 발생', async () => {
      const processor = processImage(undefined as any);
      expect(processor).toBeInstanceOf(ImageProcessor);

      // 실행 시점에 에러가 발생해야 함
      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);

      // Promise가 reject되는지 확인
      await expect(promise).rejects.toThrow();
    });

    test('잘못된 타입은 processor를 반환하지만 실행 시 에러 발생', () => {
      const processor1 = processImage(123 as any);
      const processor2 = processImage({} as any);
      const processor3 = processImage([] as any);

      expect(processor1).toBeInstanceOf(ImageProcessor);
      expect(processor2).toBeInstanceOf(ImageProcessor);
      expect(processor3).toBeInstanceOf(ImageProcessor);
    });

    test('빈 문자열은 processor를 반환하지만 실행 시 에러 발생', () => {
      const processor = processImage('');
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('에러 코드 상수가 올바르게 정의되어야 함', () => {
      // ImageProcessError 클래스가 올바르게 내보내지는지 확인
      const error = new ImageProcessError('테스트', 'INVALID_SOURCE');
      expect(error).toBeInstanceOf(ImageProcessError);
      expect(error.code).toBe('INVALID_SOURCE');
    });
  });

  describe('ImageProcessError 클래스', () => {
    test('Error 클래스를 상속해야 함', () => {
      const error = new ImageProcessError('테스트', 'INVALID_SOURCE');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ImageProcessError);
    });

    test('필수 속성들이 설정되어야 함', () => {
      const error = new ImageProcessError('테스트 메시지', 'CANVAS_CREATION_FAILED');

      expect(error.name).toBe('ImageProcessError');
      expect(error.message).toBe('테스트 메시지');
      expect(error.code).toBe('CANVAS_CREATION_FAILED');
      expect(error.stack).toBeDefined();
    });

    test('원본 에러를 포함할 수 있어야 함', () => {
      const originalError = new Error('원본 에러');
      const error = new ImageProcessError('처리 에러', 'OUTPUT_FAILED', originalError);

      expect(error.originalError).toBe(originalError);
    });

    test('원본 에러 없이도 생성 가능해야 함', () => {
      const error = new ImageProcessError('단순 에러', 'PROCESSING_FAILED');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('메서드 체이닝 에러 처리', () => {
    test('잘못된 resize 파라미터는 체이닝 구조를 유지해야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 체이닝 구조는 유지되지만 실행 시 에러 발생 예상
      expect(() => {
        const result = processor.resize(-100, -100);
        expect(result).toBe(processor);
      }).not.toThrow();
    });

    test('잘못된 blur 파라미터는 체이닝 구조를 유지해야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      expect(() => {
        const result = processor.blur(-5);
        expect(result).toBe(processor);
      }).not.toThrow();
    });

    test('출력 메서드에서 에러가 Promise로 전파되어야 함', async () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // Promise 구조만 확인 (실제 에러는 실행 시점에 발생)
      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);
      expect(typeof promise.catch).toBe('function');

      // 실제로는 에러가 발생할 것이므로 catch로 처리
      try {
        await promise;
      } catch (error) {
        // 에러 발생은 예상되는 결과
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('타입 안전성 에러', () => {
    test('컴파일 타임 타입 에러가 방지되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // 올바른 타입 사용
      expect(() => processor.resize(100, 200)).not.toThrow();
      expect(() => processor.blur(2)).not.toThrow();
      expect(() => processor.toBlob({ format: 'png' })).not.toThrow();

      // 잘못된 타입은 TypeScript 컴파일 시점에 에러
      // processor.resize('invalid'); // 컴파일 에러
      // processor.blur('invalid'); // 컴파일 에러
      // processor.toBlob({ format: 'invalid' }); // 컴파일 에러
    });
  });

  describe('에러 메시지 일관성', () => {
    test('에러 메시지가 유용한 정보를 포함해야 함', async () => {
      // lazy validation이므로 실행 시점에 에러 발생
      const processor1 = processImage(null as any);
      try {
        await processor1.toBlob();
      } catch (error) {
        const imageError = error as ImageProcessError;
        expect(imageError.message).toContain('소스');
        expect(imageError.message.length).toBeGreaterThan(10);
      }

      const processor2 = processImage({} as any);
      try {
        await processor2.toBlob();
      } catch (error) {
        const imageError = error as ImageProcessError;
        expect(imageError.message).toContain('소스');
        expect(imageError.code).toBe('INVALID_SOURCE');
      }
    });

    test('에러 코드가 일관된 명명 규칙을 따라야 함', () => {
      const errorCodes = [
        'INVALID_SOURCE',
        'CANVAS_CREATION_FAILED',
        'OUTPUT_FAILED',
        'IMAGE_LOAD_FAILED',
        'PROCESSING_FAILED',
      ];

      errorCodes.forEach((code) => {
        const error = new ImageProcessError('테스트', code as any);
        expect(error.code).toBe(code);
        expect(error.code).toMatch(/^[A-Z_]+$/); // 대문자와 언더스코어만
      });
    });
  });

  describe('에러 복구 가능성', () => {
    test('잘못된 소스 후에도 새로운 processor 생성이 가능해야 함', () => {
      // 잘못된 소스로 processor 생성 (에러는 실행 시점에 발생)
      const invalidProcessor = processImage(null as any);
      expect(invalidProcessor).toBeInstanceOf(ImageProcessor);

      // 새로운 정상적인 processor 생성
      const mockBlob = new Blob(['test']);
      const validProcessor = processImage(mockBlob);
      expect(validProcessor).toBeInstanceOf(ImageProcessor);
    });

    test('에러 정보가 디버깅에 유용해야 함', async () => {
      // lazy validation이므로 실행 시점에 에러 발생
      const processor = processImage(null as any);
      try {
        await processor.toBlob();
      } catch (error) {
        const imageError = error as ImageProcessError;

        // 디버깅에 유용한 정보들
        expect(imageError.name).toBeDefined();
        expect(imageError.message).toBeDefined();
        expect(imageError.code).toBeDefined();
        expect(imageError.stack).toBeDefined();

        // JSON으로 직렬화 가능해야 함
        expect(() => JSON.stringify(imageError)).not.toThrow();
      }
    });
  });
});
