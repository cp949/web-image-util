import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';
import { ImageProcessError } from '../../src/types';
import type { ScaleOperation } from '../../src/types/shortcut-types';

describe('Shortcut API Type Safety', () => {
  const testImageUrl = 'test.jpg';

  describe('Return Type Validation', () => {
    // Vitest best practice: organize repetitive type validation with describe.each
    describe.each([
      {
        operation: 'Direct Mapping (coverBox)',
        factory: (url: string) => processImage(url).shortcut.coverBox(300, 200),
      },
      {
        operation: 'Direct Mapping (containBox)',
        factory: (url: string) => processImage(url).shortcut.containBox(300, 200),
      },
      {
        operation: 'Lazy Operation (scale)',
        factory: (url: string) => processImage(url).shortcut.scale(1.5),
      },
      {
        operation: 'Lazy Operation (exactWidth)',
        factory: (url: string) => processImage(url).shortcut.exactWidth(300),
      },
    ])('$operation', ({ factory }) => {
      it('should have all output methods', () => {
        const processor = factory(testImageUrl);

        expect(typeof processor.toBlob, 'toBlob should be a function').toBe('function');
        expect(typeof processor.toDataURL, 'toDataURL should be a function').toBe('function');
        expect(typeof processor.toCanvas, 'toCanvas should be a function').toBe('function');
        expect(typeof processor.toFile, 'toFile should be a function').toBe('function');
      });

      it('should have chainable processing methods', () => {
        const processor = factory(testImageUrl);

        expect(typeof processor.blur, 'blur should be a function').toBe('function');
        expect(() => {
          processor.resize({ fit: 'cover', width: 100, height: 100 });
        }, 'resize should reject duplicate resize operations').toThrow(ImageProcessError);
      });

      it('should maintain type safety through chaining', () => {
        const processor = factory(testImageUrl);
        const chained = processor.blur(2);

        expect(typeof chained.toBlob, 'chained processor should have toBlob').toBe('function');
        expect(typeof chained.toDataURL, 'chained processor should have toDataURL').toBe('function');
      });
    });
  });

  describe('ScaleOperation Type System', () => {
    // Vitest best practice: clearly test Discriminated Union type validation for each case
    describe.each([
      {
        type: 'uniform number scale',
        value: 2 as ScaleOperation,
        description: 'should accept number for uniform scaling',
      },
      {
        type: 'horizontal scale only',
        value: { sx: 2 } as ScaleOperation,
        description: 'should accept { sx } for horizontal scaling',
      },
      {
        type: 'vertical scale only',
        value: { sy: 1.5 } as ScaleOperation,
        description: 'should accept { sy } for vertical scaling',
      },
      {
        type: 'both scales',
        value: { sx: 2, sy: 1.5 } as ScaleOperation,
        description: 'should accept { sx, sy } for independent scaling',
      },
    ])('$type: $description', ({ value, type }) => {
      it('should be valid at compile time', () => {
        // Type validation: TypeScript compiler should accept this code
        const scaleValue: ScaleOperation = value;
        expect(scaleValue, `${type} should be a valid ScaleOperation`).toBeDefined();
      });

      it('should not throw at runtime when used', () => {
        // Runtime validation: should work without errors when actually used
        expect(() => {
          processImage(testImageUrl).shortcut.scale(value);
        }, `${type} should work without throwing`).not.toThrow();
      });

      it('should return a valid processor', () => {
        const processor = processImage(testImageUrl).shortcut.scale(value);
        expect(processor, `${type} should return a valid processor`).toBeDefined();
        expect(typeof processor.toBlob).toBe('function');
      });
    });
  });

  it('should support options for containBox method', () => {
    // Verify that all options can be passed to containBox
    const processor = processImage(testImageUrl).shortcut.containBox(300, 200, {
      padding: { top: 10, bottom: 10, left: 10, right: 10 },
      background: '#ffffff',
      withoutEnlargement: true,
    });

    expect(processor).toBeDefined();
  });

  it('should reject removed trimEmpty option for containBox at type level', () => {
    // @ts-expect-error trimEmpty는 containBox 옵션에서 제거됐다.
    const processor = processImage(testImageUrl).shortcut.containBox(300, 200, { trimEmpty: true });

    expect(processor).toBeDefined();
  });

  it('should support options for coverBox method', () => {
    const processor = processImage(testImageUrl).shortcut.coverBox(300, 200, {
      padding: { top: 5, bottom: 5, left: 5, right: 5 },
      background: '#000000',
    });

    expect(processor).toBeDefined();
  });

  it('should support exactSize method without options', () => {
    const processor = processImage(testImageUrl).shortcut.exactSize(300, 200);

    expect(processor).toBeDefined();
  });

  describe('Type Guards for ScaleOperation', () => {
    it('should recognize uniform scale (number)', () => {
      const scale: ScaleOperation = 2;
      expect(typeof scale).toBe('number');
    });

    it('should recognize scale with sx only', () => {
      const scale: ScaleOperation = { sx: 2 };
      expect(scale).toHaveProperty('sx');
      expect(scale).not.toHaveProperty('sy');
    });

    it('should recognize scale with sy only', () => {
      const scale: ScaleOperation = { sy: 1.5 };
      expect(scale).toHaveProperty('sy');
      expect(scale).not.toHaveProperty('sx');
    });

    it('should recognize scale with both sx and sy', () => {
      const scale: ScaleOperation = { sx: 2, sy: 1.5 };
      expect(scale).toHaveProperty('sx');
      expect(scale).toHaveProperty('sy');
    });
  });

  describe('Method Chaining Type Safety', () => {
    it('should maintain type safety through chaining', () => {
      const processor = processImage(testImageUrl).shortcut.coverBox(300, 200).blur(2);

      expect(typeof processor.toBlob).toBe('function');
      expect(typeof processor.toDataURL).toBe('function');
      expect(typeof processor.toCanvas).toBe('function');
    });

    it('should maintain type safety with lazy operations', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1.5).blur(3);

      expect(typeof processor.toBlob).toBe('function');
      expect(typeof processor.toDataURL).toBe('function');
    });

    it('should reject resize() after shortcut resize at type level', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1.5);

      if (false) {
        // @ts-expect-error resize()는 Shortcut resize 이후 다시 호출할 수 없다.
        processor.resize({ fit: 'cover', width: 100, height: 100 });
      }

      expect(processor).toBeDefined();
    });

    it('should reject shortcut resize after direct resize at type level', () => {
      const processor = processImage(testImageUrl).resize({ fit: 'cover', width: 100, height: 100 });

      if (false) {
        // @ts-expect-error Shortcut resize도 일반 resize 이후 다시 호출할 수 없다.
        processor.shortcut.exactWidth(50);
      }

      expect(processor).toBeDefined();
    });
  });

  describe('Duplicate Resize Runtime Safety', () => {
    it('should reject a direct resize after a lazy shortcut resize', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1.5);

      expect(() => {
        processor.resize({ fit: 'cover', width: 100, height: 100 });
      }).toThrow(ImageProcessError);
    });

    it('should reject a lazy shortcut resize after a direct resize', () => {
      const processor = processImage(testImageUrl).resize({ fit: 'cover', width: 100, height: 100 });

      expect(() => {
        processor.shortcut.exactWidth(50);
      }).toThrow(ImageProcessError);
    });

    it('should reject multiple lazy shortcut resize calls', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1.5);

      expect(() => {
        processor.shortcut.exactWidth(50);
      }).toThrow(ImageProcessError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle scale value of 1 (no scaling)', () => {
      const processor = processImage(testImageUrl).shortcut.scale(1);
      expect(processor).toBeDefined();
    });

    it('should handle scale less than 1 (downscaling)', () => {
      const processor = processImage(testImageUrl).shortcut.scale(0.5);
      expect(processor).toBeDefined();
    });

    it('should handle scale greater than 1 (upscaling)', () => {
      const processor = processImage(testImageUrl).shortcut.scale(2);
      expect(processor).toBeDefined();
    });

    it('should handle zero dimensions gracefully', () => {
      // This case may actually throw an error, but the type system allows it
      const processor = processImage(testImageUrl).shortcut.exactWidth(0);
      expect(processor).toBeDefined();
    });
  });
});
