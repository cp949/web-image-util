/**
 * Canvas와 출력 형식 사이의 저수준 브리지 헬퍼.
 *
 * @description 변환 함수들이 공유하는 Canvas → Blob/DataURL 인코딩과
 * Element → 임대 Canvas 그리기, Blob 크기 측정 같은 보조 기능을 모아둔다.
 * 인코딩은 코어의 단일 인코더(`base/canvas-utils`)에, 중간 Canvas는 CanvasPool에 얹는다.
 */

import { type CanvasLeaseConsumeResult, leaseCanvas } from '../../base/canvas-lease.internal';
import { canvasToBlob as encodeCanvasToBlob } from '../../base/canvas-utils.internal';
import { createImageError } from '../../base/error-helpers';
import type { OutputOptions } from '../../types';
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
 * 이미지를 임대 canvas에 그리고 파생물을 만든 뒤 canvas를 pool로 반환한다.
 *
 * @description ensure* 변환의 중간 canvas는 인코딩 직후 버려지므로 owned가 아니라
 * 임대 대상이다. canvas 자체를 반환하면 pool로 돌아간 canvas가 밖으로 새므로
 * consume 콜백 형태로만 접근을 허용한다(콜백이 실패해도 canvas는 반환된다).
 *
 * @param imageElement 그릴 원본 이미지
 * @param derive 임대 canvas에서 파생물을 만드는 콜백
 * @returns 콜백의 반환값
 */
export async function withImageElementCanvas<T>(
  imageElement: HTMLImageElement,
  derive: (canvas: HTMLCanvasElement) => Promise<CanvasLeaseConsumeResult<T>> | CanvasLeaseConsumeResult<T>
): Promise<CanvasLeaseConsumeResult<T>> {
  const lease = leaseCanvas(imageElement.width, imageElement.height);

  return lease.consume(async (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw createImageError('CANVAS_CREATION_FAILED', {
        cause: new Error('Failed to create CanvasRenderingContext2D'),
      });
    }

    ctx.drawImage(imageElement, 0, 0);
    return derive(canvas);
  });
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
