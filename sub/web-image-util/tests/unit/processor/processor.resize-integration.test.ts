import { describe, it, expect } from 'vitest';
import { processImage } from '../../../src/processor';
import { createTestImageBlob } from '../../utils/image-helper';
import type { ResizeConfig } from '../../../src/types/resize-config';
import { ImageProcessError } from '../../../src/types';

describe('Processor Resize Integration Tests', () => {
  describe('new resize API with all fit modes', () => {
    it('should support cover fit mode', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should support contain fit mode', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const result = await processImage(testBlob).resize({ fit: 'contain', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should support fill fit mode', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');
      const result = await processImage(testBlob).resize({ fit: 'fill', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should support maxFit mode with width only', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'yellow');
      const result = await processImage(testBlob).resize({ fit: 'maxFit', width: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should support maxFit mode with height only', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'purple');
      const result = await processImage(testBlob).resize({ fit: 'maxFit', height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should support minFit mode with width only', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'orange');
      const result = await processImage(testBlob).resize({ fit: 'minFit', width: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toMatch(/^image\//);
    });

    it('should process all fit modes in parallel', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'cyan');

      // 모든 fit 모드 동시 실행
      const results = await Promise.all([
        processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob(),
        processImage(testBlob).resize({ fit: 'contain', width: 200, height: 200 }).toBlob(),
        processImage(testBlob).resize({ fit: 'fill', width: 200, height: 200 }).toBlob(),
        processImage(testBlob).resize({ fit: 'maxFit', width: 200 }).toBlob(),
        processImage(testBlob).resize({ fit: 'minFit', width: 200 }).toBlob(),
      ]);

      results.forEach((result) => {
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.blob.type).toMatch(/^image\//);
      });
    });
  });

  describe('contain mode with trimEmpty option', () => {
    it('should handle trimEmpty option', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'red');

      const withoutTrim = await processImage(testBlob).resize({ fit: 'contain', width: 200, height: 400 }).toCanvas();

      const withTrim = await processImage(testBlob)
        .resize({ fit: 'contain', width: 200, height: 400, trimEmpty: true })
        .toCanvas();

      // trimEmpty 적용 시 크기가 다를 수 있음
      expect(withTrim.width).toBeLessThanOrEqual(withoutTrim.width);
      expect(withTrim.height).toBeLessThanOrEqual(withoutTrim.height);
    });

    it('should trim with custom background color', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'blue');

      const result = await processImage(testBlob)
        .resize({
          fit: 'contain',
          width: 200,
          height: 400,
          trimEmpty: true,
          background: 'white',
        })
        .toCanvas();

      // 트림 후에도 캔버스 생성 성공
      expect(result).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });
  });

  describe('contain mode with withoutEnlargement option', () => {
    it('should not upscale small images with withoutEnlargement', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'green');

      const result = await processImage(testBlob)
        .resize({
          fit: 'contain',
          width: 400,
          height: 400,
          withoutEnlargement: true,
        })
        .toCanvas();

      // 확대하지 않음
      expect(result.width).toBeLessThanOrEqual(400);
      expect(result.height).toBeLessThanOrEqual(400);
    });
  });

  describe('padding and background options', () => {
    it('should apply padding to all fit modes', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'red');

      const configs: ResizeConfig[] = [
        { fit: 'cover', width: 100, height: 100, padding: 10 },
        { fit: 'contain', width: 100, height: 100, padding: 10 },
        { fit: 'fill', width: 100, height: 100, padding: 10 },
        { fit: 'maxFit', width: 100, padding: 10 },
        { fit: 'minFit', width: 200, padding: 10 },
      ];

      for (const config of configs) {
        const result = await processImage(testBlob).resize(config).toCanvas();
        expect(result.width).toBeGreaterThan(100); // 패딩 포함
        expect(result.height).toBeGreaterThan(100);
      }
    });

    it('should apply background color with padding', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'yellow');

      const result = await processImage(testBlob)
        .resize({
          fit: 'cover',
          width: 100,
          height: 100,
          padding: 20,
          background: 'blue',
        })
        .toCanvas();

      expect(result.width).toBe(140); // 100 + 20*2
      expect(result.height).toBe(140);
    });
  });

  describe('runtime config validation', () => {
    it('should throw error for invalid maxFit config (no width/height)', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');

      await expect(async () => {
        await processImage(testBlob)
          .resize({ fit: 'maxFit' } as any)
          .toBlob();
      }).rejects.toThrow(ImageProcessError);
    });

    it('should throw error for invalid minFit config (no width/height)', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');

      await expect(async () => {
        await processImage(testBlob)
          .resize({ fit: 'minFit' } as any)
          .toBlob();
      }).rejects.toThrow(ImageProcessError);
    });

    it('should throw error for cover config without width', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');

      await expect(async () => {
        await processImage(testBlob)
          .resize({ fit: 'cover', height: 200 } as any)
          .toBlob();
      }).rejects.toThrow('cover requires both width and height');
    });

    it('should throw error for negative padding', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'yellow');

      await expect(async () => {
        await processImage(testBlob)
          .resize({ fit: 'cover', width: 200, height: 200, padding: -10 } as any)
          .toBlob();
      }).rejects.toThrow('padding must be non-negative');
    });
  });

  describe('output formats', () => {
    it('should output to Blob', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should output to Canvas', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

      expect(result).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should output to Data URL', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toDataURL();

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^data:image\//);
    });
  });

  describe('chaining multiple operations', () => {
    it('should chain resize with blur', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'purple');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should resize to final size directly', async () => {
      // ✅ 올바른 방법: 최종 크기를 직접 지정
      const testBlob = await createTestImageBlob(800, 600, 'orange');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toCanvas();

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('edge cases', () => {
    it('should handle very small images', async () => {
      const testBlob = await createTestImageBlob(10, 10, 'teal');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should handle very large target dimensions', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'navy');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 2000, height: 2000 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should handle extreme aspect ratios', async () => {
      const testBlob = await createTestImageBlob(1000, 100, 'maroon');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 100, height: 1000 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  describe('multiple resize prevention (Phase 4)', () => {
    it('should allow single resize operation', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should throw error on multiple resize calls', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      // 첫 번째 resize는 성공
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // 두 번째 resize는 에러 발생
      expect(() => {
        processor.resize({ fit: 'cover', width: 100, height: 100 });
      }).toThrow(ImageProcessError);
    });

    it('should provide helpful error message with suggestions', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'cover', width: 100, height: 100 });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(ImageProcessError);
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('resize()는 한 번만 호출할 수 있습니다');
          expect(error.suggestions).toBeInstanceOf(Array);
          expect(error.suggestions.length).toBeGreaterThan(0);
          expect(error.suggestions[0]).toContain('최종 크기를 직접 지정');
        }
      }
    });

    it('should allow separate processors to resize independently', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');

      // 각각 별도의 프로세서 인스턴스 생성
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // 각각 독립적으로 resize 가능
      const result1 = await processor1.resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
      const result2 = await processor2.resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

      expect(result1.width).toBe(200);
      expect(result2.width).toBe(100);
    });

    it('should still allow blur after resize', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      // resize 후 blur는 허용되어야 함
      const result = await processor.resize({ fit: 'cover', width: 200, height: 200 }).blur(5).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should provide error code for programmatic handling', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'cover', width: 100, height: 100 });
        expect.fail('Should have thrown error');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          // 에러 코드로 프로그래밍적 처리 가능
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // 제안 사항이 실제로 도움이 되는지 확인
          const hasSeparateInstance = error.suggestions.some((s) => s.includes('별도'));
          const hasDirectSize = error.suggestions.some((s) => s.includes('직접 지정'));
          expect(hasSeparateInstance || hasDirectSize).toBe(true);
        }
      }
    });
  });
});
