/**
 * 입력 소스의 이미지 포맷을 판정하는 순수 함수 모음.
 *
 * MIME, 파일 경로 확장자, Data URL 헤더, 바이너리 매직바이트 순으로 가벼운 검증부터 시도한다.
 * 네트워크 fetch와 결합된 응답 prefix 기반 판정은 [`./remote-fetch.ts`]가 담당한다.
 */

import { detectSourceType } from '../../core/source-converter';
import type { ImageSource } from '../../types';
import { ImageFormats } from '../../types';
import type { ImageInfo } from './types';

/** MIME 타입을 공개 이미지 포맷 값으로 변환한다. */
export function formatFromMimeType(mimeType: string): ImageInfo['format'] {
  const normalized = mimeType.toLowerCase().split(';')[0].trim();

  switch (normalized) {
    case 'image/jpeg':
      return ImageFormats.JPEG;
    case 'image/png':
      return ImageFormats.PNG;
    case 'image/webp':
      return ImageFormats.WEBP;
    case 'image/avif':
      return ImageFormats.AVIF;
    case 'image/gif':
      return ImageFormats.GIF;
    case 'image/svg+xml':
      return ImageFormats.SVG;
    default:
      return 'unknown';
  }
}

/** 파일명이나 URL 경로의 확장자에서 이미지 포맷 힌트를 얻는다. */
export function formatFromPath(input: string): ImageInfo['format'] {
  const pathname = input.split(/[?#]/, 1)[0].toLowerCase();

  if (pathname.endsWith('.jpg')) return ImageFormats.JPG;
  if (pathname.endsWith('.jpeg')) return ImageFormats.JPEG;
  if (pathname.endsWith('.png')) return ImageFormats.PNG;
  if (pathname.endsWith('.webp')) return ImageFormats.WEBP;
  if (pathname.endsWith('.avif')) return ImageFormats.AVIF;
  if (pathname.endsWith('.gif')) return ImageFormats.GIF;
  if (pathname.endsWith('.svg')) return ImageFormats.SVG;

  return 'unknown';
}

/** Data URL 헤더에서 이미지 포맷을 추출한다. */
export function formatFromDataUrl(input: string): ImageInfo['format'] {
  const header = input.slice(0, input.indexOf(','));
  const match = header.match(/^data:([^;,]+)/i);
  return match ? formatFromMimeType(match[1]) : 'unknown';
}

/** 바이너리 시그니처에서 이미지 포맷을 가볍게 판정한다. */
export function formatFromBytes(bytes: Uint8Array): ImageInfo['format'] {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return ImageFormats.PNG;
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return ImageFormats.JPEG;
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return ImageFormats.WEBP;
  }

  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return ImageFormats.GIF;
  }

  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) {
    return ImageFormats.AVIF;
  }

  return 'unknown';
}

/** Blob/File에서 추가 로딩 없이 알 수 있는 포맷 힌트를 얻는다. */
export function formatFromBlobMetadata(blob: Blob): ImageInfo['format'] {
  const mimeFormat = formatFromMimeType(blob.type);
  if (mimeFormat !== 'unknown') {
    return mimeFormat;
  }

  const name = (blob as File).name;
  return typeof name === 'string' ? formatFromPath(name) : 'unknown';
}

/** 입력 소스에서 포맷을 확인한다. 필요한 경우에만 바이트를 읽는다. */
async function detectImageFormat(source: ImageSource): Promise<ImageInfo['format']> {
  if (source instanceof HTMLCanvasElement || source instanceof HTMLImageElement) {
    return 'unknown';
  }

  if (source instanceof Blob) {
    const metadataFormat = formatFromBlobMetadata(source);
    if (metadataFormat !== 'unknown') {
      return metadataFormat;
    }

    const buffer = await source.slice(0, 32).arrayBuffer();
    return formatFromBytes(new Uint8Array(buffer));
  }

  if (source instanceof ArrayBuffer) {
    return formatFromBytes(new Uint8Array(source, 0, Math.min(source.byteLength, 32)));
  }

  if (source instanceof Uint8Array) {
    return formatFromBytes(source.subarray(0, 32));
  }

  if (typeof source === 'string') {
    const sourceType = detectSourceType(source);
    if (sourceType === 'svg') return ImageFormats.SVG;
    if (sourceType === 'dataurl') return formatFromDataUrl(source.trim());
    if (sourceType === 'url' || sourceType === 'path' || sourceType === 'bloburl') {
      return formatFromPath(source.trim());
    }
  }

  return 'unknown';
}

/** 이미지 소스의 입력 포맷을 반환한다. */
export async function getImageFormat(source: ImageSource): Promise<ImageInfo['format']> {
  return detectImageFormat(source);
}
