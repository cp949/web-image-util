import {
  applyRotation,
  getOriginRotationCoverageBounds,
  getRotatedTileBoundingSize,
  withCanvasState,
} from './canvas-drawing.internal';
import { requirePositiveSpacing } from './errors.internal';
import type { Point, Position, Size } from './position-types';
import { PositionCalculator } from './position-types';

export interface PlaceOnceSpec {
  containerSize: Size;
  objectSize: Size;
  position: Position;
  customPosition?: Point;
  margin?: Point;
  rotation?: number;
}

export interface PlaceTiledSpec {
  containerSize: Size;
  tileSize: Size;
  spacing: Point;
  stagger?: boolean;
  rotation?: number;
  rotationMode: 'frame' | 'per-tile';
  context: string;
}

export interface TileBounds {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}

export function placeOnce(ctx: CanvasRenderingContext2D, spec: PlaceOnceSpec, draw: (origin: Point) => void): Point {
  const origin = PositionCalculator.calculatePosition(
    spec.position,
    spec.customPosition ?? null,
    spec.containerSize,
    spec.objectSize,
    spec.margin
  );

  withCanvasState(ctx, () => {
    applyRotation(ctx, {
      x: origin.x,
      y: origin.y,
      width: spec.objectSize.width,
      height: spec.objectSize.height,
      rotation: spec.rotation,
    });
    draw(origin);
  });

  return origin;
}

export function computeFrameTileBounds(containerSize: Size, tileSize: Size, rotation?: number): TileBounds {
  const bounds = getOriginRotationCoverageBounds(containerSize.width, containerSize.height, rotation);

  return {
    startX: bounds.minX - tileSize.width,
    endX: bounds.maxX + tileSize.width,
    startY: bounds.minY,
    endY: bounds.maxY + tileSize.height,
  };
}

/**
 * per-tile 회전 모드의 타일 루프 범위.
 *
 * 패딩은 원본 타일 크기와 회전 후 axis-aligned bounding size 중 큰 쪽을 축별로 쓴다.
 *
 * - 회전으로 AABB가 커지는 경우(비정사각형 비90도 등) 원본 크기만 쓰면 캔버스 가장자리 타일이 누락된다.
 * - 반대로 AABB가 작아지는 경우(40×20 타일의 90도 회전은 20×40) AABB만 쓰면 패딩이 원본보다 좁아진다.
 *   회전 기준이 타일 중심이라 타일 점유 범위는 원점에서 `width/2`만큼 밀려 있으므로, 이때는
 *   캔버스와 겹치는 가장자리 타일을 오히려 잃는다.
 * - rotation이 0이면 두 값이 같아 회전 없는 경로의 좌표가 그대로 보존된다.
 */
export function computePerTileBounds(containerSize: Size, tileSize: Size, rotation?: number): TileBounds {
  const rotated = getRotatedTileBoundingSize(tileSize, rotation);
  const padding: Size = {
    width: Math.max(tileSize.width, rotated.width),
    height: Math.max(tileSize.height, rotated.height),
  };

  return {
    startX: -padding.width,
    endX: containerSize.width + padding.width,
    startY: -padding.height,
    endY: containerSize.height + padding.height,
  };
}

export function* iterateTileGrid(bounds: TileBounds, spacing: Point, stagger = false): Iterable<Point> {
  let rowIndex = 0;
  for (let y = bounds.startY; y < bounds.endY; y += spacing.y) {
    const xOffset = stagger && rowIndex % 2 === 1 ? spacing.x / 2 : 0;

    for (let x = bounds.startX; x < bounds.endX; x += spacing.x) {
      yield { x: x + xOffset, y };
    }
    rowIndex++;
  }
}

export function placeTiled(ctx: CanvasRenderingContext2D, spec: PlaceTiledSpec, draw: (origin: Point) => void): void {
  requirePositiveSpacing(spec.spacing.x, 'spacing.x', spec.context);
  requirePositiveSpacing(spec.spacing.y, 'spacing.y', spec.context);

  if (spec.rotationMode === 'frame') {
    placeFrameTiles(ctx, spec, draw);
    return;
  }

  placePerTileTiles(ctx, spec, draw);
}

function placeFrameTiles(ctx: CanvasRenderingContext2D, spec: PlaceTiledSpec, draw: (origin: Point) => void): void {
  const bounds = computeFrameTileBounds(spec.containerSize, spec.tileSize, spec.rotation);

  withCanvasState(ctx, () => {
    const rotation = spec.rotation ?? 0;
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    for (const origin of iterateTileGrid(bounds, spec.spacing, spec.stagger)) {
      draw(origin);
    }
  });
}

function placePerTileTiles(ctx: CanvasRenderingContext2D, spec: PlaceTiledSpec, draw: (origin: Point) => void): void {
  const bounds = computePerTileBounds(spec.containerSize, spec.tileSize, spec.rotation);

  // 상태 범위는 타일당 하나뿐이다. 루프 밖에는 되돌릴 변환이 없으므로 감싸지 않는다 —
  // 감싸면 추출 전 Canvas 호출 순서와 어긋난다.
  for (const origin of iterateTileGrid(bounds, spec.spacing, spec.stagger)) {
    withCanvasState(ctx, () => {
      applyRotation(ctx, {
        x: origin.x,
        y: origin.y,
        width: spec.tileSize.width,
        height: spec.tileSize.height,
        rotation: spec.rotation,
      });
      draw(origin);
    });
  }
}
