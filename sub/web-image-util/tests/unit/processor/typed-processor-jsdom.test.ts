/**
 * Type-safe processor 검증 중 jsdom에서 안전한 케이스만 모은다.
 *
 * 분리 기준:
 * - 타입 시스템(compile-time) 검증: 출력 메서드를 호출하지 않으므로 jsdom 가능.
 * - resize() 가드 검증: resize() 두 번 호출이 즉시 throw하므로 Blob 로드까지 가지 않음. jsdom 가능.
 * - Data URL 입력 + 출력: jsdom + canvas로 통과.
 *
 * Blob 입력 + `.toBlob()` 호출까지 가는 케이스는 `typed-processor.test.ts`(happy-dom)에 있다.
 */

import { describe, expect, it } from 'vitest';
import type { SvgSanitizerMode } from '../../../src';
import { createFilterPlugin, FilterCategory } from '../../../src/advanced-index';
import { AllFilterPlugins, BrightnessFilterPlugin } from '../../../src/filters/plugins';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';
import type { ProcessorFactory } from '../../../src/types/typed-processor';
import { createTestImageBlob } from '../../utils';

describe('Type-safe processor tests (jsdom-safe)', () => {
  const testImageUrl = 'test.jpg';

  describe('Type system validation', () => {
    it('processImage() should return InitialProcessor type', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      expect(processor).toBeDefined();

      const resized = processor.resize({ fit: 'cover', width: 200, height: 200 });
      expect(resized).toBeDefined();
    });

    it('should convert to ResizedProcessor type after resize() call', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');

      const initial = processImage(testBlob);
      const resized = initial.resize({ fit: 'cover', width: 200, height: 200 });
      const blurred = resized.blur(2);

      expect(blurred).toBeDefined();
    });

    it('blur() should be callable regardless of state', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');

      const beforeResize = processImage(testBlob).blur(2);
      const afterBlur1 = beforeResize.resize({ fit: 'cover', width: 200, height: 200 });
      const afterBlur2 = afterBlur1.blur(5);

      expect(afterBlur2).toBeDefined();
    });

    it('출력 메서드는 지원 포맷과 옵션만 허용한다', () => {
      const assertOutputTypes = (processor: ReturnType<typeof processImage>) => {
        processor.toBlob('webp');
        processor.toBlob({ format: 'jpeg', quality: 0.8, fallbackFormat: 'png' });
        processor.toDataURL('png');
        processor.toDataURL({ format: 'avif' });
        processor.toFile('thumbnail.webp', 'webp');
        processor.toFile('thumbnail.webp', { format: 'webp', quality: 0.75 });

        // @ts-expect-error File 변환은 파일명을 반드시 받아야 한다.
        processor.toFile();
        // @ts-expect-error File 변환 파일명은 undefined가 될 수 없다.
        processor.toFile(undefined);
        // @ts-expect-error 출력 포맷은 Canvas가 지원하는 형식으로 제한한다.
        processor.toBlob('gif');
        // @ts-expect-error format 옵션도 OutputFormat만 허용한다.
        processor.toDataURL({ format: 'svg' });
        // @ts-expect-error quality는 숫자만 허용한다.
        processor.toFile('thumbnail.webp', { format: 'webp', quality: 'high' });
      };

      expect(assertOutputTypes).toBeDefined();
    });

    it('ProcessorFactory는 ImageSource만 입력으로 허용한다', () => {
      const assertFactoryTypes = (factory: ProcessorFactory) => {
        factory(testImageUrl);

        // @ts-expect-error 공개 팩토리 타입은 임의 객체를 이미지 소스로 받지 않는다.
        factory({ src: testImageUrl });
        // @ts-expect-error 숫자는 이미지 소스가 아니다.
        factory(123);
        // @ts-expect-error boolean은 이미지 소스가 아니다.
        factory(true);
      };

      expect(assertFactoryTypes).toBeDefined();
    });

    it('기본 필터 모음은 공개 API에서 파라미터 전달을 허용한다', () => {
      const assertDefaultFilterCollectionTypes = () => {
        const [plugin] = AllFilterPlugins;

        plugin.apply({} as ImageData, { value: 10 });
        plugin.validate({ value: 10 });
      };

      expect(assertDefaultFilterCollectionTypes).toBeDefined();
    });

    it('개별 기본 필터 export는 정밀한 파라미터 타입을 보존한다', () => {
      const assertIndividualPluginTypes = () => {
        BrightnessFilterPlugin.apply({} as ImageData, { value: 10 });
        BrightnessFilterPlugin.validate({ value: 10 });

        // @ts-expect-error brightness 필터 파라미터는 value만 허용한다.
        BrightnessFilterPlugin.apply({} as ImageData, { radius: 10 });
      };

      expect(assertIndividualPluginTypes).toBeDefined();
    });

    it('svgSanitizer 옵션은 세 가지 유효 모드만 허용하고 SvgSanitizerMode 타입을 root에서 import할 수 있다', () => {
      const assertSvgSanitizerModeTypes = () => {
        processImage('<svg></svg>', { svgSanitizer: 'lightweight' });
        processImage('<svg></svg>', { svgSanitizer: 'strict' });
        processImage('<svg></svg>', { svgSanitizer: 'skip' });

        const strictMode: SvgSanitizerMode = 'strict';
        processImage('<svg></svg>', { svgSanitizer: strictMode });

        // @ts-expect-error 유효하지 않은 SVG sanitizer 모드
        processImage('<svg></svg>', { svgSanitizer: 'safe' });
      };

      expect(assertSvgSanitizerModeTypes).toBeDefined();
    });

    it('createFilterPlugin은 필터 분류와 검증 결과 타입을 제한한다', () => {
      const assertCreateFilterPluginTypes = () => {
        createFilterPlugin({
          name: 'custom-brightness',
          description: 'Custom brightness filter',
          category: FilterCategory.COLOR,
          defaultParams: { value: 0 },
          apply: (imageData: ImageData, params: { value: number }) => {
            expect(params.value).toEqual(expect.any(Number));
            return imageData;
          },
          validate: () => ({ valid: true }),
        });

        createFilterPlugin({
          name: 'invalid-category',
          description: 'Invalid category filter',
          // @ts-expect-error 필터 분류는 FilterCategory 값만 허용한다.
          category: 'unknown',
          defaultParams: { value: 0 },
          apply: (imageData: ImageData) => imageData,
          validate: () => ({ valid: true }),
        });

        createFilterPlugin({
          name: 'invalid-validation-result',
          description: 'Invalid validation result filter',
          category: FilterCategory.CUSTOM,
          defaultParams: { value: 0 },
          apply: (imageData: ImageData) => imageData,
          // @ts-expect-error validate는 FilterValidationResult 형태를 반환해야 한다.
          validate: () => true,
        });
      };

      expect(assertCreateFilterPluginTypes).toBeDefined();
    });
  });

  describe('Runtime behavior validation', () => {
    it('should validate normal chaining behavior', async () => {
      // Use simple Data URL to prevent timeout from Canvas mock
      const testDataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

      const result = await processImage(testDataUrl)
        .blur(1)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(2)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should throw runtime error on duplicate resize() calls', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'orange');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      expect(() => {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
      }).toThrow(ImageProcessError);
    });

    it('두 번째 resize() 호출은 MULTIPLE_RESIZE_NOT_ALLOWED 코드로 거부한다', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'cyan');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('Error should be thrown');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
        }
      }
    });
  });

  describe('Error code consistency validation', () => {
    it('should use MULTIPLE_RESIZE_NOT_ALLOWED error code', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'gray');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('Error should be thrown');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.code).not.toBe('MULTIPLE_RESIZE_ERROR');
        }
      }
    });
  });
});
