import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';
import type { ScaleOperation } from '../../src/types/shortcut-types';

describe('Shortcut API Type Safety', () => {
  const testImageUrl = 'test.jpg';

  describe('Return Type Validation', () => {
    // Vitest 모범 사례: describe.each로 반복적인 타입 검증을 체계화
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
        operation: 'Lazy Operation (toScale)',
        factory: (url: string) => processImage(url).shortcut.scale(1.5),
      },
      {
        operation: 'Lazy Operation (toWidth)',
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
        expect(typeof processor.resize, 'resize should be a function').toBe('function');
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
    // Vitest 모범 사례: Discriminated Union 타입 검증을 각 케이스별로 명확히 테스트
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
        // 타입 검증: TypeScript 컴파일러가 이 코드를 허용해야 함
        const scaleValue: ScaleOperation = value;
        expect(scaleValue, `${type} should be a valid ScaleOperation`).toBeDefined();
      });

      it('should not throw at runtime when used', () => {
        // 런타임 검증: 실제로 사용 시 오류가 없어야 함
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
    // containBox에 모든 옵션 전달 가능한지 확인
    const processor = processImage(testImageUrl).shortcut.containBox(300, 200, {
      padding: { top: 10, bottom: 10, left: 10, right: 10 },
      background: '#ffffff',
      trimEmpty: true,
      withoutEnlargement: true,
    });

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
      // 이 케이스는 실제로는 에러가 발생할 수 있지만, 타입 시스템은 허용합니다
      const processor = processImage(testImageUrl).shortcut.exactWidth(0);
      expect(processor).toBeDefined();
    });
  });
});
