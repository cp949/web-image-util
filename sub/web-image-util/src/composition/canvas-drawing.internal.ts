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

function applyRotation(
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
