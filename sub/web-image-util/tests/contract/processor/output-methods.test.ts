import { beforeEach, describe, expect, test } from 'vitest';
import { processImage } from '../../../src/processor';
import type { OutputFormat, OutputOptions } from '../../../src/types';

describe('출력 메서드 계약', () => {
  let processor: ReturnType<typeof processImage>;

  beforeEach(() => {
    const mockBlob = new Blob(['test'], { type: 'image/png' });
    processor = processImage(mockBlob);
  });

  describe('toBlob 메서드', () => {
    test('옵션 없이 호출 가능해야 함', () => {
      const promise = processor.toBlob();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('OutputOptions로 호출 가능해야 함', () => {
      const options: OutputOptions = { format: 'png', quality: 0.8 };
      const promise = processor.toBlob(options);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('OutputFormat 문자열로 호출 가능해야 함', () => {
      const promise = processor.toBlob('jpeg');
      expect(promise).toBeInstanceOf(Promise);
    });

    test('모든 출력 포맷이 허용되어야 함', () => {
      const formats: OutputFormat[] = ['png', 'jpeg', 'jpg', 'webp', 'avif'];

      formats.forEach((format) => {
        expect(() => processor.toBlob(format)).not.toThrow();
        expect(() => processor.toBlob({ format })).not.toThrow();
      });
    });

    test('품질 옵션이 올바르게 처리되어야 함', () => {
      expect(() => processor.toBlob({ quality: 0.5 })).not.toThrow();
      expect(() => processor.toBlob({ quality: 1.0 })).not.toThrow();
      expect(() => processor.toBlob({ quality: 0.0 })).not.toThrow();
    });
  });

  describe('toDataURL 메서드', () => {
    test('기본 시그니처가 작동해야 함', () => {
      const promise = processor.toDataURL();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('OutputOptions로 호출 가능해야 함', () => {
      const options: OutputOptions = { format: 'webp', quality: 0.7 };
      const promise = processor.toDataURL(options);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('OutputFormat 문자열로 호출 가능해야 함', () => {
      const promise = processor.toDataURL('png');
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('toFile 메서드', () => {
    test('파일명만으로 호출 가능해야 함', () => {
      const promise = processor.toFile('image.png');
      expect(promise).toBeInstanceOf(Promise);
    });

    test('파일명과 옵션으로 호출 가능해야 함', () => {
      const options: OutputOptions = { format: 'jpeg', quality: 0.9 };
      const promise = processor.toFile('image.jpg', options);
      expect(promise).toBeInstanceOf(Promise);
    });

    test('파일명과 포맷 문자열로 호출 가능해야 함', () => {
      const promise = processor.toFile('image.png', 'webp');
      expect(promise).toBeInstanceOf(Promise);
    });

    test('다양한 확장자가 허용되어야 함', () => {
      const filenames = ['image.png', 'photo.jpg', 'picture.jpeg', 'graphic.webp', 'avatar.avif', 'file'];

      filenames.forEach((filename) => {
        expect(() => processor.toFile(filename)).not.toThrow();
      });
    });

    test('빈 파일명도 Promise를 반환해야 함 (실행 시점 검증)', () => {
      const promise = processor.toFile('');
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('toCanvas 메서드', () => {
    test('파라미터 없이 호출 가능해야 함', () => {
      const promise = processor.toCanvas();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('toCanvasDetailed와 동일한 시그니처를 가져야 함', () => {
      const promise1 = processor.toCanvas();
      const promise2 = processor.toCanvasDetailed();

      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
    });
  });

  describe('추가 출력 메서드들', () => {
    test('toElement 메서드가 작동해야 함', () => {
      const promise = processor.toElement();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('toArrayBuffer 메서드가 작동해야 함', () => {
      const promise = processor.toArrayBuffer();
      expect(promise).toBeInstanceOf(Promise);
    });

    test('toUint8Array 메서드가 작동해야 함', () => {
      const promise = processor.toUint8Array();
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('반환 타입 검증', () => {
    test('모든 출력 메서드가 Promise를 반환해야 함', () => {
      const promises = [
        processor.toBlob(),
        processor.toDataURL(),
        processor.toFile('test.png'),
        processor.toCanvas(),
        processor.toElement(),
        processor.toArrayBuffer(),
        processor.toUint8Array(),
        processor.toCanvasDetailed(),
      ];

      promises.forEach((promise) => {
        expect(promise).toBeInstanceOf(Promise);
        expect(typeof promise.then).toBe('function');
        expect(typeof promise.catch).toBe('function');
      });
    });

    test('체이닝이 출력 메서드에서 종료되어야 함', () => {
      const promise = processor.resize(100, 100).blur(2).toBlob();

      expect(promise).toBeInstanceOf(Promise);
      expect(typeof (promise as any).resize).toBe('undefined');
      expect(typeof (promise as any).blur).toBe('undefined');
    });
  });

  describe('옵션 검증', () => {
    test('fallbackFormat 옵션이 처리되어야 함', () => {
      const options: OutputOptions = {
        format: 'webp',
        fallbackFormat: 'png',
      };

      expect(() => processor.toBlob(options)).not.toThrow();
    });

    test('잘못된 품질 값도 허용되어야 함 (실행 시 보정)', () => {
      expect(() => processor.toBlob({ quality: -1 })).not.toThrow();
      expect(() => processor.toBlob({ quality: 2 })).not.toThrow();
      expect(() => processor.toBlob({ quality: NaN })).not.toThrow();
    });

    test('지원하지 않는 포맷도 허용되어야 함 (실행 시 fallback)', () => {
      // 타입 시스템에서는 제한하지만 런타임에서는 fallback 처리
      expect(() => processor.toBlob({ format: 'gif' as any })).not.toThrow();
    });
  });

  describe('에러 처리 계약', () => {
    test('모든 출력 메서드가 에러를 Promise로 전파해야 함', () => {
      // 실제 에러는 실행 시점에 발생하므로 Promise 구조만 확인
      const promises = [processor.toBlob(), processor.toDataURL(), processor.toFile('test.png'), processor.toCanvas()];

      promises.forEach((promise) => {
        expect(typeof promise.catch).toBe('function');
      });
    });
  });
});
