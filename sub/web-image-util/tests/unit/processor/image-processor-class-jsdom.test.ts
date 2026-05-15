/**
 * ImageProcessor 클래스를 `new` 로 직접 인스턴스화하는 경로가 processImage() 팩토리와
 * 동일한 행동을 제공하는지 회귀 방지한다.
 *
 * 검증 범위:
 * - 체이닝 표면 (resize/blur/출력 메서드 노출)
 * - 생성자 옵션 반영 (옵션이 출력 경로에 전달됨)
 * - resize() 1회 제약 (런타임 가드)
 * - 출력 도달 (toCanvas, toBlob 정상 반환)
 *
 * 결정 포인트:
 * - defaultQuality: gif/svg 포맷은 OPTIMAL_QUALITY_BY_FORMAT에 없어 getOptimalQuality 내부의
 *   `?? defaultQuality` 분기에 도달한다. toBlob('gif')로 canvas.toBlob에 전달된 quality 값을 검증한다.
 *   png/webp/jpeg 경로로 검증하면 OPTIMAL_QUALITY_BY_FORMAT 고정값을 단정하는 것이 되어
 *   defaultQuality 반영을 검증하지 못한다.
 * - defaultBackground: ProcessorOptions에 정의돼 있고 this.options에 저장되지만,
 *   현재 렌더링 파이프라인(LazyRenderPipeline)에는 전달되지 않는다. 픽셀 단정 없이 관측 가능한
 *   경계인 convertToImageElement 호출 시 options 객체에 포함 여부를 interaction 검증으로 확인한다.
 * - crossOrigin: canvas 소스는 CORS 경로(convertCanvasToElement)를 거치므로 crossOrigin이 실제
 *   로딩에 쓰이지 않는다. 단, options 객체가 convertToImageElement에 올바르게 전달되는지는
 *   interaction 검증으로 확인한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as converter from '../../../src/core/source-converter';
import { ImageProcessor, processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';
import { createTestCanvas } from '../../utils/canvas-helper';

// convertToImageElement 호출 인자를 추적하면서 실제 구현은 그대로 유지한다.
vi.mock('../../../src/core/source-converter', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../../src/core/source-converter')>();
  return {
    ...orig,
    convertToImageElement: vi.fn().mockImplementation(orig.convertToImageElement),
  };
});

describe('ImageProcessor 클래스 직접 인스턴스화 행동', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('직접 인스턴스화와 팩토리 동치', () => {
    it('new ImageProcessor(canvas)가 체이닝 메서드를 노출한다', () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const processor = new ImageProcessor(canvas);

      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
      expect(processor.shortcut).toBeDefined();
    });

    it('new ImageProcessor(canvas)가 모든 출력 메서드를 노출한다', () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const processor = new ImageProcessor(canvas);

      expect(typeof processor.toBlob).toBe('function');
      expect(typeof processor.toDataURL).toBe('function');
      expect(typeof processor.toFile).toBe('function');
      expect(typeof processor.toCanvas).toBe('function');
      expect(typeof processor.toCanvasDetailed).toBe('function');
      expect(typeof processor.toElement).toBe('function');
      expect(typeof processor.toArrayBuffer).toBe('function');
      expect(typeof processor.toUint8Array).toBe('function');
    });

    it('직접 인스턴스와 팩토리 인스턴스가 동일한 메서드 이름을 가진다', () => {
      const canvas = createTestCanvas(400, 300, 'green');

      const directInstance = new ImageProcessor(canvas);
      const factoryInstance = processImage(canvas);

      // 프로토타입 체인에서 함수인 메서드 이름을 추출한다
      const getMethods = (obj: object) => {
        const methods = new Set<string>();
        let proto = Object.getPrototypeOf(obj);
        while (proto && proto !== Object.prototype) {
          for (const key of Object.getOwnPropertyNames(proto)) {
            if (key !== 'constructor' && typeof (obj as Record<string, unknown>)[key] === 'function') {
              methods.add(key);
            }
          }
          proto = Object.getPrototypeOf(proto);
        }
        return Array.from(methods).sort();
      };

      expect(getMethods(directInstance)).toEqual(getMethods(factoryInstance));
    });
  });

  describe('생성자 옵션 반영', () => {
    beforeEach(() => {
      // 테스트 간 spy 호출 기록을 초기화한다
      vi.mocked(converter.convertToImageElement).mockClear();
    });

    it('옵션 없이 생성하면 기본값으로 처리가 완료된다', async () => {
      const canvas = createTestCanvas(400, 300, 'green');
      const result = await new ImageProcessor(canvas).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('defaultQuality 옵션이 gif 출력 경로의 quality 값으로 사용된다', async () => {
      // gif는 OPTIMAL_QUALITY_BY_FORMAT에 없으므로 getOptimalQuality 내부의
      // `?? defaultQuality` 분기에 도달하여 생성자 옵션이 실제로 사용된다.
      // gif는 OutputFormat 타입 밖이지만 런타임에는 처리되므로 타입 캐스팅으로 분기를 실행한다.
      const canvas = createTestCanvas(400, 300, 'green');
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const resized = new ImageProcessor(canvas, { defaultQuality: 0.5 }).resize({
        fit: 'cover',
        width: 200,
        height: 200,
      });

      await (resized.toBlob as (format: string) => Promise<unknown>)('gif');

      expect(toBlobSpy).toHaveBeenCalled();
      const qualityArg = toBlobSpy.mock.calls[0]?.[2];
      expect(qualityArg).toBe(0.5);
    });

    it('defaultQuality 미설정 시 gif 출력에 기본값 0.8이 사용된다', async () => {
      // 기본값(0.8)과 커스텀값(0.5)의 대조 케이스
      const canvas = createTestCanvas(400, 300, 'green');
      const toBlobSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
      const resized = new ImageProcessor(canvas).resize({ fit: 'cover', width: 200, height: 200 });

      await (resized.toBlob as (format: string) => Promise<unknown>)('gif');

      expect(toBlobSpy).toHaveBeenCalled();
      const qualityArg = toBlobSpy.mock.calls[0]?.[2];
      expect(qualityArg).toBe(0.8);
    });

    it('defaultBackground 옵션이 convertToImageElement 호출에 전달된다', async () => {
      // defaultBackground는 this.options에 저장되며 convertToImageElement 호출 시 options로 전달된다.
      // 현재 렌더링 파이프라인이 이 값을 소비하지 않으므로 forwarding 경계까지만 검증한다.
      const canvas = createTestCanvas(400, 300, 'green');
      const bg = { r: 255, g: 255, b: 255, alpha: 1 };

      await new ImageProcessor(canvas, { defaultBackground: bg })
        .resize({ fit: 'contain', width: 200, height: 200 })
        .toBlob();

      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledWith(
        canvas,
        expect.objectContaining({ defaultBackground: bg })
      );
    });

    it('crossOrigin 옵션이 convertToImageElement 호출에 전달된다', async () => {
      // canvas 소스는 CORS 경로를 거치지 않지만, 옵션 객체가 올바르게 forward되는지 검증한다.
      const canvas = createTestCanvas(400, 300, 'green');

      await new ImageProcessor(canvas, { crossOrigin: 'use-credentials' })
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toBlob();

      expect(vi.mocked(converter.convertToImageElement)).toHaveBeenCalledWith(
        canvas,
        expect.objectContaining({ crossOrigin: 'use-credentials' })
      );
    });
  });

  describe('resize() 1회 제약 (직접 인스턴스)', () => {
    it('두 번째 resize() 호출은 MULTIPLE_RESIZE_NOT_ALLOWED 코드로 거부한다', () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const processor = new ImageProcessor(canvas);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'cover', width: 100, height: 100 });
        expect.fail('두 번째 resize()는 에러를 던져야 한다');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
        }
      }
    });

    it('두 번째 resize()는 출력 메서드 호출 전에 즉시 throw한다', () => {
      const canvas = createTestCanvas(400, 300, 'red');
      const processor = new ImageProcessor(canvas);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      expect(() => {
        processor.resize({ fit: 'fill', width: 150, height: 150 });
      }).toThrow(ImageProcessError);
    });

    it('직접 인스턴스와 팩토리가 동일한 에러 코드를 던진다', () => {
      const canvas1 = createTestCanvas(400, 300, 'red');
      const canvas2 = createTestCanvas(400, 300, 'red');

      const directInstance = new ImageProcessor(canvas1);
      const factoryInstance = processImage(canvas2);

      directInstance.resize({ fit: 'cover', width: 200, height: 200 });
      factoryInstance.resize({ fit: 'cover', width: 200, height: 200 });

      let directCode: string | undefined;
      let factoryCode: string | undefined;

      try {
        directInstance.resize({ fit: 'cover', width: 100, height: 100 });
      } catch (error) {
        if (error instanceof ImageProcessError) {
          directCode = error.code;
        }
      }

      try {
        factoryInstance.resize({ fit: 'cover', width: 100, height: 100 });
      } catch (error) {
        if (error instanceof ImageProcessError) {
          factoryCode = error.code;
        }
      }

      expect(directCode).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
      expect(directCode).toBe(factoryCode);
    });

    it('별도 인스턴스는 각자 독립적으로 resize할 수 있다', async () => {
      const canvas1 = createTestCanvas(400, 300, 'blue');
      const canvas2 = createTestCanvas(400, 300, 'blue');

      const [result1, result2] = await Promise.all([
        new ImageProcessor(canvas1).resize({ fit: 'cover', width: 200, height: 200 }).toBlob(),
        new ImageProcessor(canvas2).resize({ fit: 'cover', width: 100, height: 100 }).toBlob(),
      ]);

      expect(result1.width).toBe(200);
      expect(result2.width).toBe(100);
    });
  });

  describe('출력 메서드 도달 검증', () => {
    it('resize().toCanvas()가 HTMLCanvasElement와 치수 메타데이터를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');

      const result = await new ImageProcessor(canvas).resize({ fit: 'cover', width: 100, height: 100 }).toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(typeof result.processingTime).toBe('number');
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.originalSize).toEqual({ width: 400, height: 300 });
    });

    it('resize().toBlob()이 Blob과 치수 메타데이터를 반환한다', async () => {
      const canvas = createTestCanvas(400, 300, 'blue');

      const result = await new ImageProcessor(canvas).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
    });

    it('blur().resize().toBlob() 체인이 정상 동작한다', async () => {
      const canvas = createTestCanvas(400, 300, 'purple');

      const result = await new ImageProcessor(canvas)
        .blur(2)
        .resize({ fit: 'contain', width: 200, height: 200 })
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('resize().blur().toCanvas() 체인이 정상 동작한다', async () => {
      const canvas = createTestCanvas(400, 300, 'orange');

      const result = await new ImageProcessor(canvas)
        .resize({ fit: 'cover', width: 150, height: 150 })
        .blur(3)
        .toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(150);
      expect(result.height).toBe(150);
    });
  });
});
