import type { OutputOptions } from './index';
import { ImageProcessError } from './index';

export function resolveOutputMimeType(options?: OutputOptions, fallbackMimeType = 'image/png'): string {
  return options?.format ? `image/${options.format}` : fallbackMimeType;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  options?: OutputOptions,
  fallbackMimeType = 'image/png'
): Promise<globalThis.Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new ImageProcessError('Blob conversion failed', 'CANVAS_TO_BLOB_FAILED'));
        }
      },
      resolveOutputMimeType(options, fallbackMimeType),
      options?.quality
    );
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
