/**
 * 문자열 이미지 source 판별과 형식 추론을 담당하는 image-common 내부 유틸리티다.
 */

import { debugLog } from '../../utils/debug.internal';
import type { ImageFileExt, ImageStringSourceType } from '../common-types.internal';
import { fixBlobFileExt, svgToBlob, svgToDataUrl, urlToBlob, urlToDataUrl } from './conversion.internal';
import { urlToElement } from './element.internal';

export function sourceTypeFromString(str: string): ImageStringSourceType | undefined {
  if (str.startsWith('http://') || str.startsWith('https://')) return 'HTTP_URL';
  if (str.startsWith('data:')) return 'DATA_URL';
  if (str.indexOf('<svg') >= 0) return 'SVG_XML';
  if (str.startsWith('/')) return 'PATH';

  // If undefined, default to handling as file path
  return undefined;
}

export async function stringToDataUrl(str: string): Promise<string | undefined> {
  const sourceType = sourceTypeFromString(str);
  if (!sourceType) return undefined;
  if (sourceType === 'DATA_URL' || sourceType === 'HTTP_URL') {
    return await urlToDataUrl(str);
  }
  if (sourceType === 'SVG_XML') {
    return svgToDataUrl(str);
  }

  return await urlToDataUrl(str);
}

export async function stringToBlob(str: string): Promise<Blob | undefined> {
  const sourceType = sourceTypeFromString(str);
  if (!sourceType) return undefined;
  if (sourceType === 'DATA_URL' || sourceType === 'HTTP_URL') {
    return await urlToBlob(str);
  }

  if (sourceType === 'SVG_XML') {
    return svgToBlob(str);
  }

  return await urlToBlob(str);
}

export async function stringToFile(str: string, fileName: string): Promise<File | undefined> {
  return stringToBlob(str) //
    .then((blob) => {
      if (!blob) return undefined;
      return new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type });
    })
    .catch((err) => {
      debugLog.warn('File conversion failed:', err);
      return undefined;
    });
}

export async function stringToElement(
  str: string,
  opts?: {
    crossOrigin?: string;
    elementSize?: { width: number; height: number };
  }
): Promise<HTMLImageElement | undefined> {
  return stringToDataUrl(str).then((url) => {
    if (!url) return undefined;
    return urlToElement(url, opts);
  });
}

export async function checkImageFormatFromString(image: string): Promise<
  | {
      src: string;
      format: ImageFileExt;
    }
  | undefined
> {
  if (image.startsWith('data:')) {
    const format = imageFormatFromDataUrl(image);
    if (format) {
      return { format, src: image };
    }
    debugLog.warn('Unknown image data URL:', `${image.substring(0, 100)}...`);
    return undefined;
  }
  const dataUrl = await stringToDataUrl(image).catch((err) => {
    debugLog.warn('stringToDataUrl() failed:', err);
    return undefined;
  });

  if (!dataUrl) {
    debugLog.warn('stringToDataUrl() result is null');
    return undefined;
  }
  const format = imageFormatFromDataUrl(dataUrl);
  return format ? { format, src: dataUrl } : undefined;
}

export function imageFormatFromDataUrl(src: string): ImageFileExt | undefined {
  if (src.startsWith('data:image/png')) {
    return 'png';
  }

  if (src.startsWith('data:image/jpg') || src.startsWith('data:image/jpeg')) {
    return 'jpg';
  }

  if (src.startsWith('data:image/svg+xml')) {
    return 'svg';
  }

  if (src.startsWith('data:image/bmp')) {
    return 'bmp';
  }

  if (src.startsWith('data:image/tiff')) {
    return 'tiff';
  }

  if (src.startsWith('data:image/gif')) {
    return 'gif';
  }

  if (src.startsWith('data:image/webp')) {
    return 'webp';
  }

  if (src.startsWith('data:image/vnd.microsoft.icon')) {
    return 'ico';
  }

  return undefined;
}
