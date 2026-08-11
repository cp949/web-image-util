import { type ImageErrorCodeType, ImageProcessError } from '../errors.internal';
import { CanvasPool } from './canvas-pool.internal';
import { createImageError } from './error-helpers';

type ManagedCanvasOperationResult<T> = T extends HTMLCanvasElement ? never : T;

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
      throw createImageError('CANVAS_CREATION_FAILED', {
        cause: new Error('Failed to create CanvasRenderingContext2D'),
      });
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
  operation: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => Promise<ManagedCanvasOperationResult<T>> | ManagedCanvasOperationResult<T>
): Promise<ManagedCanvasOperationResult<T>> {
  const managedCanvas = new ManagedCanvas(width, height);

  try {
    return await operation(managedCanvas.getCanvas(), managedCanvas.getContext());
  } finally {
    managedCanvas.dispose();
  }
}

/**
 * 호출자 소유 canvas를 생성한다.
 *
 * CanvasPool을 거치지 않으므로 반환된 canvas는 pool로 회수되지 않는다.
 * 결과 canvas를 호출자에게 넘겨야 하는 경로에서 사용한다 —
 * pool에서 빌린 canvas는 module 밖으로 내보내면 안 된다
 * (release가 clearRect를 실행해 호출자가 빈 canvas를 받게 된다).
 */
export function createOwnedCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw createImageError('CANVAS_CREATION_FAILED', {
      cause: new Error('Failed to create CanvasRenderingContext2D'),
    });
  }

  return { canvas, ctx };
}

/**
 * 통합 canvas→Blob 인코더 옵션.
 *
 * 포맷 결정 정책(어떤 MIME/품질을 쓸지)은 호출자 소유다 — 이 인코더는
 * Promise 래핑, null 실패 시 1회 재시도, 에러 변환만 담당한다.
 */
export interface CanvasToBlobOptions {
  /** 인코딩 MIME 타입 (예: 'image/png') */
  mimeType: string;
  /** 인코딩 품질(0~1). 미지정 시 브라우저 기본값 */
  quality?: number;
  /** 지정 시 1차 인코딩 실패(blob === null)에 한해 이 MIME으로 1회 재시도한다 */
  fallbackMimeType?: string;
  /** 실패 시 던질 ImageProcessError 코드. 기본 'CANVAS_TO_BLOB_FAILED' */
  errorCode?: ImageErrorCodeType;
}

/**
 * Canvas를 Blob으로 인코딩한다 — 라이브러리 전체가 공유하는 단일 인코딩 경로.
 *
 * 실패 시 `ImageProcessError('Canvas to Blob conversion failed', errorCode)`로 reject한다.
 */
export function canvasToBlob(canvas: HTMLCanvasElement, options: CanvasToBlobOptions): Promise<Blob> {
  const { mimeType, quality, fallbackMimeType, errorCode = 'CANVAS_TO_BLOB_FAILED' } = options;

  return new Promise((resolve, reject) => {
    // tainted canvas의 동기 SecurityError까지 ImageProcessError로 통일하고 원인을 cause로 보존한다.
    const fail = (cause?: unknown) =>
      reject(new ImageProcessError('Canvas to Blob conversion failed', errorCode, { cause }));

    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else if (fallbackMimeType) {
            try {
              canvas.toBlob(
                (fallbackBlob) => (fallbackBlob ? resolve(fallbackBlob) : fail()),
                fallbackMimeType,
                quality
              );
            } catch (cause) {
              fail(cause);
            }
          } else {
            fail();
          }
        },
        mimeType,
        quality
      );
    } catch (cause) {
      fail(cause);
    }
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
