import { requireCanvasContext, withCanvasState } from './canvas-drawing.internal';
import type { PlaceOnceSpec, PlaceTiledSpec } from './placement.internal';
import { placeOnce, placeTiled } from './placement.internal';
import type { Point, Size } from './position-types';

/**
 * 워터마크 콘텐츠별로 갈라지는 두 지점만 채우는 adapter.
 *
 * `prepare`가 스타일 적용과 크기 측정을 하나로 묶는다 — 텍스트는 폰트를 먼저 설정해야
 * `measureText` 결과가 맞으므로, 이 순서 제약을 adapter 밖(호출자 규약)이 아니라
 * adapter 안(단일 함수)에 가둔다. 이미지는 `ctx`를 쓰지 않고 미리 계산한 크기를 반환해도 된다.
 */
export interface WatermarkContentAdapter {
  prepare(ctx: CanvasRenderingContext2D): Size;
  draw(ctx: CanvasRenderingContext2D, origin: Point): void;
}

/**
 * 워터마크 콘텐츠 하나를 단일 위치에 그린다.
 *
 * ctx 획득 → `withCanvasState` 진입 → `prepare`(스타일 적용 + 측정) → `placeOnce` → `draw` 순서를
 * 이 함수가 소유한다. `TextWatermark`/`ImageWatermark`는 콘텐츠별 adapter만 채워 넣는다.
 */
export function renderWatermarkContentOnce(
  canvas: HTMLCanvasElement,
  context: string,
  adapter: WatermarkContentAdapter,
  spec: Omit<PlaceOnceSpec, 'objectSize'>
): HTMLCanvasElement {
  const ctx = requireCanvasContext(canvas, context);

  withCanvasState(ctx, () => {
    const objectSize = adapter.prepare(ctx);
    placeOnce(ctx, { ...spec, objectSize }, (origin) => adapter.draw(ctx, origin));
  });

  return canvas;
}

/**
 * 워터마크 콘텐츠를 반복 타일로 그린다.
 *
 * ctx 획득 → `withCanvasState` 진입 → `prepare`(스타일 적용 + 측정) → `placeTiled` → `draw` 순서를
 * 이 함수가 소유한다. `context`는 `PlaceTiledSpec`이 이미 갖고 있는 필드를 그대로 재사용한다.
 */
export function renderWatermarkContentTiled(
  canvas: HTMLCanvasElement,
  adapter: WatermarkContentAdapter,
  spec: Omit<PlaceTiledSpec, 'tileSize'>
): HTMLCanvasElement {
  const ctx = requireCanvasContext(canvas, spec.context);

  withCanvasState(ctx, () => {
    const tileSize = adapter.prepare(ctx);
    placeTiled(ctx, { ...spec, tileSize }, (origin) => adapter.draw(ctx, origin));
  });

  return canvas;
}
