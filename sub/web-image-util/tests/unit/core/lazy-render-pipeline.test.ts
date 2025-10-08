import { ImageProcessError } from '../../../src/types';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';

// Create mock image for testing
function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  // naturalWidth/Height are read-only, so use Object.defineProperty
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

describe('LazyRenderPipeline', () => {
  let mockImage: HTMLImageElement;
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    mockImage = createMockImage(800, 600);
    pipeline = new LazyRenderPipeline(mockImage);
  });

  describe('Basic Functionality', () => {
    it('should be able to create LazyRenderPipeline instance', () => {
      expect(pipeline).toBeInstanceOf(LazyRenderPipeline);
      expect(pipeline.getOperationCount()).toBe(0);
    });

    it('should be able to accumulate operations', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });
      pipeline.addBlur({ radius: 2 });

      expect(pipeline.getOperationCount()).toBe(2);

      const operations = pipeline.getOperations();
      expect(operations).toHaveLength(2);
      expect(operations[0].type).toBe('resize');
      expect(operations[1].type).toBe('blur');
    });
  });

  describe('Single resize() Call Constraint', () => {
    it('should succeed when calling resize() once', () => {
      expect(() => {
        pipeline.addResize({ fit: 'cover', width: 300, height: 200 });
      }).not.toThrow();
    });

    it('should throw error when calling resize() twice', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      expect(() => {
        pipeline.addResize({ fit: 'contain', width: 150, height: 150 });
      }).toThrow(ImageProcessError);

      expect(() => {
        pipeline.addResize({ fit: 'contain', width: 150, height: 150 });
      }).toThrow(/resize\(\) can only be called once/);
    });

    it('should allow multiple blur() calls', () => {
      expect(() => {
        pipeline.addBlur({ radius: 2 });
        pipeline.addBlur({ radius: 5 });
        pipeline.addBlur({ radius: 1 });
      }).not.toThrow();

      expect(pipeline.getOperationCount()).toBe(3);
    });
  });

  describe('Chaining API', () => {
    it('should support method chaining', () => {
      const result = pipeline
        .addResize({ fit: 'cover', width: 300, height: 200 })
        .addBlur({ radius: 2 })
        .addFilter({ brightness: 1.2 });

      expect(result).toBe(pipeline);
      expect(pipeline.getOperationCount()).toBe(3);
    });
  });

  describe('Lazy Rendering Concept', () => {
    it('should perform rendering when toCanvas() is called after adding operations', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      // Actual rendering is performed when toCanvas() is called
      const result = pipeline.toCanvas();

      expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.operations).toBe(1);
    });
  });

  describe('Metadata', () => {
    it('should return metadata with processing result', () => {
      pipeline.addResize({ fit: 'cover', width: 300, height: 200 });

      const result = pipeline.toCanvas();

      expect(result.metadata).toEqual({
        width: 300,
        height: 200,
        format: 'canvas',
        size: expect.any(Number),
        processingTime: expect.any(Number),
        operations: 1,
      });
    });

    it('should record metadata correctly after multiple operations', () => {
      pipeline
        .addResize({ fit: 'contain', width: 400, height: 300 })
        .addBlur({ radius: 3 })
        .addFilter({ brightness: 1.1 });

      const result = pipeline.toCanvas();

      expect(result.metadata.operations).toBe(3);
      expect(result.metadata.width).toBe(400);
      expect(result.metadata.height).toBe(300);
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate error for invalid resize configuration', () => {
      const mockImage = createMockImage(100, 100);
      const invalidPipeline = new LazyRenderPipeline(mockImage);

      // LazyRenderPipeline uses lazy execution, so addResize doesn't throw error
      // Instead, error should be thrown when toCanvas() is called
      expect(() => {
        // @ts-expect-error Invalid type for testing
        invalidPipeline.addResize({ fit: 'invalid', width: -100 });
        invalidPipeline.toCanvas(); // Error occurs during actual rendering
      }).toThrow();
    });
  });
});

describe('Single Rendering Concept Validation', () => {
  it('should work properly even with complex operation pipeline', () => {
    const mockImage = createMockImage(1000, 800);
    const pipeline = new LazyRenderPipeline(mockImage);

    // Complex operation chaining
    const result = pipeline
      .addResize({ fit: 'cover', width: 500, height: 400 })
      .addBlur({ radius: 2 })
      .addBlur({ radius: 1 })
      .addFilter({ brightness: 1.2 })
      .addFilter({ contrast: 1.1 })
      .toCanvas();

    // Verify result is generated correctly
    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.metadata.operations).toBe(5);
    expect(result.metadata.width).toBe(500);
    expect(result.metadata.height).toBe(400);
  });
});
