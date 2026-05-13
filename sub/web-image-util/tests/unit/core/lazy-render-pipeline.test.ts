/**
 * LazyRenderPipeline 검증 중 출력 메서드(toCanvas / toBlob)를 실제로 호출하는 케이스만 happy-dom에 남긴다.
 *
 * 출력 메서드는 내부적으로 drawImage(src 없이 naturalWidth만 설정한 Image)를 호출하므로
 * jsdom + canvas 패키지에서 거부된다. 출력 없이 누적/체이닝/가드만 검증하는 케이스는
 * `lazy-render-pipeline-jsdom.test.ts`로 분리했다.
 */

import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline';

function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

describe('LazyRenderPipeline (출력 메서드 실행 경로)', () => {
  let mockImage: HTMLImageElement;
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    mockImage = createMockImage(800, 600);
    pipeline = new LazyRenderPipeline(mockImage);
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

  describe('toBlob() Canvas Release', () => {
    it('블롭 변환 콜백 내부에서 예외가 발생해도 canvas를 pool에 반환한다', async () => {
      const { CanvasPool } = await import('../../../src/base/canvas-pool');
      const pool = CanvasPool.getInstance();
      const releaseSpy = vi.spyOn(pool, 'release');
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        throw new Error('debug log failed');
      });

      try {
        const img = createMockImage(100, 100);
        const pipeline = new LazyRenderPipeline(img);

        await expect(pipeline.toBlob()).rejects.toThrow();
        expect(releaseSpy).toHaveBeenCalledTimes(1);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        logSpy.mockRestore();
        releaseSpy.mockRestore();
      }
    });

    it('canvas.toBlob 호출 자체가 예외를 던져도 canvas를 pool에 반환한다', async () => {
      const { CanvasPool } = await import('../../../src/base/canvas-pool');
      const pool = CanvasPool.getInstance();
      const releaseSpy = vi.spyOn(pool, 'release');
      const canvasPrototype = Object.getPrototypeOf(document.createElement('canvas')) as HTMLCanvasElement;
      const toBlobSpy = vi.spyOn(canvasPrototype, 'toBlob').mockImplementation(() => {
        throw new DOMException('canvas is not origin-clean', 'SecurityError');
      });

      try {
        const img = createMockImage(100, 100);
        const pipeline = new LazyRenderPipeline(img);

        await expect(pipeline.toBlob()).rejects.toMatchObject({ name: 'SecurityError' });
        expect(releaseSpy).toHaveBeenCalledTimes(1);
      } finally {
        toBlobSpy.mockRestore();
        releaseSpy.mockRestore();
      }
    });
  });
});

describe('Single Rendering Concept Validation', () => {
  it('should work properly even with complex operation pipeline', () => {
    const mockImage = createMockImage(1000, 800);
    const pipeline = new LazyRenderPipeline(mockImage);

    const result = pipeline
      .addResize({ fit: 'cover', width: 500, height: 400 })
      .addBlur({ radius: 2 })
      .addBlur({ radius: 1 })
      .addFilter({ brightness: 1.2 })
      .addFilter({ contrast: 1.1 })
      .toCanvas();

    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.metadata.operations).toBe(5);
    expect(result.metadata.width).toBe(500);
    expect(result.metadata.height).toBe(400);
  });
});
