/**
 * single-renderer transform 통합 테스트
 *
 * analyzeAllOperations가 transform 기하를 가장 먼저 해석해 resize의 기준 크기로 넘기는지,
 * renderLayout이 save/restore 안에서 변환 행렬 + 9인자 drawImage 1회로 그리는지 검증한다.
 * 픽셀 비교는 하지 않고 ctx 호출(spy)과 레이아웃 값만 확인한다. 픽셀은 processor 체인 테스트가 본다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import { analyzeAllOperations, type LazyOperation, renderLayout } from '../../../src/core/single-renderer.internal';
import { ImageProcessError } from '../../../src/errors.internal';
import type { NormalizedTransform } from '../../../src/types/transform-config';

function createMockImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

// node-canvas 는 drawImage 소스로 Canvas 를 수락한다
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

function makeTransform(overrides: Partial<NormalizedTransform> = {}): NormalizedTransform {
  return { crop: null, flipX: false, flipY: false, degrees: 0, expand: true, ...overrides };
}

function transformOp(overrides: Partial<NormalizedTransform> = {}): LazyOperation {
  return { type: 'transform', transform: makeTransform(overrides) };
}

/** ctx 프로토타입 메서드를 spy로 바꾸고 호출 인자를 모은다 */
function spyCtx(method: 'drawImage' | 'rotate' | 'scale' | 'translate' | 'clip' | 'fillRect' | 'save' | 'restore') {
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  const calls: unknown[][] = [];
  const spy = vi.spyOn(Object.getPrototypeOf(tempCtx), method).mockImplementation((...args: unknown[]) => {
    calls.push(args);
  });
  return { calls, spy };
}

/**
 * 여러 ctx 메서드를 동시에 spy로 바꾸고 실제 호출된 순서를 문자열 배열 하나로 기록한다.
 *
 * spyCtx는 메서드 하나만 관찰하므로 "scale 다음에 rotate가 오는가" 같은 상대 순서는
 * 검증할 수 없다. drawTransformedImage의 행렬 순서(중심 이동 → resize 배율 → 회전 →
 * flip → crop 원점 이동)를 고정하려면 여러 메서드의 호출을 하나의 타임라인으로 모아야 한다.
 */
function spyCtxSequence(methods: ReadonlyArray<'translate' | 'scale' | 'rotate'>): string[] {
  const order: string[] = [];
  for (const method of methods) {
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    vi.spyOn(Object.getPrototypeOf(tempCtx), method).mockImplementation((...args: unknown[]) => {
      order.push(`${method}(${args.join(',')})`);
    });
  }
  return order;
}

describe('analyzeAllOperations — transform', () => {
  it('transform이 없으면 layout.transform은 undefined다 (기존 경로 불변)', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), []);
    expect(layout.transform).toBeUndefined();
  });

  it('crop만 있으면 canvas 크기가 crop 크기다', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      transformOp({ crop: { x: 100, y: 50, width: 400, height: 300 } }),
    ]);

    expect(layout.width).toBe(400);
    expect(layout.height).toBe(300);
    expect(layout.imageSize).toEqual({ width: 400, height: 300 });
    expect(layout.transform?.sourceRect).toEqual({ x: 100, y: 50, width: 400, height: 300 });
  });

  it('90° expand는 canvas 폭·높이를 교환한다', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [transformOp({ degrees: 90 })]);

    expect(layout.width).toBe(600);
    expect(layout.height).toBe(800);
  });

  it('transform 뒤 resize는 프레임 크기를 원본으로 본다', () => {
    // crop 400x300 → cover 200x200: scale = max(0.5, 0.667) = 0.667 → 267x200
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      transformOp({ crop: { x: 0, y: 0, width: 400, height: 300 } }),
      { type: 'resize', config: { fit: 'cover', width: 200, height: 200 } },
    ]);

    expect(layout.width).toBe(200);
    expect(layout.height).toBe(200);
    expect(layout.imageSize.height).toBe(200);
    expect(layout.imageSize.width).toBe(267);
    expect(layout.transform?.frameSize).toEqual({ width: 400, height: 300 });
  });

  it('연산 배열에서 transform이 resize 뒤에 있어도 먼저 해석한다 (고정 순서 계약)', () => {
    const ops: LazyOperation[] = [
      { type: 'resize', config: { fit: 'scale', scale: 0.5 } },
      transformOp({ crop: { x: 0, y: 0, width: 400, height: 300 } }),
    ];
    const layout = analyzeAllOperations(createMockImage(800, 600), ops);

    expect(layout.width).toBe(200);
    expect(layout.height).toBe(150);
  });

  it('crop이 원본과 교집합이 없으면 INVALID_DIMENSIONS를 던진다', () => {
    expect(() =>
      analyzeAllOperations(createMockImage(100, 100), [
        transformOp({ crop: { x: 200, y: 200, width: 10, height: 10 } }),
      ])
    ).toThrow(ImageProcessError);
  });

  it('blur 필터는 transform과 함께 유지된다', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      { type: 'blur', options: { radius: 2 } },
      transformOp({ degrees: 90 }),
    ]);
    expect(layout.filters).toEqual(['blur(2px)']);
  });
});

describe('renderLayout — transform', () => {
  let lease: CanvasLease | null = null;

  beforeEach(() => {
    CanvasPool.getInstance().clear();
  });

  afterEach(() => {
    lease?.release();
    lease = null;
    vi.restoreAllMocks();
    CanvasPool.getInstance().clear();
  });

  it('transform이 있으면 9인자 drawImage를 정확히 1회 호출하고 source rect는 교집합이다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('drawImage');
    const layout = analyzeAllOperations(source, [transformOp({ crop: { x: -50, y: -50, width: 200, height: 200 } })]);

    lease = renderLayout(source, layout);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(9);
    // source rect = 교집합 (0,0,100,100), dest = crop 공간에서 (50,50,100,100)
    expect(calls[0].slice(1)).toEqual([0, 0, 100, 100, 50, 50, 100, 100]);
  });

  it('transform이 없으면 기존 5인자 drawImage 경로를 그대로 쓴다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('drawImage');

    lease = renderLayout(source, analyzeAllOperations(source, []));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(5);
  });

  it('회전은 ctx.rotate를 라디안으로 1회 호출한다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('rotate');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ degrees: 90 })]));

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBeCloseTo(Math.PI / 2, 12);
  });

  it('0° 회전은 ctx.rotate를 호출하지 않는다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('rotate');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ flipX: true })]));

    expect(calls).toHaveLength(0);
  });

  it('flip은 ctx.scale(-1, 1) / (1, -1) 호출로 나타난다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('scale');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ flipX: true, flipY: true })]));

    expect(calls).toContainEqual([-1, -1]);
  });

  it('clip 프레임 + 회전이면 ctx.clip을 1회, expand면 0회 호출한다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('clip');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ degrees: 45, expand: false })]));
    expect(calls).toHaveLength(1);
    lease.release();

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ degrees: 45, expand: true })]));
    expect(calls).toHaveLength(1);
  });

  it('변환 상태는 save/restore로 격리된다', () => {
    const source = createDrawableSource(400, 300);
    const saves = spyCtx('save');
    const restores = spyCtx('restore');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ degrees: 30 })]));

    expect(saves.calls).toHaveLength(1);
    expect(restores.calls).toHaveLength(1);
  });

  it('변환 호출 순서는 중심 이동 → resize 배율 → 회전 → crop 원점 이동이다 (scaleX ≠ scaleY)', () => {
    // scale과 rotate의 상대 순서가 결과를 바꾸는 경우만 이 계약을 실제로 검증한다 —
    // scaleX === scaleY(균일 스케일)면 두 순서가 같은 그림을 만들어 순서 버그를 못 잡는다.
    // crop 없음(cropSize = 400x300), 90° expand → frameSize 300x400(가로세로 교환).
    // resize fit:'fill'로 600x400 지정 → scaleX = 600/300 = 2, scaleY = 400/400 = 1
    const source = createDrawableSource(400, 300);
    const order = spyCtxSequence(['translate', 'scale', 'rotate']);

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [
        transformOp({ degrees: 90 }),
        { type: 'resize', config: { fit: 'fill', width: 600, height: 400 } },
      ])
    );

    expect(order).toEqual([
      'translate(300,200)', // 프레임 중심 = (600/2, 400/2)
      'scale(2,1)', // scaleX=600/300, scaleY=400/400 — flip 없음이라 scale 호출은 이 1회뿐
      'rotate(1.5707963267948966)', // 90° = Math.PI/2
      'translate(-200,-150)', // -cropSize.width/2, -cropSize.height/2 (crop 없음 → cropSize = 원본 400x300)
    ]);
  });

  it('resize.background는 캔버스 전체를 한 번만 채우고 transform은 별도 fillRect를 하지 않는다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('fillRect');
    const layout = analyzeAllOperations(source, [
      transformOp({ crop: { x: -100, y: 0, width: 400, height: 300 }, degrees: 45 }),
      { type: 'resize', config: { fit: 'contain', width: 400, height: 400, background: '#00ff00' } },
    ]);

    lease = renderLayout(source, layout);

    expect(calls).toEqual([[0, 0, 400, 400]]);
  });

  it('resize.background가 없으면 transform 경로도 fillRect를 호출하지 않는다', () => {
    const source = createDrawableSource(400, 300);
    const { calls } = spyCtx('fillRect');

    lease = renderLayout(source, analyzeAllOperations(source, [transformOp({ degrees: 45 })]));

    expect(calls).toHaveLength(0);
  });

  it('blur 필터는 transform 경로에서도 drawImage 전에 ctx.filter로 적용된다', () => {
    const source = createDrawableSource(400, 300);
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    const observedFilters: string[] = [];
    vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(function (this: CanvasRenderingContext2D) {
      observedFilters.push(this.filter);
    });

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [{ type: 'blur', options: { radius: 3 } }, transformOp({ degrees: 90 })])
    );

    expect(observedFilters).toEqual(['blur(3px)']);
  });

  it('비균일 배율(fit: fill)에서도 ctx.filter 문자열은 원래 반경 그대로다 — 축별로 다르게 렌더링될 수 있음(user space 기준)', () => {
    // drawTransformedImage는 ctx.filter를 ctx.scale(scaleX, scaleY) 안에서 적용한다.
    // filter의 px 값은 적용 시점의 user space 기준이라, scaleX(2) != scaleY(1)이면
    // 실제 렌더링되는 blur 강도는 가로·세로가 다르게(비등방적으로) 나타난다.
    // 이 테스트는 그 버그를 고치는 게 아니라 "ctx.filter 문자열 자체는 축별로 보정되지
    // 않고 원래 반경 그대로 설정된다"는 현재 동작을 고정(pin)한다.
    const source = createDrawableSource(400, 300);
    const tempCtx = document.createElement('canvas').getContext('2d')!;
    const observedFilters: string[] = [];
    vi.spyOn(Object.getPrototypeOf(tempCtx), 'drawImage').mockImplementation(function (this: CanvasRenderingContext2D) {
      observedFilters.push(this.filter);
    });

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [
        { type: 'blur', options: { radius: 3 } },
        transformOp({}),
        { type: 'resize', config: { fit: 'fill', width: 800, height: 300 } }, // scaleX=2, scaleY=1
      ])
    );

    expect(observedFilters).toEqual(['blur(3px)']);
  });
});
