/**
 * Blob, File, Data URL 변환을 담당하는 image-common 내부 유틸리티다.
 */

import { createImageError } from '../error-helpers';

const IMAGE_TYPE_TO_EXTENSION: Record<string, string> = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpeg',
  gif: 'gif',
  svg: 'svg',
  webp: 'webp',
  bmp: 'bmp',
  ico: 'ico',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/vnd.microsoft.icon': 'ico',
};

/**
 * Base64 문자열을 Uint8Array로 변환한다.
 *
 * @description fetch 경로를 사용해 큰 입력도 안정적으로 바이너리로 바꾼다.
 * @param base64 Base64로 인코딩된 문자열
 * @returns Uint8Array로 변환한 바이너리 데이터
 */
export function base64ToBuffer(base64: string): Promise<Uint8Array> {
  const dataUrl = `data:application/octet-binary;base64,${base64}`;

  return fetch(dataUrl)
    .then((res) => res.arrayBuffer())
    .then((buffer) => new Uint8Array(buffer));
}

/** Blob을 Data URL 문자열로 변환한다. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });

    reader.addEventListener('error', () => {
      reject(createImageError('SOURCE_LOAD_FAILED', { cause: reader.error || new Error('File read failed') }));
    });

    reader.readAsDataURL(blob);
  });
}

const fixFileExt = (fileName: string, ext: string) => {
  if (fileName.toLowerCase().endsWith(`.${ext}`)) {
    return fileName;
  }
  const idx = fileName.lastIndexOf('.');
  if (idx > 0) {
    return `${fileName.substring(0, idx)}.${ext}`;
  }
  return `${fileName}.${ext}`;
};

export function fixBlobFileExt(blob: Blob, fileName: string) {
  const fileExt = IMAGE_TYPE_TO_EXTENSION[blob.type];
  if (fileExt) {
    return fixFileExt(fileName, fileExt);
  }
  return fileName;
}

export function blobToFile(blob: Blob, fileName: string): Promise<File> {
  return new Promise((resolve) => {
    if (blob.type.indexOf('image/svg+xml') >= 0) {
      return resolve(new File([blob], fixBlobFileExt(blob, fileName), { type: 'image/svg+xml' }));
    } else {
      return resolve(new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type }));
    }
  });
}

export async function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  return fetch(url)
    .then((res) => res.blob())
    .then(blobToDataUrl);
}

export function urlToBuffer(dataUrl: string): Promise<Uint8Array> {
  return fetch(dataUrl)
    .then((res) => res.arrayBuffer())
    .then((buffer) => new Uint8Array(buffer));
}

export function urlToBlob(url: string): Promise<Blob> {
  return fetch(url)
    .then((res) => res.blob())
    .then(async (blob) => new Blob([await blob.arrayBuffer()], { type: blob.type }));
}

export function urlToFile(url: string, fileName: string): Promise<File> {
  return fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      if (blob.type.indexOf('image/svg+xml') >= 0) {
        return new File([blob], fixBlobFileExt(blob, fileName), { type: 'image/svg+xml' });
      } else {
        return new File([blob], fixBlobFileExt(blob, fileName), { type: blob.type });
      }
    });
}

export function isSvgDataUrl(dataUrl: string): boolean {
  // "data:image/svg+xml;"
  return dataUrl.startsWith('data:image/svg+xml');
}

export function svgToDataUrl(svgXml: string): string {
  const svg = svgXml.replace(/&nbsp/g, '&#160');
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function svgToBlob(svgXml: string): Blob {
  const svg = svgXml.replace(/&nbsp/g, '&#160');
  return new Blob([svg], { type: 'image/svg+xml' });
}
