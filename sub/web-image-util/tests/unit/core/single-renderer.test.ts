/**
 * single-renderer 단위 테스트
 *
 * analyzeAllOperations (레이아웃 계산),
 * renderLayout (레이아웃 검증, 스무딩, 배경 채우기, Canvas Pool 활용) 을 검증한다.
 * 픽셀 비교는 하지 않으며, 구조적 속성(크기, 필터 문자열, ctx 상태, Pool 호출)만 확인한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import {
  analyzeAllOperations,
  type FinalLayout,
  type LazyOperation,
  renderLayout,
} from '../../../src/core/single-renderer.internal';
import {
  resetCanvasLimitProbe,
  setCanvasLimitProbe,
} from '../../../src/utils/browser-capabilities/canvas-limits.internal';
import { productionLog } from '../../../src/utils/debug.internal';

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

// 유효한 FinalLayout 기본값 — 개별 테스트는 필요한 필드만 덮어쓴다
function makeLayout(overrides: Partial<FinalLayout> = {}): FinalLayout {
  return {
    width: 100,
    height: 100,
    position: { x: 0, y: 0 },
    imageSize: { width: 100, height: 100 },
    background: 'transparent',
    filters: [],
    ...overrides,
  };
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

    it('radius 0 이면 기본값으로 대체되지 않고 blur(0px) 로 추가된다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 0 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters).toContain('blur(0px)');
    });

    it('blur 연산은 canvas 크기에 영향을 미치지 않는다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 3 } }];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.width).toBe(800);
      expect(layout.height).toBe(600);
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

    it('blur 를 여러 번 추가하면 filters 에 순서대로 쌓인다', () => {
      const img = createMockImage(800, 600);
      const ops: LazyOperation[] = [
        { type: 'blur', options: { radius: 3 } },
        { type: 'blur', options: { radius: 1 } },
      ];
      const layout = analyzeAllOperations(img, ops);

      expect(layout.filters[0]).toBe('blur(3px)');
      expect(layout.filters[1]).toBe('blur(1px)');
    });
  });
});

// ============================================================================
// renderLayout
// ============================================================================

describe('renderLayout', () => {
  // jsdom 은 ctx 메서드를 생성 시점에 인스턴스 own property 로 바인딩하므로,
  // pool 이 재활용한 canvas 의 ctx 는 이전 테스트의 spy 를 물고 있을 수 있다.
  // 테스트 간 pool 을 비워 항상 새 ctx 가 만들어지게 한다.
  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    CanvasPool.getInstance().clear();
  });

  describe('canvas 크기 — dimension 매핑', () => {
    it('연산 없는 레이아웃이면 소스 이미지 크기의 canvas 를 반환한다', () => {
      // node-canvas 에서 drawImage 는 Canvas 를 소스로 수락하므로 안전하게 사용
      const source = createDrawableSource(800, 600);
      const canvas = renderLayout(source, analyzeAllOperations(source, [])).detach();

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('resize 레이아웃이면 반환 canvas 크기가 목표 크기와 일치한다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [{ type: 'resize', config: { fit: 'cover', width: 400, height: 300 } }];
      const canvas = renderLayout(source, analyzeAllOperations(source, ops)).detach();

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
    });

    it('blur 연산만 있는 레이아웃이면 canvas 크기가 소스와 같다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [{ type: 'blur', options: { radius: 2 } }];
      const canvas = renderLayout(source, analyzeAllOperations(source, ops)).detach();

      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('소수점 position 과 imageSize 는 drawImage 에 정수로 전달된다', () => {
      const source = createDrawableSource(200, 200);
      const layout = makeLayout({
        position: { x: 10.4, y: 20.6 },
        imageSize: { width: 99.5, height: 50.2 },
      });
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const observedArgs: unknown[][] = [];
      const drawImageSpy = vi
        .spyOn(Object.getPrototypeOf(tempCtx), 'drawImage')
        .mockImplementation((...args: unknown[]) => {
          observedArgs.push(args);
        });
      let lease: CanvasLease | null = null;

      try {
        lease = renderLayout(source, layout);

        expect(observedArgs).toHaveLength(1);
        expect(observedArgs[0].slice(1)).toEqual([10, 21, 100, 50]);
      } finally {
        lease?.release();
        drawImageSpy.mockRestore();
      }
    });
  });

  describe('필터 렌더링', () => {
    it('blur 연산 여러 개를 결합해 drawImage 전에 ctx.filter 에 적용한다', () => {
      const source = createDrawableSource(800, 600);
      const ops: LazyOperation[] = [
        { type: 'blur', options: { radius: 2 } },
        { type: 'blur', options: { radius: 3 } },
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
        lease = renderLayout(source, analyzeAllOperations(source, ops));

        expect(observedFilters).toEqual(['blur(2px) blur(3px)']);
      } finally {
        lease?.release();
        drawImageSpy.mockRestore();
      }
    });
  });

  describe('레이아웃 검증', () => {
    it('canvas 크기가 0 이하면 INVALID_DIMENSIONS 를 던지고 pool 을 사용하지 않는다', () => {
      const acquireSpy = vi.spyOn(CanvasPool.getInstance(), 'acquire');
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ width: 0, height: 0 }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-canvas-size', width: 0, height: 0 },
        })
      );
      expect(acquireSpy).not.toHaveBeenCalled();
    });

    it('canvas 크기가 NaN 이면 INVALID_DIMENSIONS 를 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ width: NaN, height: 100 }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-canvas-size', width: NaN, height: 100 },
        })
      );
    });

    it('canvas 크기가 Infinity 면 INVALID_DIMENSIONS 를 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ width: Infinity, height: 100 }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-canvas-size', width: Infinity, height: 100 },
        })
      );
    });

    it('canvas 크기가 반올림하면 0 이 되는 소수(0.4)여도 INVALID_DIMENSIONS 를 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ width: 0.4, height: 100 }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-canvas-size', width: 0.4, height: 100 },
        })
      );
    });

    it('imageSize 가 음수면 invalid-image-size 로 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ imageSize: { width: -1, height: 100 } }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-image-size', width: -1, height: 100 },
        })
      );
    });

    it('imageSize 가 NaN 이면 invalid-image-size 로 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ imageSize: { width: NaN, height: 100 } }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-image-size', width: NaN, height: 100 },
        })
      );
    });

    it('imageSize 가 0 으로 반올림되는 축퇴 케이스면 drawImage 를 건너뛰고 배경만 그린다', () => {
      // 극단 종횡비 입력(예: 1x10000 → contain 100x100)에서 calculator 가
      // imageSize 0 을 산출할 수 있다. 이때 오류 대신 배경만 채운 canvas 를 반환한다.
      const source = createDrawableSource(100, 100);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const drawImageSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage');

      try {
        const canvas = renderLayout(
          source,
          makeLayout({ width: 100, height: 100, imageSize: { width: 0, height: 100 } })
        ).detach();

        expect(drawImageSpy).not.toHaveBeenCalled();
        expect(canvas.width).toBe(100);
        expect(canvas.height).toBe(100);
      } finally {
        drawImageSpy.mockRestore();
      }
    });

    it('position 이 NaN 이면 invalid-position 으로 던진다', () => {
      const source = createDrawableSource(100, 100);

      expect(() => renderLayout(source, makeLayout({ position: { x: NaN, y: NaN } }))).toThrow(
        expect.objectContaining({
          name: 'ImageProcessError',
          code: 'INVALID_DIMENSIONS',
          details: { kind: 'invalid-position', x: NaN, y: NaN },
        })
      );
    });
  });

  describe('스무딩', () => {
    // drawImage 시점의 ctx 스무딩 상태를 캡처하는 헬퍼
    function renderAndCaptureSmoothing() {
      const source = createDrawableSource(100, 100);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const observed: Array<{ enabled: boolean; quality: string }> = [];
      const drawImageSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(function (
        this: CanvasRenderingContext2D
      ) {
        observed.push({ enabled: this.imageSmoothingEnabled, quality: this.imageSmoothingQuality });
      });
      let lease: CanvasLease | null = null;

      try {
        lease = renderLayout(source, makeLayout());
        return observed;
      } finally {
        lease?.release();
        drawImageSpy.mockRestore();
      }
    }

    it('항상 고품질 스무딩으로 렌더링한다', () => {
      const observed = renderAndCaptureSmoothing();

      expect(observed).toEqual([{ enabled: true, quality: 'high' }]);
    });
  });

  describe('배경 채우기', () => {
    it('background 가 CSS 색이면 해당 색으로 전체 영역을 fillRect 한다', () => {
      const source = createDrawableSource(100, 100);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const fills: Array<{ style: unknown; args: unknown[] }> = [];
      const fillRectSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'fillRect').mockImplementation(function (
        this: CanvasRenderingContext2D,
        ...args: unknown[]
      ) {
        fills.push({ style: this.fillStyle, args });
      });
      let lease: CanvasLease | null = null;

      try {
        lease = renderLayout(source, makeLayout({ width: 200, height: 100, background: '#ffffff' }));

        expect(fills).toEqual([{ style: '#ffffff', args: [0, 0, 200, 100] }]);
      } finally {
        lease?.release();
        fillRectSpy.mockRestore();
      }
    });

    it('background 가 transparent 면 fillRect 를 호출하지 않는다', () => {
      const source = createDrawableSource(100, 100);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const fillRectSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'fillRect');
      let lease: CanvasLease | null = null;

      try {
        lease = renderLayout(source, makeLayout({ background: 'transparent' }));

        expect(fillRectSpy).not.toHaveBeenCalled();
      } finally {
        lease?.release();
        fillRectSpy.mockRestore();
      }
    });
  });

  describe('대형 canvas 경고', () => {
    afterEach(() => {
      resetCanvasLimitProbe();
    });

    it('면적이 16384^2 를 넘으면 오류 없이 경고만 남긴다', () => {
      // 실제 초대형 canvas 할당을 피하기 위해 acquire 를 작은 canvas 로 대체한다
      const small = document.createElement('canvas');
      small.width = 10;
      small.height = 10;
      vi.spyOn(CanvasPool.getInstance(), 'acquire').mockReturnValue(small);
      const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
      const source = createDrawableSource(100, 100);

      const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      // 가짜 canvas 를 pool 에 넣지 않도록 소유권을 회수한다
      lease.detach();
    });

    it('일반 크기에서는 경고하지 않는다', () => {
      const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
      const source = createDrawableSource(100, 100);

      const lease = renderLayout(source, makeLayout());

      expect(warnSpy).not.toHaveBeenCalled();
      lease.release();
    });

    it('probe가 더 큰 상한을 돌려주면 이전에 경고하던 크기가 더 이상 경고하지 않는다', () => {
      setCanvasLimitProbe({ read: () => 40000 }); // maxCanvasArea = 1.6e9
      const small = document.createElement('canvas');
      small.width = 10;
      small.height = 10;
      vi.spyOn(CanvasPool.getInstance(), 'acquire').mockReturnValue(small);
      const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
      const source = createDrawableSource(100, 100);

      // 20000x20000 = 4e8 — 옛 기본 상한(16384^2 ≈ 2.68e8)은 넘지만 새 상한은 안 넘는다
      const lease = renderLayout(source, makeLayout({ width: 20000, height: 20000 }));

      expect(warnSpy).not.toHaveBeenCalled();
      lease.detach();
    });

    it('probe가 더 작은 상한을 돌려주면 이전에 경고하지 않던 크기도 경고한다', () => {
      setCanvasLimitProbe({ read: () => 1000 }); // maxCanvasArea = 1e6
      const warnSpy = vi.spyOn(productionLog, 'warn').mockImplementation(() => {});
      const source = createDrawableSource(100, 100);

      // 2000x2000 = 4e6 — 옛 기본 상한으로는 경고 안 뜨던 크기
      const lease = renderLayout(source, makeLayout({ width: 2000, height: 2000 }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      lease.release();
    });
  });

  describe('CanvasPool 활용', () => {
    it('CanvasPool.acquire 가 레이아웃 크기와 함께 호출된다', () => {
      const acquireSpy = vi.spyOn(CanvasPool.getInstance(), 'acquire');

      const source = createDrawableSource(800, 600);
      const lease = renderLayout(source, makeLayout({ width: 400, height: 300 }));

      expect(acquireSpy).toHaveBeenCalledWith(400, 300);
      lease.release();
    });

    it('렌더링 중 오류가 나면 획득한 canvas를 pool로 반환한다', () => {
      const releaseSpy = vi.spyOn(CanvasPool.getInstance(), 'release');
      const drawError = new Error('drawImage 실패');
      const source = createDrawableSource(320, 240);
      const tempCtx = document.createElement('canvas').getContext('2d')!;
      const drawImageSpy = vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(() => {
        throw drawError;
      });

      try {
        expect(() => renderLayout(source, makeLayout())).toThrow(drawError);
        expect(releaseSpy).toHaveBeenCalledTimes(1);
      } finally {
        drawImageSpy.mockRestore();
      }
    });
  });

  describe('CanvasLease 반환 타입', () => {
    it('반환값이 CanvasLease 인스턴스다', () => {
      const source = createDrawableSource(100, 100);
      const lease = renderLayout(source, makeLayout());

      expect(lease).toBeInstanceOf(CanvasLease);
      expect(lease.detach()).toBeInstanceOf(HTMLCanvasElement);
    });
  });
});
