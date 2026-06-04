/**
 * 문자열 이미지 source 판별과 형식 추론을 담당하는 image-common 내부 유틸리티다.
 */

import { debugLog } from '../../utils/debug.internal';
import type { ImageFileExt, ImageStringSourceType } from '../common-types.internal';
import { fixBlobFileExt, svgToBlob, svgToDataUrl, urlToBlob, urlToDataUrl } from './conversion.internal';
import { urlToElement } from './element.internal';

export function sourceTypeFromString(str: string): ImageStringSourceType | undefined {
  const trimmed = str.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (lowerTrimmed.startsWith('http://') || lowerTrimmed.startsWith('https://')) return 'HTTP_URL';
  if (lowerTrimmed.startsWith('data:')) return 'DATA_URL';
  // blob: URL은 URL source다. blob URL의 쿼리/프래그먼트에 '<svg' 텍스트가 들어갈 수 있으므로
  // SVG 마크업 판정보다 먼저 검사한다.
  if (lowerTrimmed.startsWith('blob:')) return 'BLOB_URL';
  if (trimmed.indexOf('<svg') >= 0) return 'SVG_XML';
  if (trimmed.startsWith('/')) return 'PATH';

  // If undefined, default to handling as file path
  return undefined;
}

export async function stringToDataUrl(str: string): Promise<string | undefined> {
  // 분류는 trim된 문자열 기준이므로 디스패치도 동일하게 정규화된 입력을 넘겨 불일치를 막는다.
  const trimmed = str.trim();
  const sourceType = sourceTypeFromString(trimmed);
  if (!sourceType) return undefined;
  if (sourceType === 'DATA_URL' || sourceType === 'HTTP_URL' || sourceType === 'BLOB_URL') {
    return await urlToDataUrl(trimmed);
  }
  if (sourceType === 'SVG_XML') {
    return svgToDataUrl(trimmed);
  }

  return await urlToDataUrl(trimmed);
}

export async function stringToBlob(str: string): Promise<Blob | undefined> {
  // 분류와 동일한 정규화 입력을 디스패치에 사용한다.
  const trimmed = str.trim();
  const sourceType = sourceTypeFromString(trimmed);
  if (!sourceType) return undefined;
  if (sourceType === 'DATA_URL' || sourceType === 'HTTP_URL' || sourceType === 'BLOB_URL') {
    return await urlToBlob(trimmed);
  }

  if (sourceType === 'SVG_XML') {
    return svgToBlob(trimmed);
  }

  return await urlToBlob(trimmed);
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
  // Blob URL은 브라우저 이미지 로더가 직접 처리할 수 있으므로 Data URL 변환(Blob 전체 메모리 복사)을 거치지 않고
  // urlToElement로 바로 로드한다. 분류와 동일한 정규화 입력을 사용한다.
  const trimmed = str.trim();
  if (sourceTypeFromString(trimmed) === 'BLOB_URL') {
    return urlToElement(trimmed, opts);
  }

  return stringToDataUrl(trimmed).then((url) => {
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
  // 분류와 동일한 정규화 입력을 사용한다.
  const trimmed = image.trim();
  if (trimmed.startsWith('data:')) {
    const format = imageFormatFromDataUrl(trimmed);
    if (format) {
      return { format, src: trimmed };
    }
    debugLog.warn('Unknown image data URL:', `${trimmed.substring(0, 100)}...`);
    return undefined;
  }

  // Blob URL은 Blob 전체를 Data URL로 복사하지 않고 fetch 결과 Blob의 MIME 타입만으로 format을 판정한다.
  if (sourceTypeFromString(trimmed) === 'BLOB_URL') {
    const blob = await urlToBlob(trimmed).catch((err) => {
      debugLog.warn('urlToBlob() failed:', err);
      return undefined;
    });
    if (!blob) return undefined;
    const format = imageFormatFromMimeType(blob.type);
    return format ? { format, src: trimmed } : undefined;
  }

  const dataUrl = await stringToDataUrl(trimmed).catch((err) => {
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

/** Blob MIME 타입을 지원 이미지 확장자로 변환한다. 비어 있거나 미인식 MIME은 undefined를 반환한다. */
function imageFormatFromMimeType(mimeType: string): ImageFileExt | undefined {
  // blob.type은 'image/svg+xml; charset=utf-8'처럼 파라미터를 포함할 수 있으므로 essence만 추출해 비교한다.
  const normalized = mimeType.toLowerCase().split(';')[0].trim();
  if (normalized === 'image/png') return 'png';
  // image/jpg는 비표준 MIME이나 imageFormatFromDataUrl의 data:image/jpg 허용과 동치를 유지한다.
  if (normalized === 'image/jpg' || normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/svg+xml') return 'svg';
  if (normalized === 'image/bmp') return 'bmp';
  if (normalized === 'image/tiff') return 'tiff';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/vnd.microsoft.icon') return 'ico';
  return undefined;
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
