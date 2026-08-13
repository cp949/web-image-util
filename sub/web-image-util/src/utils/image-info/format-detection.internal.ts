/**
 * 입력 소스의 이미지 포맷을 판정하는 순수 함수 모음.
 *
 * MIME, 파일 경로 확장자, Data URL 헤더, 바이너리 매직바이트 순으로 가벼운 검증부터 시도한다.
 * 네트워크 fetch와 결합된 응답 prefix 기반 판정은 [`./remote-fetch.internal.ts`]가 담당한다.
 *
 * MIME 매핑 정본은 utils/format-utils가, 경로 확장자 매핑 정본은
 * utils/source-utils/path.internal이 소유한다.
 */

import { detectStringSourceType, isSvgSourceType } from '../../core/source-converter/detect.internal';
import type { ImageSource } from '../../types';
import { ImageFormats } from '../../types';
import { parseDataURLMimeType } from '../data-url';
import { mimeTypeToImageFormat } from '../format-utils';
import { resolveMimeFirstBlobFormat } from '../source-utils/blob-projection.internal';
import { detectFormatFromBytes } from '../source-utils/byte-signature.internal';
import { getFormatFromPath } from '../source-utils/path.internal';
import { inspectBlobMetadata } from '../source-utils/source-facts.internal';
import type { ImageInfo } from './types';

/** MIME 타입을 공개 이미지 포맷 값으로 변환한다. 매핑 정본은 format-utils가 소유한다. */
export function formatFromMimeType(mimeType: string): ImageInfo['format'] {
  return mimeTypeToImageFormat(mimeType);
}

/** Data URL 헤더에서 이미지 포맷을 추출한다. */
export function formatFromDataUrl(input: string): ImageInfo['format'] {
  const mimeType = parseDataURLMimeType(input);
  return mimeType ? formatFromMimeType(mimeType) : 'unknown';
}

/**
 * 바이너리 시그니처에서 이미지 포맷을 가볍게 판정한다.
 *
 * detectFormatFromBytes가 판정하는 bmp/tiff/ico는 공개 ImageFormat이 표현하지 못하므로
 * unknown으로 접는다. 로더(blob.internal.ts)는 같은 facts를 자기 폴백으로 다르게 투영한다.
 */
export function formatFromBytes(bytes: Uint8Array): ImageInfo['format'] {
  const format = detectFormatFromBytes(bytes);

  switch (format) {
    case 'bmp':
    case 'tiff':
    case 'ico':
    case 'unknown':
      return 'unknown';
    default:
      return format;
  }
}

/** Blob/File에서 추가 로딩 없이 알 수 있는 포맷 힌트를 얻는다. */
export function formatFromBlobMetadata(blob: Blob): ImageInfo['format'] {
  const facts = inspectBlobMetadata(blob);
  return resolveMimeFirstBlobFormat(facts);
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
    const sourceType = detectStringSourceType(source);
    if (isSvgSourceType(sourceType)) return ImageFormats.SVG;
    if (sourceType === 'dataurl') return formatFromDataUrl(source.trim());
    if (sourceType === 'url' || sourceType === 'path' || sourceType === 'bloburl') {
      return getFormatFromPath(source.trim());
    }
  }

  return 'unknown';
}

/** 이미지 소스의 입력 포맷을 반환한다. */
export async function getImageFormat(source: ImageSource): Promise<ImageInfo['format']> {
  return detectImageFormat(source);
}
