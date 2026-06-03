import { ImageProcessError } from '../errors';

export function createCanvasContextError(operation: string): ImageProcessError {
  return new ImageProcessError('Failed to get Canvas 2D context', 'CANVAS_CONTEXT_FAILED', {
    details: { operation },
  });
}
