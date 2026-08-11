/**
 * LazyRenderPipeline 검증 중 jsdom에서 안전한 케이스만 모은다.
 *
 * 분리 기준:
 * - operation 누적 / resize 1회 가드 / 체이닝 / addResize 단계에서 즉시 throw하는 경로는
 *   실제 렌더링까지 가지 않으므로 jsdom 가능.
 * - render() 같은 실제 출력 메서드는 내부에서 drawImage(src 없는 Image)를
 *   호출해 jsdom에서 실패하므로 browser 테스트에서 대표 실제 로딩 경로를 검증한다.
 *   단, single-renderer를 모킹해 pending resize 변환·오류 경계·CanvasLease 반환 정책을
 *   jsdom 환경에서 단위 검증한다.
 */

import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import type { FinalLayout } from '../../../src/core/lazy-render-pipeline.internal';
import { LazyRenderPipeline } from '../../../src/core/lazy-render-pipeline.internal';
import * as singleRenderer from '../../../src/core/single-renderer.internal';
import { ImageProcessError } from '../../../src/types';

vi.mock('../../../src/core/single-renderer.internal', () => ({
  renderAllOperationsOnce: vi.fn(),
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
    let errorCanvas: HTMLCanvasElement;

    beforeEach(() => {
      errorCanvas = createTestCanvas(100, 100);
      // 렌더러가 잘못된 config를 받으면 INVALID_DIMENSIONS를 던지는 상황을 시뮬레이션.
      // 기본 vi.fn()이 undefined를 반환해 TypeError로 통과하던 문제를 차단한다.
      vi.mocked(singleRenderer.renderAllOperationsOnce).mockImplementation(() => {
        throw new ImageProcessError('잘못된 resize 설정', 'INVALID_DIMENSIONS');
      });
      vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
      vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should throw appropriate error for invalid resize configuration', () => {
      const img = createMockImage(100, 100);
      const p = new LazyRenderPipeline(img);

      // LazyRenderPipeline은 lazy 실행이라 addResize에서 던지지 않고
      // render() 시점에 렌더러가 invalid config를 거부해 throw한다.
      expect(() => {
        // @ts-expect-error Invalid type for testing
        p.addResize({ fit: 'invalid', width: -100 });
        p.render();
      }).toThrow(expect.objectContaining({ code: 'INVALID_DIMENSIONS' }));
    });
  });
});

describe('LazyRenderPipeline — _addResizeOperation pending resize 변환', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderAllOperationsOnce).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scale pending resize는 출력 직전 변환되어 operation 수와 metadata에 반영된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: 0.5 });
    // 출력 이전: operations 배열에 아직 추가되지 않음
    expect(p.getOperationCount()).toBe(0);

    const { metadata } = p.render();

    // 렌더러 호출 시점에 변환된 resize op이 args에 포함됨을 검증 (출력 직전 변환 계약)
    expect(vi.mocked(singleRenderer.renderAllOperationsOnce)).toHaveBeenCalledWith(
      img,
      expect.arrayContaining([
        expect.objectContaining({ type: 'resize', config: { fit: 'fill', width: 400, height: 300 } }),
      ]),
      fixedLayout
    );

    // 출력 이후: pending이 ResizeConfig로 변환되어 1개 추가됨
    expect(p.getOperationCount()).toBe(1);
    expect(metadata.operations).toBe(1);
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 400, height: 300 },
    });
  });

  it('toWidth pending resize는 비율 유지 ResizeConfig로 변환된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'toWidth', width: 400 });
    // 출력 이전: 0
    expect(p.getOperationCount()).toBe(0);

    const { metadata } = p.render();

    // 렌더러 호출 시점에 변환된 resize op이 args에 포함됨을 검증
    expect(vi.mocked(singleRenderer.renderAllOperationsOnce)).toHaveBeenCalledWith(
      img,
      expect.arrayContaining([
        expect.objectContaining({ type: 'resize', config: { fit: 'fill', width: 400, height: 300 } }),
      ]),
      fixedLayout
    );

    expect(metadata.operations).toBe(1);
    // 높이 = round(400 * (600/800)) = 300
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 400, height: 300 },
    });
  });

  it('toHeight pending resize는 비율 유지 ResizeConfig로 변환된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'toHeight', height: 300 });
    // 출력 이전: 0
    expect(p.getOperationCount()).toBe(0);

    const { metadata } = p.render();

    // 렌더러 호출 시점에 변환된 resize op이 args에 포함됨을 검증
    expect(vi.mocked(singleRenderer.renderAllOperationsOnce)).toHaveBeenCalledWith(
      img,
      expect.arrayContaining([
        expect.objectContaining({ type: 'resize', config: { fit: 'fill', width: 400, height: 300 } }),
      ]),
      fixedLayout
    );

    expect(metadata.operations).toBe(1);
    // 너비 = round(300 * (800/600)) = 400
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 400, height: 300 },
    });
  });

  it('pending resize 후 addResize 재호출 시 MULTIPLE_RESIZE_NOT_ALLOWED가 발생한다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: 0.5 });

    expect(() => {
      p.addResize({ fit: 'cover', width: 300, height: 200 });
    }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
  });

  it('_addResizeOperation 후 _addResizeOperation 재호출 시 MULTIPLE_RESIZE_NOT_ALLOWED가 발생한다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: 0.5 });

    expect(() => {
      p._addResizeOperation({ type: 'toWidth', width: 400 });
    }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
  });

  it('addResize 후 _addResizeOperation 호출 시 MULTIPLE_RESIZE_NOT_ALLOWED가 발생한다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p.addResize({ fit: 'cover', width: 300, height: 200 });

    expect(() => {
      p._addResizeOperation({ type: 'scale', value: 2 });
    }).toThrow(expect.objectContaining({ code: 'MULTIPLE_RESIZE_NOT_ALLOWED' }));
  });

  it('scale pending resize - sx만 지정: sy는 기본값 1이 적용된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: { sx: 2 } });
    p.render();

    // sx=2, sy 미지정 → sy 기본값 1 → width=1600, height=600
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 1600, height: 600 },
    });
  });

  it('scale pending resize - sy만 지정: sx는 기본값 1이 적용된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: { sy: 2 } });
    p.render();

    // sy=2, sx 미지정 → sx 기본값 1 → width=800, height=1200
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 800, height: 1200 },
    });
  });

  it('scale pending resize - sx와 sy 모두 지정: 각 축이 독립적으로 적용된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    p._addResizeOperation({ type: 'scale', value: { sx: 2, sy: 3 } });
    p.render();

    // sx=2, sy=3 → width=1600, height=1800
    expect(p.getOperations()[0]).toMatchObject({
      type: 'resize',
      config: { fit: 'fill', width: 1600, height: 1800 },
    });
  });
});

describe('LazyRenderPipeline — render() lease 계약', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderAllOperationsOnce).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lease.consume은 파생물 생성 후 canvas를 pool로 반환한다', async () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    const { lease } = p.render();
    const width = await lease.consume((canvas) => canvas.width);

    expect(width).toBe(100);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(testCanvas);
  });

  it('lease.detach는 소유권을 이전하고 pool로 반환하지 않는다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    const { lease } = p.render();
    const canvas = lease.detach();

    expect(canvas).toBe(testCanvas);
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  it('layout 분석은 render()당 한 번만 수행된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    vi.mocked(singleRenderer.analyzeAllOperations).mockClear();
    p.render();

    expect(vi.mocked(singleRenderer.analyzeAllOperations)).toHaveBeenCalledTimes(1);
  });
});

describe('LazyRenderPipeline — render() 오류 경계', () => {
  let testCanvas: HTMLCanvasElement;

  beforeEach(() => {
    testCanvas = createTestCanvas(100, 100);
    vi.mocked(singleRenderer.renderAllOperationsOnce).mockReturnValue(new CanvasLease(testCanvas));
    vi.mocked(singleRenderer.analyzeAllOperations).mockReturnValue(fixedLayout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debugLayout이 throw하면 CanvasPool.release 후 오류가 재throw된다', () => {
    const img = createMockImage(800, 600);
    const p = new LazyRenderPipeline(img);

    const debugError = new Error('debugLayout 오류');
    vi.mocked(singleRenderer.debugLayout).mockImplementation(() => {
      throw debugError;
    });
    const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release').mockImplementation(() => {});

    expect(() => p.render()).toThrow(debugError);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledWith(testCanvas);
  });
});
