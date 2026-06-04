/**
 * ImageSource를 HTMLImageElement로 변환하는 image-common 내부 유틸리티다.
 */

import { createImageElement } from '../../utils/image-element.internal';
import type { ImageSource, ImageSourceConvertOptions } from '../common-types.internal';
import { createImageError } from '../error-helpers';
import { blobToDataUrl, svgToDataUrl } from './conversion.internal';

// Convert HTTP URL and Data URL to HTMLImageElement
export function urlToElement(
  url: string,
  opts?: {
    crossOrigin?: string;
    elementSize?: { width: number; height: number };
  }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = createImageElement(opts?.elementSize);

    if (opts?.crossOrigin) {
      img.crossOrigin = opts?.crossOrigin;
    }

    img.onload = () => {
      resolve(img);
    };

    img.onerror = (event: Event | string) => {
      const error = event instanceof ErrorEvent ? event.error : new Error(String(event));
      reject(createImageError('SOURCE_LOAD_FAILED', { cause: error, context: { sourceType: 'url', format: url } }));
    };

    img.src = url;
  });
}

/**
 * Universal function to convert various image sources to HTMLImageElement
 *
 * @description Converts various sources like Blob, ArrayBuffer, Uint8Array, strings (URL, SVG, Data URL) to HTMLImageElement.
 * @param source Image source to convert
 * @param opts Conversion options (CORS settings, element size, etc.)
 * @returns HTMLImageElement object
 */
export async function convertImageSourceToElement(
  source: ImageSource,
  opts?: ImageSourceConvertOptions
): Promise<HTMLImageElement> {
  if (source instanceof HTMLImageElement) {
    return source;
  } else if (source instanceof Blob) {
    const dataUrl = await blobToDataUrl(source);
    return urlToElement(dataUrl, opts);
  } else if (source instanceof ArrayBuffer) {
    const blob = new Blob([source]);
    const dataUrl = await blobToDataUrl(blob);
    return urlToElement(dataUrl, opts);
  } else if (source instanceof Uint8Array) {
    const blob = new Blob([source.slice()]);
    const dataUrl = await blobToDataUrl(blob);
    return urlToElement(dataUrl, opts);
  } else if (typeof source === 'string') {
    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('data:')) {
      return urlToElement(source, opts);
    }

    if (source.includes('<svg ')) {
      const dataUrl = svgToDataUrl(source);
      return urlToElement(dataUrl, opts);
    }

    // Handle relative and absolute paths (e.g., myimg/xxx, /myimg/xxx, ./myimg/xxx)
    return urlToElement(source, opts);
  }

  throw new Error(`Unsupported image source type: ${typeof source}`);
}
