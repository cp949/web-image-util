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
