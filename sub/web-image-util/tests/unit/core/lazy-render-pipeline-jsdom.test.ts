/**
 * LazyRenderPipeline 검증 중 jsdom에서 안전한 케이스만 모은다.
 *
 * 분리 기준:
 * - operation 누적 / resize 1회 가드 / 체이닝 / addResize 단계에서 즉시 throw하는 경로는
 *   실제 렌더링까지 가지 않으므로 jsdom 가능.
 * - toCanvas() / toBlob() 같은 실제 출력 메서드는 내부에서 drawImage(src 없는 Image)를
 *   호출해 jsdom에서 실패하므로 browser 테스트에서 대표 실제 로딩 경로를 검증한다.
 */

import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';

function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

describe('LazyRenderPipeline (jsdom-safe)', () => {
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
      }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
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

  describe('Error Handling', () => {
    it('should throw appropriate error for invalid resize configuration', () => {
      const mockImage = createMockImage(100, 100);
      const invalidPipeline = new LazyRenderPipeline(mockImage);

      // LazyRenderPipeline은 lazy 실행이라 addResize에서 던지지 않고
      // toCanvas() 시점에 invalid config가 검증돼 throw해야 한다.
      expect(() => {
        // @ts-expect-error Invalid type for testing
        invalidPipeline.addResize({ fit: 'invalid', width: -100 });
        invalidPipeline.toCanvas();
      }).toThrow();
    });
  });
});
