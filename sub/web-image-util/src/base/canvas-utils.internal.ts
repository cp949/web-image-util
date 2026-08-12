import { type ImageErrorCodeType, ImageProcessError } from '../errors.internal';
import { CanvasPool } from './canvas-pool.internal';
import { createImageError } from './error-helpers';

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

/** advanced 계열 품질 어휘 — 코어 렌더러(고정 high 스무딩)에는 품질 어휘가 없다 */
export type SmoothingQuality = 'fast' | 'balanced' | 'high';

/**
 * quality → imageSmoothing 매핑 정본.
 * fast: 스무딩 끔 / balanced: medium / high: high.
 */
export function applySmoothing(ctx: CanvasRenderingContext2D, quality: SmoothingQuality): void {
  if (quality === 'fast') {
    ctx.imageSmoothingEnabled = false;
    return;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = quality === 'high' ? 'high' : 'medium';
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
