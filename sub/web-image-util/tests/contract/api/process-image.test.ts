import { describe, expect, test } from 'vitest';
import { ImageProcessor, processImage } from '../../../src/processor';
import type { ImageSource, ProcessorOptions } from '../../../src/types';

describe('processImage API 계약', () => {
  describe('팩토리 함수 기본 동작', () => {
    test('ImageProcessor 인스턴스를 반환해야 함', () => {
      const mockBlob = new Blob(['test'], { type: 'image/png' });
      const processor = processImage(mockBlob);

      expect(processor).toBeInstanceOf(ImageProcessor);
      expect(processor).toBeDefined();
    });

    test('옵션 없이도 작동해야 함', () => {
      const mockImage = new Image();
      const processor = processImage(mockImage);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('옵션과 함께 작동해야 함', () => {
      const mockBlob = new Blob(['test']);
      const options: ProcessorOptions = {
        crossOrigin: 'use-credentials',
        defaultQuality: 0.9,
      };

      const processor = processImage(mockBlob, options);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('다양한 소스 타입 지원', () => {
    test('HTMLImageElement를 소스로 받을 수 있어야 함', () => {
      const image = new Image();
      const processor = processImage(image);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('Blob을 소스로 받을 수 있어야 함', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const processor = processImage(blob);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('Data URL 문자열을 소스로 받을 수 있어야 함', () => {
      const dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const processor = processImage(dataUrl);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('HTTP URL 문자열을 소스로 받을 수 있어야 함', () => {
      const url = 'https://example.com/image.jpg';
      const processor = processImage(url);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('SVG 문자열을 소스로 받을 수 있어야 함', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';
      const processor = processImage(svg);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('ArrayBuffer를 소스로 받을 수 있어야 함', () => {
      const buffer = new ArrayBuffer(8);
      const processor = processImage(buffer);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('Uint8Array를 소스로 받을 수 있어야 함', () => {
      const uint8 = new Uint8Array([1, 2, 3, 4]);
      const processor = processImage(uint8);

      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('잘못된 소스 처리', () => {
    test('null 소스도 ImageProcessor를 반환해야 함 (실행 시점 검증)', () => {
      const processor = processImage(null as any);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('undefined 소스도 ImageProcessor를 반환해야 함 (실행 시점 검증)', () => {
      const processor = processImage(undefined as any);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('숫자도 ImageProcessor를 반환해야 함 (실행 시점 검증)', () => {
      const processor = processImage(123 as any);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('빈 객체도 ImageProcessor를 반환해야 함 (실행 시점 검증)', () => {
      const processor = processImage({} as any);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('빈 문자열도 ImageProcessor를 반환해야 함 (실행 시점 검증)', () => {
      const processor = processImage('');
      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('ProcessorOptions 처리', () => {
    test('모든 옵션 속성이 올바르게 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const fullOptions: ProcessorOptions = {
        crossOrigin: 'anonymous',
        defaultQuality: 0.8,
        defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 },
        defaultFormat: 'webp',
        timeout: 30000,
      };

      expect(() => processImage(mockBlob, fullOptions)).not.toThrow();
      const processor = processImage(mockBlob, fullOptions);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    test('부분적인 옵션도 처리되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const partialOptions: Partial<ProcessorOptions> = {
        defaultQuality: 0.9,
      };

      expect(() => processImage(mockBlob, partialOptions)).not.toThrow();
    });

    test('잘못된 옵션 타입도 processor를 반환해야 함 (실행 시점 검증)', () => {
      const mockBlob = new Blob(['test']);
      const invalidOptions = {
        defaultQuality: 'invalid', // 숫자여야 함
      } as any;

      // 생성은 되지만 실행 시점에 문제가 발생할 수 있음
      const processor = processImage(mockBlob, invalidOptions);
      expect(processor).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('타입 안전성', () => {
    test('반환 타입이 올바르게 추론되어야 함', () => {
      const mockBlob = new Blob(['test']);
      const processor = processImage(mockBlob);

      // TypeScript 컴파일 시점에서 검증됨
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
      expect(typeof processor.toBlob).toBe('function');
      expect(typeof processor.toDataURL).toBe('function');
      expect(typeof processor.toFile).toBe('function');
      expect(typeof processor.toCanvas).toBe('function');
    });

    test('소스 타입이 ImageSource와 호환되어야 함', () => {
      // 컴파일 타임 검증을 위한 타입 테스트
      const sources: ImageSource[] = [
        new Image(),
        new Blob(['test']),
        'https://example.com/image.jpg',
        'data:image/png;base64,test',
        '<svg></svg>',
        new ArrayBuffer(8),
        new Uint8Array(8),
      ];

      sources.forEach((source) => {
        expect(() => processImage(source)).not.toThrow();
      });
    });
  });
});
