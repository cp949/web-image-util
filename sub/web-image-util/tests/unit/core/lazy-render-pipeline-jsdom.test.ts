/**
 * LazyRenderPipeline 검증 중 jsdom에서 안전한 케이스만 모은다.
 *
 * 분리 기준:
 * - operation 누적 / resize 1회 가드 / 설정 검증 / 체이닝은
 *   실제 렌더링까지 가지 않으므로 jsdom 가능.
 * - render() 같은 실제 출력 메서드는 내부에서 drawImage(src 없는 Image)를
 *   호출해 jsdom에서 실패하므로 browser 테스트에서 대표 실제 로딩 경로를 검증한다.
 *   단, single-renderer를 모킹해 오류 경계·CanvasLease 반환 정책을
 *   jsdom 환경에서 단위 검증한다.
 */

import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import type { FinalLayout } from '../../../src/core/single-renderer.internal';
import * as singleRenderer from '../../../src/core/single-renderer.internal';
import { ImageProcessError } from '../../../src/types';

vi.mock('../../../src/core/single-renderer.internal', () => ({
  renderLayout: vi.fn(),
  analyzeAllOperations: vi.fn(),
  debugLayout: vi.fn(),
}));

function createMockImage(width = 800, height = 600): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: width, writable: false });
  Object.defineProperty(img, 'naturalHeight', { value: height, writable: false });
  return img;
}

function createTestCanvas(width = 100, height = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const fixedLayout: FinalLayout = {
  width: 100,
  height: 100,
  position: { x: 0, y: 0 },
  imageSize: { width: 100, height: 100 },
  background: 'transparent',
  filters: [],
};

describe('LazyRenderPipeline (jsdom-safe)', () => {
  let pipeline: LazyRenderPipeline;

  beforeEach(() => {
    pipeline = new LazyRenderPipeline();
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
        .addBlur({ radius: 1 });

      expect(result).toBe(pipeline);
      expect(pipeline.getOperationCount()).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('잘못된 resize 설정은 addResize 시점에 INVALID_DIMENSIONS로 즉시 거부한다', () => {
      const p = new LazyRenderPipeline();

      // 검증은 불변식 소유자인 addResize가 렌더 전에 수행한다.
      expect(() => {
        p.addResize({ fit: 'cover', width: -100, height: 100 });
      }).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
    });

    it('검증 실패는 상태를 남기지 않는다 — 이후 정상 addResize가 가능하다', () => {
      const p = new LazyRenderPipeline();

      expect(() => {
        p.addResize({ fit: 'cover', width: -100, height: 100 });
      }).toThrow(ImageProcessError);

      expect(() => {
        p.addResize({ fit: 'cover', width: 100, height: 100 });
      }).not.toThrow();
      expect(p.getOperationCount()).toBe(1);
    });
  });
});

describe('LazyRenderPipeline — 원본 크기 의존 설정(scale·단일 축 fill) 축적', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderLayout).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scale 설정은 즉시 축적되고 render 시 분석기에 그대로 전달된다', () => {
    // 원본 크기 해석은 ResizeCalculator가 담당한다 — 파이프라인은 변환하지 않는다
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();

    p.addResize({ fit: 'scale', scale: 0.5 });
    expect(p.getOperationCount()).toBe(1);

    const { metadata } = p.render(img);

    expect(vi.mocked(singleRenderer.analyzeAllOperations)).toHaveBeenCalledWith(
      img,
      expect.arrayContaining([expect.objectContaining({ type: 'resize', config: { fit: 'scale', scale: 0.5 } })])
    );
    expect(vi.mocked(singleRenderer.renderLayout)).toHaveBeenCalledWith(img, fixedLayout);
    expect(metadata.operations).toBe(1);
  });

  it('단일 축 fill 설정도 동일하게 축적·전달된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();

    p.addResize({ fit: 'fill', width: 400 });
    const { metadata } = p.render(img);

    expect(vi.mocked(singleRenderer.analyzeAllOperations)).toHaveBeenCalledWith(
      img,
      expect.arrayContaining([expect.objectContaining({ type: 'resize', config: { fit: 'fill', width: 400 } })])
    );
    expect(metadata.operations).toBe(1);
  });

  it('scale 설정 후 addResize 재호출 시 MULTIPLE_RESIZE_NOT_ALLOWED가 발생한다', () => {
    const p = new LazyRenderPipeline();

    p.addResize({ fit: 'scale', scale: 0.5 });

    expect(() => {
      p.addResize({ fit: 'cover', width: 300, height: 200 });
    }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
  });

  it('addResize 후 scale 설정 재호출 시 MULTIPLE_RESIZE_NOT_ALLOWED가 발생한다', () => {
    const p = new LazyRenderPipeline();

    p.addResize({ fit: 'cover', width: 300, height: 200 });

    expect(() => {
      p.addResize({ fit: 'scale', scale: 2 });
    }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
  });
});

describe('LazyRenderPipeline — render() lease 계약', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderLayout).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lease.consume은 파생물 생성 후 canvas를 pool로 반환한다', async () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    const { lease } = p.render(img);
    const width = await lease.consume((canvas) => canvas.width);

    expect(width).toBe(100);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(testCanvas);
  });

  it('lease.detach는 소유권을 이전하고 pool로 반환하지 않는다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    const { lease } = p.render(img);
    const canvas = lease.detach();

    expect(canvas).toBe(testCanvas);
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it('render() metadata의 format은 인코딩 전 단계이므로 정의되지 않는다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();

    const { metadata } = p.render(img);

    // 인코딩 포맷은 출력 메서드(toBlob 등)가 결정한다 — 렌더 단계에는 포맷이 없다.
    // ImageFormat union에 없는 'canvas' 같은 값이 타입 우회로 흘러가면 안 된다.
    expect(metadata.format).toBeUndefined();
  });

  it('layout 분석은 render()당 한 번만 수행된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();

    vi.mocked(singleRenderer.analyzeAllOperations).mockClear();
    p.render(img);

    expect(vi.mocked(singleRenderer.analyzeAllOperations)).toHaveBeenCalledTimes(1);
  });
});

describe('LazyRenderPipeline — render() 오류 경계', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderLayout).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debugLayout이 throw하면 CanvasPool.release 후 오류가 재throw된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline();

    const debugError = new Error('debugLayout 오류');
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {
      throw debugError;
    });
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    expect(() => p.render(img)).toThrow(debugError);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(testCanvas);
  });
});
