/**
 * TypeScript 타입 추론 통합 테스트
 * 컴파일 타임 타입 안전성 및 런타임 타입 일관성 검증
 */

// @vitest-environment browser
import { describe, it, expect, beforeEach } from 'vitest';
import { processImage, ImageProcessor } from '../../../src/index';
import type {
  ImageSource,
  ImageFormat,
  ResizeFit,
  ResizePosition,
  BackgroundColor,
  BlobResult,
  DataURLResult,
  FileResult
} from '../../../src/types';
import {
  createMockProcessor,
  setupSuccessfulCanvasMocking,
  setupSuccessfulImageLoading,
  waitForImageLoad,
  TEST_SOURCES,
  expectType
} from '../../helpers/integration-helpers';

describe('TypeScript 타입 추론 통합 테스트', () => {
  beforeEach(() => {
    setupSuccessfulCanvasMocking();
    setupSuccessfulImageLoading();
  });

  describe('팩토리 함수 타입 추론', () => {
    it('processImage 반환 타입이 ImageProcessor로 추론', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);

      // TypeScript 컴파일러 레벨 타입 검증
      expectType<ImageProcessor>(processor);

      // 런타임 검증
      expect(processor).toBeInstanceOf(ImageProcessor);
      expect(processor.constructor.name).toBe('ImageProcessor');
    });

    it('다양한 소스 타입으로 동일한 반환 타입', () => {
      const processorFromUrl = processImage(TEST_SOURCES.HTTP_URL);
      const processorFromBlob = processImage(TEST_SOURCES.BLOB);
      const processorFromSvg = processImage(TEST_SOURCES.SVG_STRING);

      // 모두 동일한 타입으로 추론되어야 함
      expectType<ImageProcessor>(processorFromUrl);
      expectType<ImageProcessor>(processorFromBlob);
      expectType<ImageProcessor>(processorFromSvg);

      // 런타임에서도 동일한 클래스 인스턴스
      expect(processorFromUrl).toBeInstanceOf(ImageProcessor);
      expect(processorFromBlob).toBeInstanceOf(ImageProcessor);
      expect(processorFromSvg).toBeInstanceOf(ImageProcessor);
    });

    it('옵션 타입이 올바르게 추론됨', () => {
      // 옵션 없이 호출
      const processor1 = processImage(TEST_SOURCES.HTTP_URL);
      expectType<ImageProcessor>(processor1);

      // 옵션과 함께 호출
      const processor2 = processImage(TEST_SOURCES.HTTP_URL, {
        crossOrigin: 'anonymous',
        defaultQuality: 0.8,
        defaultBackground: 'white'
      });
      expectType<ImageProcessor>(processor2);

      expect(processor1).toBeInstanceOf(ImageProcessor);
      expect(processor2).toBeInstanceOf(ImageProcessor);
    });
  });

  describe('체이닝 메서드 타입 추론', () => {
    let processor: ImageProcessor;

    beforeEach(() => {
      processor = createMockProcessor();
    });

    it('resize 메서드가 ImageProcessor 반환', () => {
      const result1 = processor.resize(100, 100);
      const result2 = processor.resize(200, 200, { fit: 'cover' });
      const result3 = processor.resize(undefined, 300);

      expectType<ImageProcessor>(result1);
      expectType<ImageProcessor>(result2);
      expectType<ImageProcessor>(result3);

      expect(result1).toBe(processor);
      expect(result2).toBe(processor);
      expect(result3).toBe(processor);
    });

    it('blur 메서드가 ImageProcessor 반환', () => {
      const result1 = processor.blur();
      const result2 = processor.blur(5);
      const result3 = processor.blur(3, { precision: 0.8 });

      expectType<ImageProcessor>(result1);
      expectType<ImageProcessor>(result2);
      expectType<ImageProcessor>(result3);

      expect(result1).toBe(processor);
      expect(result2).toBe(processor);
      expect(result3).toBe(processor);
    });

    it('atMost 계열 메서드가 ImageProcessor 반환', () => {
      const result1 = processor.atMostWidth(100);
      const result2 = processor.atMostHeight(200);
      const result3 = processor.atMostRect(100, 200);

      expectType<ImageProcessor>(result1);
      expectType<ImageProcessor>(result2);
      expectType<ImageProcessor>(result3);

      expect(result1).toBe(processor);
      expect(result2).toBe(processor);
      expect(result3).toBe(processor);
    });

    it('체이닝된 메서드들이 연속해서 ImageProcessor 반환', () => {
      const result = processor
        .resize(100, 100)
        .blur(2)
        .atMostWidth(200);

      expectType<ImageProcessor>(result);
      expect(result).toBe(processor);
    });
  });

  describe('최종 출력 메서드 타입 추론', () => {
    let processor: ImageProcessor;

    beforeEach(async () => {
      processor = createMockProcessor();
      await waitForImageLoad();
    });

    it('toBlob이 Promise<Blob> 반환', () => {
      const result1 = processor.toBlob();
      const result2 = processor.toBlob({ format: 'png' });
      const result3 = processor.toBlob('webp');

      expectType<Promise<Blob>>(result1);
      expectType<Promise<Blob>>(result2);
      expectType<Promise<Blob>>(result3);

      expect(result1).toBeInstanceOf(Promise);
      expect(result2).toBeInstanceOf(Promise);
      expect(result3).toBeInstanceOf(Promise);
    });

    it('toDataURL이 Promise<string> 반환', () => {
      const result1 = processor.toDataURL();
      const result2 = processor.toDataURL({ format: 'jpeg' });
      const result3 = processor.toDataURL('png');

      expectType<Promise<string>>(result1);
      expectType<Promise<string>>(result2);
      expectType<Promise<string>>(result3);

      expect(result1).toBeInstanceOf(Promise);
      expect(result2).toBeInstanceOf(Promise);
      expect(result3).toBeInstanceOf(Promise);
    });

    it('toFile이 Promise<File> 반환', () => {
      const result1 = processor.toFile('test.jpg');
      const result2 = processor.toFile('test.png', { format: 'png' });
      const result3 = processor.toFile('test', 'webp');

      expectType<Promise<File>>(result1);
      expectType<Promise<File>>(result2);
      expectType<Promise<File>>(result3);

      expect(result1).toBeInstanceOf(Promise);
      expect(result2).toBeInstanceOf(Promise);
      expect(result3).toBeInstanceOf(Promise);
    });

    it('toCanvas가 Promise<HTMLCanvasElement> 반환', () => {
      const result = processor.toCanvas();

      expectType<Promise<HTMLCanvasElement>>(result);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('유니온 타입 처리', () => {
    it('ImageSource 유니온 타입 narrowing', () => {
      // 다양한 ImageSource 타입들
      const sources: ImageSource[] = [
        TEST_SOURCES.HTTP_URL,
        TEST_SOURCES.HTTPS_URL,
        TEST_SOURCES.DATA_URL,
        TEST_SOURCES.SVG_STRING,
        TEST_SOURCES.BLOB
      ];

      sources.forEach((source, index) => {
        const processor = processImage(source);
        expectType<ImageProcessor>(processor);
        expect(processor, `소스 ${index} 처리 실패`).toBeInstanceOf(ImageProcessor);
      });
    });

    it('ResizeFit 유니온 타입 처리', () => {
      const processor = createMockProcessor();
      const fitModes: ResizeFit[] = ['cover', 'pad', 'stretch', 'atMost', 'atLeast'];

      fitModes.forEach(fit => {
        expect(() => {
          processor.resize(100, 100, { fit });
        }, `fit: ${fit} 처리 실패`).not.toThrow();
      });
    });

    it('ResizePosition 유니온 타입 처리', () => {
      const processor = createMockProcessor();

      // 문자열 위치
      const stringPositions: ResizePosition[] = ['center', 'top', 'bottom', 'left', 'right'];
      stringPositions.forEach(position => {
        expect(() => {
          processor.resize(100, 100, { position });
        }, `position: ${position} 처리 실패`).not.toThrow();
      });

      // 숫자 위치
      const numericPosition: ResizePosition = 50;
      expect(() => {
        processor.resize(100, 100, { position: numericPosition });
      }).not.toThrow();

      // 객체 위치
      const objectPosition: ResizePosition = { x: 25, y: 75 };
      expect(() => {
        processor.resize(100, 100, { position: objectPosition });
      }).not.toThrow();
    });

    it('BackgroundColor 유니온 타입 처리', () => {
      const processor = createMockProcessor();

      // 문자열 색상
      const stringColor: BackgroundColor = '#ffffff';
      expect(() => {
        processor.resize(100, 100, { background: stringColor });
      }).not.toThrow();

      // 객체 색상
      const objectColor: BackgroundColor = { r: 255, g: 0, b: 0, alpha: 0.5 };
      expect(() => {
        processor.resize(100, 100, { background: objectColor });
      }).not.toThrow();
    });

    it('ImageFormat 유니온 타입 처리', () => {
      const processor = createMockProcessor();
      const formats: ImageFormat[] = ['jpeg', 'png', 'webp', 'avif', 'gif'];

      formats.forEach(format => {
        expect(() => {
          processor.toBlob(format);
        }, `format: ${format} 처리 실패`).not.toThrow();
      });
    });
  });

  describe('옵셔널 프로퍼티 타입 처리', () => {
    it('부분적 ResizeOptions 허용', () => {
      const processor = createMockProcessor();

      // 각 옵션을 개별적으로 제공
      expect(() => {
        processor.resize(100, 100, { fit: 'cover' });
      }).not.toThrow();

      expect(() => {
        processor.resize(100, 100, { position: 'top' });
      }).not.toThrow();

      expect(() => {
        processor.resize(100, 100, { background: 'white' });
      }).not.toThrow();

      expect(() => {
        processor.resize(100, 100, { withoutEnlargement: true });
      }).not.toThrow();
    });

    it('빈 옵션 객체 허용', () => {
      const processor = createMockProcessor();

      expect(() => {
        processor.resize(100, 100, {});
      }).not.toThrow();

      expect(() => {
        processor.blur(5, {});
      }).not.toThrow();
    });

    it('undefined 옵션 프로퍼티 허용', () => {
      const processor = createMockProcessor();

      expect(() => {
        processor.resize(100, 100, {
          fit: 'cover',
          position: undefined, // undefined는 무시됨
          background: 'white'
        });
      }).not.toThrow();
    });
  });

  describe('제네릭 타입 처리', () => {
    it('Promise 제네릭 타입이 올바르게 추론', async () => {
      const processor = createMockProcessor();
      await waitForImageLoad();

      // Promise<Blob>
      const blobPromise = processor.toBlob();
      expectType<Promise<Blob>>(blobPromise);
      const blob = await blobPromise;
      expectType<Blob>(blob);

      // Promise<string>
      const dataUrlPromise = processor.toDataURL();
      expectType<Promise<string>>(dataUrlPromise);
      const dataUrl = await dataUrlPromise;
      expectType<string>(dataUrl);

      // Promise<File>
      const filePromise = processor.toFile('test.jpg');
      expectType<Promise<File>>(filePromise);
      const file = await filePromise;
      expectType<File>(file);
    });
  });

  describe('타입 호환성', () => {
    it('체이닝 결과가 원본과 호환', () => {
      const processor: ImageProcessor = createMockProcessor();

      // 체이닝 결과도 동일한 타입
      const chained: ImageProcessor = processor
        .resize(100, 100)
        .blur(2);

      expect(chained).toBe(processor);
      expectType<ImageProcessor>(chained);
    });

    it('다양한 메서드 시그니처가 모두 호환', () => {
      const processor = createMockProcessor();

      // 다양한 방식으로 호출 가능
      expectType<ImageProcessor>(processor.resize(100));
      expectType<ImageProcessor>(processor.resize(100, 200));
      expectType<ImageProcessor>(processor.resize(100, 200, {}));
      expectType<ImageProcessor>(processor.resize(100, 200, { fit: 'cover' }));

      expectType<Promise<Blob>>(processor.toBlob());
      expectType<Promise<Blob>>(processor.toBlob({}));
      expectType<Promise<Blob>>(processor.toBlob('png'));
      expectType<Promise<Blob>>(processor.toBlob({ format: 'jpeg' }));
    });
  });
});