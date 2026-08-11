/**
 * single-renderer 단위 테스트
 *
 * analyzeAllOperations (레이아웃 계산),
 * renderAllOperationsOnce (Canvas Pool 활용 및 dimension 매핑) 를 검증한다.
 * 픽셀 비교는 하지 않으며, 구조적 속성(크기, 필터 문자열, Pool 호출)만 확인한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import type { LazyOperation } from '../../../src/core/lazy-render-pipeline.internal';
import { analyzeAllOperations, renderAllOperationsOnce } from '../../../src/core/single-renderer.internal';

// naturalWidth / naturalHeight 를 제어하는 헬퍼
function createMockImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

// drawImage 를 안전하게 수행할 수 있는 소스 캔버스를 이미지처럼 사용
// node-canvas 는 drawImage 의 소스로 Canvas 를 수락한다
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // naturalWidth / naturalHeight 를 추가로 설정
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

// ============================================================================
// analyzeAllOperations
// ============================================================================

describe('analyzeAllOperations', () => {
  describe('연산 없음 — 기본 레이아웃', () => {
    it('연산이 없으면 canvas 크기가 소스 이미지 크기와 같다', () => {
      const img = createMockImage(800, 600);
      const layout = analyzeAllOperations(img, []);

      expect(layout.width).toBe(800);
      expect(layout.height).toBe(600);
    });

    it('연산이 없으면 position 은 (0, 0) 이다', () => {
      const img = createMockImage(800, 600);
      const layout = analyzeAllOperations(img, []);

      expect(layout.position).toEqual({ x: 0, y: 0 });
    });

    it('연산이 없으면 filters 배열이 비어 있다', () => {
      const img = createMockImage(800, 600);
      const layout = analyzeAllOperations(img, []);

      expect(layout.filters).toHaveLength(0);
    });

    it('연산이 없으면 background 가 "transparent" 다', () => {
      const img = createMockImage(800, 600);
      const layout = analyzeAllOperations(img, []);

      expect(layout.background).toBe('transparent');
    });
  });

  describe('resize 연산', () => {
    it('cover 리사이즈 후 canvas 크기가 목표 크기와 일치한다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 400, height: 300 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(400);
      expect(layout.height).toBe(300);
    });

    it('contain 리사이즈 후 canvas 크기가 목표 크기와 일치한다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'contain', width: 400, height: 300 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(400);
      expect(layout.height).toBe(300);
    });

    it('fill 리사이즈는 종횡비 무시하고 목표 크기가 된다', () => {
      const img = createMockImage(400, 400);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'fill', width: 300, height: 100 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(300);
      expect(layout.height).toBe(100);
    });

    it('background 옵션이 레이아웃 background 에 반영된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [
        { type: 'resize', config: { fit: 'contain', width: 400, height: 300, background: '#ffffff' } },
      ];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.background).toBe('#ffffff');
    });
  });

  describe('blur 연산', () => {
    it('blur 연산이 filters 에 "blur(Npx)" 형식으로 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 5 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('blur(5px)');
    });

    it('radius 가 없으면 기본값 2px 로 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: {} }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('blur(2px)');
    });

    it('blur 연산은 canvas 크기에 영향을 미치지 않는다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 3 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(800);
      expect(layout.height).toBe(600);
    });
  });

  describe('filter 연산', () => {
    it('brightness 필터가 filters 에 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'filter', options: { brightness: 1.2 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('brightness(1.2)');
    });

    it('contrast 필터가 filters 에 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'filter', options: { contrast: 0.8 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('contrast(0.8)');
    });

    it('saturate 필터가 filters 에 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'filter', options: { saturate: 1.5 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('saturate(1.5)');
    });

    it('hueRotate 필터가 "hue-rotate(Ndeg)" 형식으로 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'filter', options: { hueRotate: 90 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('hue-rotate(90deg)');
    });

    it('복수 filter 옵션이 모두 개별 항목으로 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'filter', options: { brightness: 1.1, contrast: 0.9 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('brightness(1.1)');
      expect(layout.filters).toContain('contrast(0.9)');
    });
  });

  describe('복합 연산', () => {
    it('resize 후 blur 를 추가하면 크기와 필터가 모두 반영된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [
        { type: 'resize', config: { fit: 'cover', width: 400, height: 300 } },
        { type: 'blur', options: { radius: 2 } },
      ];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(400);
      expect(layout.height).toBe(300);
      expect(layout.filters).toContain('blur(2px)');
    });

    it('blur 와 filter 를 모두 추가하면 filters 에 순서대로 쌓인다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [
        { type: 'blur', options: { radius: 3 } },
        { type: 'filter', options: { brightness: 1.2 } },
      ];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters[0]).toBe('blur(3px)');
      expect(layout.filters[1]).toBe('brightness(1.2)');
    });
  });
});

// ============================================================================
// renderAllOperationsOnce
// ============================================================================

describe('renderAllOperationsOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('canvas 크기 — dimension 매핑', () => {
    it('연산 없이 호출하면 소스 이미지 크기의 canvas 를 반환한다', () => {
      // node-canvas 에서 drawImage 는 Canvas 를 소스로 수락하므로 안전하게 사용
      const source = createDrawableSource(800, 600);
      const canvas = renderAllOperationsOnce(source, []).detach();

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('resize 연산 후 반환 canvas 크기가 목표 크기와 일치한다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 400, height: 300 } }];
      const canvas = renderAllOperationsOnce(source, ops).detach();

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });

    it('blur 연산만 있으면 canvas 크기가 소스와 같다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 2 } }];
      const canvas = renderAllOperationsOnce(source, ops).detach();

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });
  });

  describe('필터 렌더링', () => {
    it('blur 와 filter 연산을 결합해 drawImage 전에 ctx.filter 에 적용한다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [
        { type: 'blur', options: { radius: 2 } },
        { type: 'filter', options: { brightness: 1.2, contrast: 0.9 } },
      ];
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const observedFilters: string[] = [];
      const drawImageSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(function (
        this: CanvasRenderingContext2D
      ) {
        observedFilters.push(this.filter);
      });
      let lease: CanvasLease | null = null;

      try {
        lease = renderAllOperationsOnce(source, ops);

        expect(observedFilters).toEqual(['blur(2px) brightness(1.2) contrast(0.9)']);
      } finally {
        lease?.release();
        drawImageSpy.mockRestore();
      }
    });
  });

  describe('CanvasPool 활용', () => {
    it('CanvasPool.acquire 가 레이아웃 크기와 함께 호출된다', () => {
      const pool = CanvasPool.getInstance();
      const acquireSpy = vi.spyOn(pool, 'acquire');

      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 400, height: 300 } }];
      const lease = renderAllOperationsOnce(source, ops);

      expect(acquireSpy).toHaveBeenCalledWith(400, 300);
      lease.release();
    });

    it('연산 없을 때 CanvasPool.acquire 가 소스 크기로 호출된다', () => {
      const pool = CanvasPool.getInstance();
      const acquireSpy = vi.spyOn(pool, 'acquire');

      const source = createDrawableSource(320, 240);
      const lease = renderAllOperationsOnce(source, []);

      expect(acquireSpy).toHaveBeenCalledWith(320, 240);
      lease.release();
    });

    it('렌더링 중 오류가 나면 획득한 canvas를 pool로 반환한다', () => {
      const pool = CanvasPool.getInstance();
      const releaseSpy = vi.spyOn(pool, 'release');
      const drawError = new Error('drawImage 실패');
      const source = createDrawableSource(320, 240);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const drawImageSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(() => {
        throw drawError;
      });

      try {
        expect(() => renderAllOperationsOnce(source, [])).toThrow(drawError);
        expect(releaseSpy).toHaveBeenCalledTimes(1);
      } finally {
        drawImageSpy.mockRestore();
      }
    });
  });

  describe('CanvasLease 반환 타입', () => {
    it('반환값이 CanvasLease 인스턴스다', () => {
      const source = createDrawableSource(100, 100);
      const lease = renderAllOperationsOnce(source, []);

      expect(lease).toBeInstanceOf(CanvasLease);
      expect(lease.detach()).toBeInstanceOf(HTMLCanvasElement);
    });
  });
});
