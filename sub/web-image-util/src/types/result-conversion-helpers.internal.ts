import { canvasToBlob as encodeCanvasToBlob } from '../base/canvas-utils.internal';
import type { OutputOptions } from './index';

export function resolveOutputMimeType(options?: OutputOptions, fallbackMimeType = 'image/png'): string {
  return options?.format ? `image/${options.format}` : fallbackMimeType;
}

/**
 * result 객체용 canvas→Blob 변환.
 *
 * `fallbackMimeType`은 format 미지정 시 사용할 기본 MIME이다(재시도용 아님).
 * 재시도 없이 1회 인코딩하며, 실패 시 CANVAS_TO_BLOB_FAILED로 reject한다.
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options?: OutputOptions,
  fallbackMimeType = 'image/png'
): Promise<globalThis.Blob> {
  return encodeCanvasToBlob(canvas, {
    mimeType: resolveOutputMimeType(options, fallbackMimeType),
    quality: options?.quality,
  });
}

export function canvasToDataURL(
  canvas: HTMLCanvasElement,
  options?: OutputOptions,
  fallbackMimeType = 'image/png'
): string {
  return canvas.toDataURL(resolveOutputMimeType(options, fallbackMimeType), options?.quality);
}

export function createFileFromBlob(blob: globalThis.Blob, filename: string): globalThis.File {
  return new File([blob], filename, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

export async function blobToArrayBuffer(blob: globalThis.Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

export async function blobToUint8Array(blob: globalThis.Blob): Promise<Uint8Array> {
  const arrayBuffer = await blobToArrayBuffer(blob);
  return new Uint8Array(arrayBuffer);
}
