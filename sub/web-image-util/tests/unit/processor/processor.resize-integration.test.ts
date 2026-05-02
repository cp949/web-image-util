import { describe, expect, it, vi } from 'vitest';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';
import type { ResizeConfig } from '../../../src/types/resize-config';
import { createTestImageBlob } from '../../utils/image-helper';

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

      // Execute all fit modes concurrently
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

  describe('contain mode with withoutEnlargement option', () => {
    it('should keep the requested canvas size with withoutEnlargement', async () => {
      const testBlob = await createTestImageBlob(100, 100, 'green');

      const result = await processImage(testBlob)
        .resize({
          fit: 'contain',
          width: 400,
          height: 400,
          withoutEnlargement: true,
        })
        .toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(400);
      expect(result.height).toBe(400);
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
        expect(result.width).toBeGreaterThan(100); // Including padding
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

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should output to Data URL', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).toDataURL();

      expect(typeof result.dataURL).toBe('string');
      expect(result.dataURL).toMatch(/^data:image\//);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should preserve explicit zero quality for Blob output', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');
      const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
      const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob');

      await processImage(testBlob)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .toBlob({ format: 'jpeg', quality: 0 });

      expect(toBlobSpy).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0);
      toBlobSpy.mockRestore();
    });

    it('should report fallback format when requested Blob format is not created', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');
      const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
      const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(function (
        this: HTMLCanvasElement,
        callback: BlobCallback,
        type?: string,
        quality?: number
      ) {
        if (type === 'image/avif') {
          callback(null);
          return;
        }

        callback(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer], { type: type || 'image/png' }));
      });

      try {
        const result = await processImage(testBlob)
          .resize({ fit: 'cover', width: 200, height: 200 })
          .toBlob({ format: 'avif', fallbackFormat: 'png' });

        expect(toBlobSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 'image/avif', expect.any(Number));
        expect(toBlobSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/png', expect.any(Number));
        expect(result.blob.type).toBe('image/png');
        expect(result.format).toBe('png');
      } finally {
        toBlobSpy.mockRestore();
      }
    });
  });

  describe('chaining multiple operations', () => {
    it('should chain resize with blur', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'purple');
      const result = await processImage(testBlob).resize({ fit: 'cover', width: 200, height: 200 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should resize to final size directly', async () => {
      // ✅ Correct approach: Specify the final size directly
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

      // First resize should succeed
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // Second resize should throw error
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
          expect(error.message).toContain('resize() can only be called once');
          expect(error.suggestions).toBeInstanceOf(Array);
          expect(error.suggestions.length).toBeGreaterThan(0);
          expect(error.suggestions[0]).toContain('Include all resizing options in a single resize() call');
        }
      }
    });

    it('should allow separate processors to resize independently', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');

      // Create separate processor instances
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // Each can resize independently
      const result1 = await processor1.resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
      const result2 = await processor2.resize({ fit: 'cover', width: 100, height: 100 }).toBlob();

      expect(result1.width).toBe(200);
      expect(result2.width).toBe(100);
    });

    it('should still allow blur after resize', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      // Blur should be allowed after resize
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
          // Error code allows programmatic handling
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // Verify suggestions are actually helpful
          const hasSeparateInstance = error.suggestions.some((s) => s.includes('separate'));
          const hasDirectSize = error.suggestions.some((s) => s.includes('directly'));
          expect(hasSeparateInstance || hasDirectSize).toBe(true);
        }
      }
    });
  });
});
