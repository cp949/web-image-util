/**
 * Type-Safe Processor Simple Test
 *
 * @description Simple test focused on TypeScript type system validation
 * Verifies type-level behavior only, without Canvas creation.
 */

import { describe, it, expect } from 'vitest';
import { processImage } from '../../../src/processor';
import { ImageProcessError } from '../../../src/types';

describe('Type-Safe Processor Simple Test', () => {
  // Create simple test blob (without Canvas)
  const createSimpleBlob = () => {
    return new Blob(['test'], { type: 'image/png' });
  };

  describe('Basic Type System Validation', () => {
    it('processImage() should return correct type', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // Basic type validation
      expect(processor).toBeDefined();
      expect(typeof processor.resize).toBe('function');
      expect(typeof processor.blur).toBe('function');
    });

    it('resize() method should be chainable', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // Verify resize() method exists
      expect(typeof processor.resize).toBe('function');

      // Verify other methods are available after resize() call
      const resized = processor.resize({ fit: 'cover', width: 200, height: 200 });
      expect(typeof resized.blur).toBe('function');
      expect(typeof resized.toBlob).toBe('function');
    });

    it('blur() method should be available regardless of state', () => {
      const testBlob = createSimpleBlob();

      // blur() can be called before resize()
      const beforeResize = processImage(testBlob);
      expect(typeof beforeResize.blur).toBe('function');

      // blur() can be called after resize()
      const afterResize = beforeResize.resize({ fit: 'cover', width: 200, height: 200 });
      expect(typeof afterResize.blur).toBe('function');
    });
  });

  describe('Runtime Error Validation (without Canvas)', () => {
    it('should throw error on duplicate resize() call', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      // First resize() call
      processor.resize({ fit: 'cover', width: 200, height: 200 });

      // Second resize() call should throw error
      expect(() => {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
      }).toThrow(ImageProcessError);
    });

    it('should verify error message and code are correct', () => {
      const testBlob = createSimpleBlob();
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
        }
      }
    });

    it('separate instances should work independently', () => {
      const testBlob = createSimpleBlob();

      // Create separate instances
      const processor1 = processImage(testBlob);
      const processor2 = processImage(testBlob);

      // Each can call resize() independently (no error)
      expect(() => {
        processor1.resize({ fit: 'cover', width: 150, height: 150 });
        processor2.resize({ fit: 'contain', width: 300, height: 200 });
      }).not.toThrow();
    });
  });

  describe('Method Chaining Validation', () => {
    it('should allow various chaining orders', () => {
      const testBlob = createSimpleBlob();

      // blur() → resize() order
      expect(() => {
        const processor1 = processImage(testBlob)
          .blur(1)
          .resize({ fit: 'cover', width: 200, height: 200 });
        expect(processor1).toBeDefined();
      }).not.toThrow();

      // resize() → blur() order
      expect(() => {
        const processor2 = processImage(testBlob)
          .resize({ fit: 'maxFit', width: 300 })
          .blur(2);
        expect(processor2).toBeDefined();
      }).not.toThrow();

      // Multiple blur() calls
      expect(() => {
        const processor3 = processImage(testBlob)
          .blur(1)
          .blur(2)
          .resize({ fit: 'cover', width: 200, height: 200 })
          .blur(1);
        expect(processor3).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Error Code Consistency Validation', () => {
    it('should use correct error code', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('Error should be thrown');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          // Verify correct error code
          expect(error.code).toBe('MULTIPLE_RESIZE_NOT_ALLOWED');

          // Verify legacy error code is not used
          expect(error.code).not.toBe('MULTIPLE_RESIZE_ERROR');
        }
      }
    });

    it('should include helpful suggestions', () => {
      const testBlob = createSimpleBlob();
      const processor = processImage(testBlob);

      processor.resize({ fit: 'cover', width: 200, height: 200 });

      try {
        processor.resize({ fit: 'contain', width: 300, height: 300 });
        expect.fail('Error should be thrown');
      } catch (error) {
        if (error instanceof ImageProcessError) {
          const suggestionsText = error.suggestions.join(' ');

          // Verify practical suggestions are included
          expect(suggestionsText).toContain('Include all resizing options in a single resize() call');
          expect(suggestionsText).toContain('Create separate processImage() instances');
          expect(suggestionsText).toContain('processImage(source).resize');
        }
      }
    });
  });
});