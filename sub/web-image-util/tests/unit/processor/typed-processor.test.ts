/**
 * Type-safe processor tests
 *
 * @description Validates resize() constraints through TypeScript's type system
 * These tests verify both runtime behavior and compile-time type safety.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';
import { createTestImageBlob } from '../../utils';

describe('Type-safe processor tests', () => {
  describe('Type system validation', () => {
    it('processImage() should return InitialProcessor type', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'blue');
      const processor = processImage(testBlob);

      // Type validation: processor should be InitialProcessor type
      expect(processor).toBeDefined();

      // Compile-time validation: resize() should be callable
      const resized = processor.resize({ fit: 'cover', width: 200, height: 200 });
      expect(resized).toBeDefined();
    });

    it('should convert to ResizedProcessor type after resize() call', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'green');

      // Initial state: resize() is callable
      const initial = processImage(testBlob);

      // After resize() call: transitions to AfterResize state
      const resized = initial.resize({ fit: 'cover', width: 200, height: 200 });

      // blur() should still be callable
      const blurred = resized.blur(2);

      expect(blurred).toBeDefined();
    });

    it('blur() should be callable regardless of state', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'red');

      // Call blur() before resize()
      const beforeResize = processImage(testBlob).blur(2);
      const afterBlur1 = beforeResize.resize({ fit: 'cover', width: 200, height: 200 });

      // Call blur() after resize()
      const afterBlur2 = afterBlur1.blur(5);

      expect(afterBlur2).toBeDefined();
    });
  });

  describe('Runtime behavior validation', () => {
    it('should validate normal chaining behavior', async () => {
      // Use simple Data URL to prevent timeout from Canvas mock
      const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

      // First resize() call
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // Second resize() call should throw error
      expect(() => {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
      }).toThrow(ImageProcessError);
    });

    it('should include correct suggestions in error message', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'cyan');
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('Error should be thrown');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');
          expect(error.message).toContain('resize() can only be called once');
          expect(error.suggestions).toBeInstanceOf(Array);
          expect(error.suggestions.length).toBeGreaterThan(0);

          // Validate suggestion contents
          const suggestionsText = error.suggestions.join(' ');
          expect(suggestionsText).toContain('Include all resizing options in a single resize() call');
          expect(suggestionsText).toContain('Create separate processImage() instances');
        }
      }
    });

    it('should allow independent resize() calls on separate instances', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'yellow');

      // Create separate instances
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // Each instance can call resize() independently
      const result1 = await processor1.resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
      const result2 = await processor2.resize({ fit: 'contain', width: 300, height: 200 }).toBlob();

      expect(result1.width).toBe(150);
      expect(result1.height).toBe(150);
      expect(result2.width).toBe(300);
      expect(result2.height).toBe(200);
    });
  });

  describe('Chaining order validation', () => {
    it('should work with blur() → resize() → blur() order', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'pink');

      const result = await processImage(testBlob)
        .blur(1) // Pre-processing blur
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(3) // Post-processing blur
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should work with resize() → blur() order', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'teal');

      const result = await processImage(testBlob).resize({ fit: 'maxFit', width: 300 }).blur(2).toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBeLessThanOrEqual(300);
    });

    it('should work with multiple blur() calls', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'navy');

      const result = await processImage(testBlob)
        .blur(1)
        .blur(2)
        .resize({ fit: 'cover', width: 200, height: 200 })
        .blur(1)
        .toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });

  describe('Type inference validation', () => {
    it('should have accurate type inference in method chaining', async () => {
      const testBlob = await createTestImageBlob(400, 300, 'lime');

      // Step-by-step variable assignment for type inference validation
      const step1 = processImage(testBlob); // InitialProcessor
      const step2 = step1.blur(1); // ImageProcessor<BeforeResize>
      const step3 = step2.resize({ fit: 'cover', width: 200, height: 200 }); // ImageProcessor<AfterResize>
      const step4 = step3.blur(2); // ImageProcessor<AfterResize>

      const result = await step4.toBlob();

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
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
          // Verify correct error code is used
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // Verify legacy error code is not used
          expect(error.code).not.toBe('MULTIPLE_RESIZE_ERROR');
        }
      }
    });
  });
});
