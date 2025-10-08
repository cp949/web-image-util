import { CanvasPool } from './canvas-pool';
import { createImageError } from './error-helpers';

/**
 * Wrapper class that automatically manages Canvas operations
 * Manages Canvas lifecycle and automatically returns to pool.
 */
export class ManagedCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: CanvasPool;
  private disposed = false;

  constructor(width?: number, height?: number) {
    this.pool = CanvasPool.getInstance();
    this.canvas = this.pool.acquire(width, height);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      this.pool.release(this.canvas);
      throw createImageError('CANVAS_CREATION_FAILED', new Error('Failed to create CanvasRenderingContext2D'));
    }

    this.ctx = ctx;
  }

  /**
   * Return Canvas element
   * @returns HTMLCanvasElement
   */
  getCanvas(): HTMLCanvasElement {
    this.checkDisposed();
    return this.canvas;
  }

  /**
   * Return Canvas 2D Context
   * @returns CanvasRenderingContext2D
   */
  getContext(): CanvasRenderingContext2D {
    this.checkDisposed();
    return this.ctx;
  }

  /**
   * Set Canvas size
   * @param width - Width
   * @param height - Height
   */
  setSize(width: number, height: number): void {
    this.checkDisposed();
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Clear Canvas (make all pixels transparent)
   */
  clear(): void {
    this.checkDisposed();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Set background color on Canvas
   * @param color - Background color (CSS color string)
   */
  setBackgroundColor(color: string): void {
    this.checkDisposed();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Check if Canvas has already been disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Clean up resources (automatically return to pool)
   */
  dispose(): void {
    if (!this.disposed) {
      this.pool.release(this.canvas);
      this.disposed = true;
    }
  }

  /**
   * Check disposal state
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('ManagedCanvas has already been disposed.');
    }
  }
}

/**
 * Helper function that automatically manages Canvas operations
 * Automatically returns Canvas to pool after operation completion.
 *
 * @param width - Canvas width
 * @param height - Canvas height
 * @param operation - Canvas operation to perform
 * @returns Operation result
 */
export async function withManagedCanvas<T>(
  width: number,
  height: number,
  operation: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Promise<T> | T
): Promise<T> {
  const managedCanvas = new ManagedCanvas(width, height);

  try {
    return await operation(managedCanvas.getCanvas(), managedCanvas.getContext());
  } finally {
    managedCanvas.dispose();
  }
}

/**
 * Helper function that manages multiple Canvas operations
 * Suitable for operations that use multiple Canvas simultaneously.
 *
 * @param canvasSizes - Array of sizes for each Canvas
 * @param operation - Operation to perform
 * @returns Operation result
 */
export async function withMultipleManagedCanvas<T>(
  canvasSizes: Array<{ width: number; height: number }>,
  operation: (canvases: Array<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>) => Promise<T> | T
): Promise<T> {
  const managedCanvases = canvasSizes.map((size) => new ManagedCanvas(size.width, size.height));

  try {
    const canvasData = managedCanvases.map((managed) => ({
      canvas: managed.getCanvas(),
      ctx: managed.getContext(),
    }));

    return await operation(canvasData);
  } finally {
    managedCanvases.forEach((managed) => managed.dispose());
  }
}

/**
 * Canvas copy utility
 * Copies content from one Canvas to another Canvas.
 *
 * @param source - Source Canvas
 * @param targetWidth - Target Canvas width
 * @param targetHeight - Target Canvas height
 * @returns New copied Canvas
 */
export async function copyCanvas(
  source: HTMLCanvasElement,
  targetWidth?: number,
  targetHeight?: number
): Promise<HTMLCanvasElement> {
  const width = targetWidth || source.width;
  const height = targetHeight || source.height;

  return withManagedCanvas(width, height, (canvas, ctx) => {
    if (targetWidth && targetHeight && (targetWidth !== source.width || targetHeight !== source.height)) {
      // If size is different, copy with scaling
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    } else {
      // If same size, copy as is
      ctx.drawImage(source, 0, 0);
    }
    return canvas;
  });
}

/**
 * Convert Canvas to Blob (for managed Canvas)
 *
 * @param canvas - Canvas to convert
 * @param type - MIME type
 * @param quality - Quality (0-1)
 * @returns Blob Promise
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(createImageError('CONVERSION_FAILED', new Error(`Canvas to ${type} conversion failed`)));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Query Canvas Pool status information
 * @returns Pool status information
 */
export function getCanvasPoolStats() {
  return CanvasPool.getInstance().getStats();
}

/**
 * Clean up Canvas Pool
 * Call when memory cleanup is needed
 */
export function clearCanvasPool(): void {
  CanvasPool.getInstance().clear();
}

/**
 * Set Canvas Pool maximum size
 * @param size - Maximum pool size
 */
export function setCanvasPoolMaxSize(size: number): void {
  CanvasPool.getInstance().setMaxPoolSize(size);
}

// Canvas options for SVG high-quality rendering
export interface HighQualityCanvasOptions {
  scale?: number; // Custom scale factor
  imageSmoothingQuality?: 'low' | 'medium' | 'high'; // Image smoothing quality
  willReadFrequently?: boolean; // Whether to read pixels frequently
  useDevicePixelRatio?: boolean; // Whether to use devicePixelRatio (default: false)
}

/**
 * Canvas setup function for high-quality rendering
 * Creates high-resolution Canvas considering DevicePixelRatio and user settings.
 *
 * @param width - Logical width
 * @param height - Logical height
 * @param options - High-quality options
 * @returns Canvas and Context objects
 */
export function setupHighQualityCanvas(
  width: number,
  height: number,
  options: HighQualityCanvasOptions = {}
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');

  // Calculate scale considering DevicePixelRatio - controllable via options
  const deviceScale = options.useDevicePixelRatio ? window.devicePixelRatio || 1 : 1;
  const userScale = options.scale || 1;
  const totalScale = Math.min(4, Math.max(1, deviceScale * userScale));

  // Set actual Canvas size (high-resolution)
  canvas.width = width * totalScale;
  canvas.height = height * totalScale;

  // Set CSS size to logical size
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Context setup
  const context = canvas.getContext('2d', {
    willReadFrequently: options.willReadFrequently || false,
  });

  if (!context) {
    throw new Error('Could not get 2D context from canvas');
  }

  // Apply scale
  context.scale(totalScale, totalScale);

  // High-quality rendering settings
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = options.imageSmoothingQuality || 'high';

  return { canvas, context };
}
