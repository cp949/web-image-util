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

export function computePerTileBounds(containerSize: Size, tileSize: Size, rotation?: number): TileBounds {
  const padding = getRotatedTileBoundingSize(tileSize, rotation);

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

  withCanvasState(ctx, () => {
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
  });
}
