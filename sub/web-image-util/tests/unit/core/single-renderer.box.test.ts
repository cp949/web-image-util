/**
 * single-renderer box 통합 테스트
 *
 * analyzeAllOperations가 resize/blur 루프가 끝나 content 크기가 확정된 뒤 box를 해석해
 * 캔버스 크기·position을 바깥 상자 기준으로 바꾸는지, renderLayout이 배경을 둥근 경로로
 * 채우고 content를 clip한 뒤 기존 drawImage 분기를 실행하고 border를 stroke하는지 검증한다.
 * 픽셀 비교는 하지 않고 ctx 호출(spy)과 레이아웃 값만 확인한다. 픽셀은 processor 체인
 * 테스트가 본다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasLease } from '../../../src/base/canvas-lease.internal';
import { CanvasPool } from '../../../src/base/canvas-pool.internal';
import {
  analyzeAllOperations,
  debugLayout,
  type LazyOperation,
  renderLayout,
} from '../../../src/core/single-renderer.internal';
import type { NormalizedBox } from '../../../src/types/box-config';
import { debugLog } from '../../../src/utils/debug.internal';

function createMockImage(naturalWidth: number, naturalHeight: number): HTMLImageElement {
  const img = new Image();
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

// node-canvas는 drawImage 소스로 Canvas를 수락한다
function createDrawableSource(width: number, height: number): HTMLImageElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(canvas, 'naturalHeight', { value: height, configurable: true });
  return canvas as unknown as HTMLImageElement;
}

function makeBox(overrides: Partial<NormalizedBox> = {}): NormalizedBox {
  return {
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    background: 'transparent',
    radius: 0,
    border: null,
    ...overrides,
  };
}

function boxOp(overrides: Partial<NormalizedBox> = {}): LazyOperation {
  return { type: 'box', box: makeBox(overrides) };
}

/** ctx 프로토타입 메서드를 spy로 바꾸고 호출 인자를 모은다 */
function spyCtx(method: 'drawImage' | 'clip' | 'fillRect' | 'fill' | 'stroke' | 'save' | 'restore') {
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  const calls: unknown[][] = [];
  const spy = vi.spyOn(Object.getPrototypeOf(tempCtx), method).mockImplementation((...args: unknown[]) => {
    calls.push(args);
  });
  return { calls, spy };
}

describe('analyzeAllOperations — box', () => {
  it('box가 없으면 layout.box는 undefined다 (기존 경로 불변)', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), []);
    expect(layout.box).toBeUndefined();
  });

  it('padding만 있으면 canvas 크기가 content + padding*2다', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      boxOp({ padding: { top: 10, right: 10, bottom: 10, left: 10 } }),
    ]);

    expect(layout.width).toBe(820);
    expect(layout.height).toBe(620);
    expect(layout.position).toEqual({ x: 10, y: 10 });
    expect(layout.imageSize).toEqual({ width: 800, height: 600 }); // 이미지 자체 크기는 그대로
  });

  it('box는 resize 뒤 content 크기를 기준으로 해석된다 (배열 순서 무관)', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      boxOp({ padding: { top: 5, right: 5, bottom: 5, left: 5 } }),
      { type: 'resize', config: { fit: 'cover', width: 200, height: 100 } },
    ]);

    // resize 결과(200x100)에 padding 5*2가 더해진다 — box를 배열 앞에 둬도 결과는 같다.
    // cover(800x600 → 200x100)는 종횡비 불일치로 세로를 크롭한다: imageSize 200x150,
    // position (0, -25) — box는 이 값에 padding만큼만 더한다.
    expect(layout.width).toBe(210);
    expect(layout.height).toBe(110);
    expect(layout.position).toEqual({ x: 5, y: -20 });
  });

  it('border(outside)는 캔버스를 더 키우고 content를 안쪽으로 민다', () => {
    const layout = analyzeAllOperations(createMockImage(100, 100), [
      boxOp({ border: { width: 10, color: '#000', inset: false } }),
    ]);

    expect(layout.width).toBe(120);
    expect(layout.height).toBe(120);
    expect(layout.position).toEqual({ x: 10, y: 10 });
  });

  it('border(inset)는 캔버스 크기를 늘리지 않는다', () => {
    const layout = analyzeAllOperations(createMockImage(100, 100), [
      boxOp({ border: { width: 10, color: '#000', inset: true } }),
    ]);

    expect(layout.width).toBe(100);
    expect(layout.height).toBe(100);
    expect(layout.position).toEqual({ x: 0, y: 0 });
  });

  it('blur 필터는 box와 함께 유지된다', () => {
    const layout = analyzeAllOperations(createMockImage(800, 600), [
      { type: 'blur', options: { radius: 2 } },
      boxOp({ padding: { top: 10, right: 10, bottom: 10, left: 10 } }),
    ]);
    expect(layout.filters).toEqual(['blur(2px)']);
  });
});

describe('renderLayout — box', () => {
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

  it('box가 있으면 drawImage는 content origin만큼 밀린 위치에 정확히 1회 호출된다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('drawImage');
    const layout = analyzeAllOperations(source, [boxOp({ padding: { top: 10, right: 10, bottom: 10, left: 10 } })]);

    lease = renderLayout(source, layout);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([source, 10, 10, 100, 100]);
  });

  it('box가 없으면 기존 5인자 drawImage 경로를 그대로 쓴다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('drawImage');

    lease = renderLayout(source, analyzeAllOperations(source, []));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([source, 0, 0, 100, 100]);
  });

  it('box.background가 있으면 fillRect 대신 fill()로 둥근 경로를 채운다', () => {
    const source = createDrawableSource(100, 100);
    const fillRect = spyCtx('fillRect');
    const fill = spyCtx('fill');
    const layout = analyzeAllOperations(source, [boxOp({ background: '#ffff00' })]);

    lease = renderLayout(source, layout);

    expect(fillRect.calls).toHaveLength(0);
    expect(fill.calls).toHaveLength(1);
  });

  it('box.background가 transparent(기본)면 아무 채우기도 호출하지 않는다', () => {
    const source = createDrawableSource(100, 100);
    const fillRect = spyCtx('fillRect');
    const fill = spyCtx('fill');

    lease = renderLayout(source, analyzeAllOperations(source, [boxOp()]));

    expect(fillRect.calls).toHaveLength(0);
    expect(fill.calls).toHaveLength(0);
  });

  it('radius가 있으면 drawImage 전에 clip을 1회 호출하고, radius 0이면 호출하지 않는다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('clip');

    lease = renderLayout(source, analyzeAllOperations(source, [boxOp({ radius: 20 })]));
    expect(calls).toHaveLength(1);
    lease.release();

    lease = renderLayout(source, analyzeAllOperations(source, [boxOp({ radius: 0 })]));
    expect(calls).toHaveLength(1); // 누적: 두 번째 렌더에서 추가로 호출되지 않았다
  });

  it('border가 있으면 stroke를 1회 호출하고, 없으면 호출하지 않는다', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('stroke');

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [boxOp({ border: { width: 4, color: '#333', inset: false } })])
    );
    expect(calls).toHaveLength(1);
    lease.release();

    lease = renderLayout(source, analyzeAllOperations(source, [boxOp()]));
    expect(calls).toHaveLength(1); // 누적: border 없는 두 번째 렌더는 추가 호출 없음
  });

  it('border.width가 0이면 stroke를 호출하지 않는다 (lineWidth=0은 canvas가 무시해 유령 테두리가 남는 회귀 방지)', () => {
    const source = createDrawableSource(100, 100);
    const { calls } = spyCtx('stroke');

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [boxOp({ border: { width: 0, color: '#333', inset: false } })])
    );

    expect(calls).toHaveLength(0);
  });

  it('변환 상태는 save/restore로 격리된다 (clip이 필요할 때만)', () => {
    const source = createDrawableSource(100, 100);
    const saves = spyCtx('save');
    const restores = spyCtx('restore');

    lease = renderLayout(source, analyzeAllOperations(source, [boxOp({ radius: 10 })]));

    expect(saves.calls).toHaveLength(1);
    expect(restores.calls).toHaveLength(1);
  });

  it('clip이 필요 없으면(padding·border만, radius 없음) save/restore를 추가로 걸지 않는다', () => {
    const source = createDrawableSource(100, 100);
    const saves = spyCtx('save');

    lease = renderLayout(
      source,
      analyzeAllOperations(source, [boxOp({ padding: { top: 10, right: 10, bottom: 10, left: 10 } })])
    );

    expect(saves.calls).toHaveLength(0);
  });
});

describe('debugLayout — box.hasBorder', () => {
  it('퇴화된 inset stroke(strokeRect가 0 이하)면 hasBorder를 false로 보고한다', () => {
    // inset border의 width(20)가 바깥 상자(10x10) 절반보다 커서 strokeRect가 음수로 퇴화한다 —
    // renderLayout은 이 경우 stroke를 아예 건너뛰므로(strokeRect.width/height > 0 조건),
    // 디버그 로그도 실제로 그려지지 않는 border를 hasBorder: true로 보고하면 안 된다.
    const source = createMockImage(10, 10);
    const layout = analyzeAllOperations(source, [boxOp({ border: { width: 20, color: '#000', inset: true } })]);

    const logSpy = vi.spyOn(debugLog, 'log').mockImplementation(() => {});
    debugLayout(layout, 1);

    const [, payload] = logSpy.mock.calls[0] as [string, { box?: { hasBorder: boolean } }];
    expect(payload.box?.hasBorder).toBe(false);

    logSpy.mockRestore();
  });

  it('정상 stroke(strokeRect가 양수)면 hasBorder를 true로 보고한다', () => {
    const source = createMockImage(100, 100);
    const layout = analyzeAllOperations(source, [boxOp({ border: { width: 4, color: '#000', inset: false } })]);

    const logSpy = vi.spyOn(debugLog, 'log').mockImplementation(() => {});
    debugLayout(layout, 1);

    const [, payload] = logSpy.mock.calls[0] as [string, { box?: { hasBorder: boolean } }];
    expect(payload.box?.hasBorder).toBe(true);

    logSpy.mockRestore();
  });
});
