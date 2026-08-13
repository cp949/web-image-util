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
