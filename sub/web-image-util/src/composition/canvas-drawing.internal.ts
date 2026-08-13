import { createCanvasContextError } from './errors.internal';

export interface DrawableImagePlacement {
  image: HTMLImageElement;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface DrawableLayer {
  image: HTMLImageElement;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  rotation?: number;
}

export function requireCanvasContext(canvas: HTMLCanvasElement, operation: string): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw createCanvasContextError(operation);
  }
  return ctx;
}

export function withCanvasState<T>(ctx: CanvasRenderingContext2D, draw: () => T): T {
  ctx.save();
  try {
    return draw();
  } finally {
    ctx.restore();
  }
}

export function fillCanvasBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string | undefined
): void {
  if (!color) {
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

export function drawImageLayer(ctx: CanvasRenderingContext2D, layer: DrawableLayer): void {
  const width = layer.width || layer.image.width;
  const height = layer.height || layer.image.height;

  withCanvasState(ctx, () => {
    ctx.globalAlpha = layer.opacity || 1;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    applyRotation(ctx, {
      x: layer.x,
      y: layer.y,
      width,
      height,
      rotation: layer.rotation,
    });
    ctx.drawImage(layer.image, layer.x, layer.y, width, height);
  });
}

export function drawPlacedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: Omit<DrawableImagePlacement, 'image'>
): void {
  ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
}

export function drawShadowedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  placement: Omit<DrawableImagePlacement, 'image'>
): void {
  withCanvasState(ctx, () => {
    applyRotation(ctx, placement);

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    drawPlacedImage(ctx, image, placement);
  });
}

/**
 * 배치 영역의 중심을 기준으로 캔버스를 회전시킨다.
 *
 * `rotation`은 도(degree) 단위이고, 0 또는 undefined면 변환을 걸지 않는다.
 * composition 모듈에서 "배치 영역 중심 회전의 기준점이 어디인가"를 정의하는 단일 지점이다 —
 * 이 회전이 필요한 레이어·그림자·워터마크는 모두 이 함수를 거치므로 인라인으로 다시 적지 않는다.
 *
 * 변환을 되돌리는 책임은 호출자에게 있다. 반드시 {@link withCanvasState} 안에서 호출한다.
 */
export function applyRotation(
  ctx: CanvasRenderingContext2D,
  placement: Pick<DrawableImagePlacement, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): void {
  if (!placement.rotation) {
    return;
  }

  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((placement.rotation * Math.PI) / 180);
  ctx.translate(-centerX, -centerY);
}

/**
 * 회전된 좌표계에서 캔버스 전체를 덮는 데 필요한 사각 범위.
 *
 * 좌표는 회전이 걸린 뒤의 user space 기준이다.
 */
export interface CoverageBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * 캔버스 원점 회전(`ctx.rotate()` 단독 호출) 상태에서 캔버스 전체를 덮으려면
 * user space의 어느 범위를 그려야 하는지 계산한다.
 *
 * `ctx.rotate(θ)`는 user space 좌표 `(x, y)`를 디바이스 좌표
 * `(x·cosθ − y·sinθ, x·sinθ + y·cosθ)`로 보낸다. 따라서 디바이스 사각형
 * `[0, width] × [0, height]`의 네 꼭짓점을 역변환해 user space로 옮기고,
 * 그 bounding box를 취하면 캔버스를 빠짐없이 포함하는 범위가 된다.
 * 회전된 프레임에서 그리는 타일 루프가 캔버스 축 기준 경계를 그대로 쓰면
 * 커버리지가 한쪽으로 편중되므로, 루프 경계는 이 범위에서 파생시킨다.
 *
 * `rotation`이 0(또는 미지정·비유한값)이면 변환이 걸리지 않으므로 캔버스 사각형을
 * 그대로 돌려준다. 부동소수 오차 없이 회전 없는 경로의 출력을 보존하기 위한 조기 반환이다.
 */
export function getOriginRotationCoverageBounds(width: number, height: number, rotation?: number): CoverageBounds {
  if (!rotation || !Number.isFinite(rotation)) {
    return { minX: 0, maxX: width, minY: 0, maxY: height };
  }

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const corners: Array<readonly [number, number]> = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];
  const xs = corners.map(([x, y]) => x * cos + y * sin);
  const ys = corners.map(([x, y]) => -x * sin + y * cos);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}
