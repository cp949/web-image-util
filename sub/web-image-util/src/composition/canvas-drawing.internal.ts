import { createCanvasContextError } from './errors.internal';

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
