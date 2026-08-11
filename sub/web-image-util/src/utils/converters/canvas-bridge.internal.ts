/**
 * Canvas와 출력 형식 사이의 저수준 브리지 헬퍼.
 *
 * @description 변환 함수들이 공유하는 Canvas → Blob/DataURL 인코딩과
 * Element → Canvas 그리기, Blob 크기 측정 같은 보조 기능을 모아둔다.
 */

import { canvasToBlob as encodeCanvasToBlob } from '../../base/canvas-utils.internal';
import type { OutputOptions } from '../../types';
import { ImageProcessError } from '../../types';
import { formatToMimeType } from '../format-utils';
import { createImageElement } from '../image-element.internal';

/**
 * Convert Canvas to Blob
 *
 * 1차 인코딩 실패 시 fallbackFormat(기본 png)으로 1회 재시도한다.
 */
export async function canvasToBlob(canvas: HTMLCanvasElement, options: OutputOptions): Promise<Blob> {
  return encodeCanvasToBlob(canvas, {
    mimeType: formatToMimeType(options.format || 'png'),
    quality: options.quality ?? 0.8,
    fallbackMimeType: formatToMimeType(options.fallbackFormat || 'png'),
  });
}

/**
 * Convert Canvas to Data URL
 */
export function canvasToDataURL(canvas: HTMLCanvasElement, options: OutputOptions): string {
  const mimeType = formatToMimeType(options.format || 'png');
  const quality = options.quality ?? 0.8;

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Convert HTMLImageElement to Canvas
 */
export async function imageElementToCanvas(imageElement: HTMLImageElement): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new ImageProcessError('Unable to create Canvas 2D context', 'CANVAS_CREATION_FAILED');
  }

  canvas.width = imageElement.width;
  canvas.height = imageElement.height;

  ctx.drawImage(imageElement, 0, 0);

  return canvas;
}

/**
 * Get Blob dimension information
 */
export async function getBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = createImageElement();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read Blob size information'));
    };

    img.src = url;
  });
}
