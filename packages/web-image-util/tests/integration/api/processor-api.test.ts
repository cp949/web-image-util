/**
 * ImageProcessor API 표면적 통합 테스트
 * 브라우저 API 모킹을 통한 공개 API 동작 검증
 */

// @vitest-environment browser
import { describe, it, expect, beforeEach } from 'vitest';
import { processImage, ImageProcessor } from '../../../src/index';
import {
  createMockProcessor,
  setupSuccessfulCanvasMocking,
  setupSuccessfulImageLoading,
  waitForImageLoad,
  waitForCanvasProcessing,
  expectChainableMethod,
  expectPromiseMethod,
  TEST_SOURCES,
  testWithAllSourceTypes
} from '../../helpers/integration-helpers';

describe('ImageProcessor API 통합 테스트', () => {
  beforeEach(() => {
    setupSuccessfulCanvasMocking();
    setupSuccessfulImageLoading();
  });

  describe('생성자 및 팩토리 함수', () => {
    it('processImage가 ImageProcessor 인스턴스를 반환해야 함', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);

      expect(processor).toBeInstanceOf(ImageProcessor);
      expect(processor.resize).toBeInstanceOf(Function);
      expect(processor.toBlob).toBeInstanceOf(Function);
    });

    it('다양한 소스 타입으로 인스턴스 생성 가능', () => {
      testWithAllSourceTypes((source, sourceName) => {
        const processor = processImage(source);
        expect(processor, `${sourceName}로 생성 실패`).toBeInstanceOf(ImageProcessor);
      });
    });

    it('옵션과 함께 생성 가능', () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL, {
        crossOrigin: 'anonymous',
        defaultQuality: 0.9,
        defaultBackground: 'white'
      });

      expect(processor).toBeInstanceOf(ImageProcessor);
    });

    it('무효한 소스는 즉시 에러 발생', () => {
      expect(() => processImage(null as any)).toThrow();
      expect(() => processImage(undefined as any)).toThrow();
      expect(() => processImage(123 as any)).toThrow();
      expect(() => processImage('' as any)).toThrow();
    });
  });

  describe('체이닝 메서드들', () => {
    let processor: ImageProcessor;

    beforeEach(() => {
      processor = createMockProcessor();
    });

    it('resize 메서드가 this를 반환하여 체이닝 가능', () => {
      expectChainableMethod(processor, 'resize', 100, 100);
      expectChainableMethod(processor, 'resize', 200, 200, { fit: 'cover' });
      expectChainableMethod(processor, 'resize', { width: 300, height: 300 });
    });

    it('blur 메서드가 this를 반환하여 체이닝 가능', () => {
      expectChainableMethod(processor, 'blur');
      expectChainableMethod(processor, 'blur', 5);
      expectChainableMethod(processor, 'blur', 3, { precision: 'high' });
    });

    it('atMost 계열 메서드들이 체이닝 가능', () => {
      expectChainableMethod(processor, 'atMostWidth', 100);
      expectChainableMethod(processor, 'atMostHeight', 200);
      expectChainableMethod(processor, 'atMostRect', 100, 200);
    });

    it('atLeast 계열 메서드들이 체이닝 가능', () => {
      expectChainableMethod(processor, 'atLeastWidth', 100);
      expectChainableMethod(processor, 'atLeastHeight', 200);
      expectChainableMethod(processor, 'atLeastRect', 100, 200);
    });

    it('force 계열 메서드들이 체이닝 가능', () => {
      expectChainableMethod(processor, 'forceWidth', 100);
      expectChainableMethod(processor, 'forceHeight', 200);
    });

    it('편의 메서드들이 체이닝 가능', () => {
      expectChainableMethod(processor, 'resizeCover', 100, 100);
      expectChainableMethod(processor, 'resizePad', 100, 100);
      expectChainableMethod(processor, 'stretch', 100, 100);
    });
  });

  describe('복합 체이닝 시나리오', () => {
    let processor: ImageProcessor;

    beforeEach(() => {
      processor = createMockProcessor();
    });

    it('다중 메서드 체이닝이 정상 동작', () => {
      expect(() => {
        processor
          .resize(300, 200)
          .blur(2)
          .atMostWidth(400);
      }).not.toThrow();
    });

    it('복잡한 체이닝 후에도 동일한 인스턴스 유지', () => {
      const result = processor
        .resize(200, 200, { fit: 'cover' })
        .blur(3)
        .atMostRect(500, 500);

      expect(result).toBe(processor);
    });

    it('메서드 순서가 결과에 영향을 주지 않음 (동일 인스턴스)', () => {
      const chain1 = processor
        .resize(100, 100)
        .blur(2);

      const chain2 = processor
        .blur(2)
        .resize(100, 100);

      // 같은 인스턴스를 체이닝하므로 결과 동일
      expect(chain1).toBe(chain2);
      expect(chain1).toBe(processor);
    });
  });

  describe('최종 출력 메서드들', () => {
    let processor: ImageProcessor;

    beforeEach(async () => {
      processor = createMockProcessor();
      await waitForImageLoad();
    });

    it('toBlob이 Promise<Blob>을 반환', async () => {
      const result = await expectPromiseMethod(processor, 'toBlob');
      expect(result).toBeInstanceOf(Blob);
    });

    it('toDataURL이 Promise<string>을 반환', async () => {
      const result = await expectPromiseMethod(processor, 'toDataURL');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^data:image\///);
    });

    it('toFile이 Promise<File>을 반환', async () => {
      const result = await expectPromiseMethod(processor, 'toFile', 'test.jpg');
      expect(result).toBeInstanceOf(File);
      expect(result.name).toBe('test.jpg');
    });

    it('toCanvas가 Promise<HTMLCanvasElement>를 반환', async () => {
      const result = await expectPromiseMethod(processor, 'toCanvas');
      expect(result).toBeInstanceOf(HTMLCanvasElement);
    });
  });

  describe('출력 메서드 오버로딩', () => {
    let processor: ImageProcessor;

    beforeEach(async () => {
      processor = createMockProcessor();
      await waitForImageLoad();
      await waitForCanvasProcessing();
    });

    describe('toBlob 오버로딩', () => {
      it('toBlob() - 기본 옵션', async () => {
        const blob = await processor.toBlob();
        expect(blob).toBeInstanceOf(Blob);
      });

      it('toBlob(options) 호출', async () => {
        const blob = await processor.toBlob({ format: 'png', quality: 0.8 });
        expect(blob).toBeInstanceOf(Blob);
      });

      it('toBlob(format) 호출', async () => {
        const blob = await processor.toBlob('webp');
        expect(blob).toBeInstanceOf(Blob);
      });
    });

    describe('toDataURL 오버로딩', () => {
      it('toDataURL() - 기본 옵션', async () => {
        const dataURL = await processor.toDataURL();
        expect(typeof dataURL).toBe('string');
        expect(dataURL).toMatch(/^data:image\///);
      });

      it('toDataURL(options) 호출', async () => {
        const dataURL = await processor.toDataURL({ format: 'png', quality: 0.9 });
        expect(typeof dataURL).toBe('string');
        expect(dataURL).toMatch(/^data:image\///);
      });

      it('toDataURL(format) 호출', async () => {
        const dataURL = await processor.toDataURL('jpeg');
        expect(typeof dataURL).toBe('string');
        expect(dataURL).toMatch(/^data:image\///);
      });
    });

    describe('toFile 오버로딩', () => {
      it('toFile(filename) 호출', async () => {
        const file = await processor.toFile('test.jpg');
        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('test.jpg');
      });

      it('toFile(filename, options) 호출', async () => {
        const file = await processor.toFile('test.png', {
          format: 'png',
          quality: 0.9,
          autoExtension: true
        });
        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('test.png');
      });

      it('toFile(filename, format) 호출', async () => {
        const file = await processor.toFile('test', 'webp');
        expect(file).toBeInstanceOf(File);
        // autoExtension이 기본으로 true이므로 확장자 자동 추가
        expect(file.name).toBe('test.webp');
      });
    });
  });

  describe('에러 처리', () => {
    it('생성자에서는 소스 타입 검증만 수행', () => {
      // 유효한 소스면 생성자에서는 에러 발생하지 않음
      expect(() => processImage('invalid-url')).not.toThrow();
      expect(() => processImage('http://invalid-domain/image.jpg')).not.toThrow();
    });

    it('체이닝 메서드는 검증 없이 호출 가능', () => {
      const processor = createMockProcessor();

      // 잘못된 값이라도 체이닝 메서드에서는 에러 없음
      expect(() => processor.resize(-100, -100)).not.toThrow();
      expect(() => processor.blur(-5)).not.toThrow();
    });

    it('최종 출력 메서드에서만 실제 처리 및 검증 수행', async () => {
      const processor = createMockProcessor()
        .resize(100, 100)
        .blur(2);

      // 실제 브라우저 환경에서는 정상 처리됨
      const blob = await processor.toBlob();
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('비동기 처리', () => {
    it('이미지 로딩 대기 후 처리', async () => {
      const processor = processImage(TEST_SOURCES.HTTP_URL);

      // 이미지 로딩 완료 대기
      await waitForImageLoad();

      const blob = await processor.resize(100, 100).toBlob();
      expect(blob).toBeInstanceOf(Blob);
    });

    it('Canvas 처리 완료 대기', async () => {
      const processor = createMockProcessor();

      await waitForImageLoad();
      await waitForCanvasProcessing();

      const result = await processor.toCanvas();
      expect(result).toBeDefined();
    });
  });
});