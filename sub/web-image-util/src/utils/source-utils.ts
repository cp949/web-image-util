import type { ImageFormat, ImageSource } from '../types';
import { mimeTypeToImageFormat } from './format-utils';
import { isInlineSvg } from './svg-detection';

export type ImageStringSourceType =
  | 'inline-svg'
  | 'svg-data-url'
  | 'data-url'
  | 'http-url'
  | 'protocol-relative-url'
  | 'blob-url'
  | 'svg-path'
  | 'path';

export type ImageSourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'svg-blob'
  | 'array-buffer'
  | 'uint8-array'
  | ImageStringSourceType;

export interface ImageStringSourceInfo {
  type: ImageStringSourceType;
  family: 'string';
  mimeType?: string;
  format: ImageFormat | 'unknown';
  isSvg: boolean;
  isUrl: boolean;
  isDataUrl: boolean;
  isBlobUrl: boolean;
}

export type ImageSourceInfo =
  | ImageStringSourceInfo
  | {
      type: Exclude<ImageSourceType, ImageStringSourceType>;
      family: 'element' | 'canvas' | 'blob' | 'binary';
      mimeType?: string;
      format: ImageFormat | 'unknown';
      isSvg: boolean;
      isUrl: false;
      isDataUrl: false;
      isBlobUrl: false;
    };

export interface DetectImageSourceInfoOptions {
  /** Blob MIME 타입이 비어 있거나 일반 타입일 때 앞부분을 읽어 SVG 여부를 확인할지 여부다. 기본값은 true다. */
  sniffSvgBlob?: boolean;
  /** SVG Blob 스니핑에 사용할 최대 바이트 수다. 기본값은 4096이다. */
  svgSniffBytes?: number;
}

const DEFAULT_SVG_SNIFF_BYTES = 4096;

const IMAGE_FORMAT_BY_EXTENSION: Record<string, ImageFormat> = {
  avif: 'avif',
  gif: 'gif',
  jpeg: 'jpeg',
  jpg: 'jpg',
  png: 'png',
  svg: 'svg',
  webp: 'webp',
};

/**
 * 문자열 이미지 소스의 경량 타입을 판정한다.
 *
 * 외부 리소스를 로드하거나 Data URL 본문을 디코딩하지 않고 문자열 형태만 확인한다.
 */
export function detectImageStringSourceType(source: string): ImageStringSourceType {
  const trimmed = source.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (isInlineSvg(trimmed)) {
    return 'inline-svg';
  }

  if (isSvgDataUrl(trimmed)) {
    return 'svg-data-url';
  }

  if (lowerTrimmed.startsWith('data:')) {
    return 'data-url';
  }

  if (lowerTrimmed.startsWith('http://') || lowerTrimmed.startsWith('https://')) {
    return 'http-url';
  }

  if (trimmed.startsWith('//')) {
    return 'protocol-relative-url';
  }

  if (lowerTrimmed.startsWith('blob:')) {
    return 'blob-url';
  }

  if (getFormatFromPath(trimmed) === 'svg') {
    return 'svg-path';
  }

  return 'path';
}

/**
 * 이미지 소스의 경량 타입을 판정한다.
 *
 * Blob 본문, 원격 URL, 파일 경로를 읽지 않는 동기 판정 함수다.
 */
export function detectImageSourceType(source: ImageSource): ImageSourceType {
  if (typeof source === 'string') {
    return detectImageStringSourceType(source);
  }

  if (isImageElementSource(source)) {
    return 'element';
  }

  if (isCanvasElementSource(source)) {
    return 'canvas';
  }

  if (isBlobSource(source)) {
    return isSvgBlobByMetadata(source) ? 'svg-blob' : 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'array-buffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8-array';
  }

  return 'blob';
}

/**
 * 문자열 이미지 소스의 상세 정보를 동기적으로 판정한다.
 *
 * URL은 fetch하지 않고, Data URL은 헤더만 파싱한다.
 */
export function detectImageStringSourceInfo(source: string): ImageStringSourceInfo {
  const type = detectImageStringSourceType(source);
  const trimmed = source.trim();
  const mimeType = parseDataUrlMimeType(trimmed);
  const isDataUrl = type === 'data-url' || type === 'svg-data-url';
  const isBlobUrl = type === 'blob-url';
  const isUrl = type === 'http-url' || type === 'protocol-relative-url';
  const dataUrlFormat = isDataUrl && mimeType ? mimeTypeToImageFormat(mimeType) : 'unknown';
  const canInferPathFormat = type === 'path' || type === 'svg-path' || isUrl;
  const pathFormat = canInferPathFormat ? getFormatFromPath(trimmed) : 'unknown';
  const format = dataUrlFormat !== 'unknown' ? dataUrlFormat : pathFormat;

  return {
    type,
    family: 'string',
    ...(mimeType ? { mimeType } : {}),
    format,
    isSvg: type === 'inline-svg' || type === 'svg-data-url' || format === 'svg',
    isUrl,
    isDataUrl,
    isBlobUrl,
  };
}

/**
 * 이미지 소스의 상세 정보를 판정한다.
 *
 * 원격 URL은 로드하지 않는다. Blob은 옵션이 허용할 때 앞부분만 읽어 SVG 여부를 보강한다.
 */
export async function detectImageSourceInfo(
  source: ImageSource,
  options: DetectImageSourceInfoOptions = {}
): Promise<ImageSourceInfo> {
  if (typeof source === 'string') {
    return detectImageStringSourceInfo(source);
  }

  if (isImageElementSource(source)) {
    return createNonStringSourceInfo('element', 'element', undefined, 'unknown', false);
  }

  if (isCanvasElementSource(source)) {
    return createNonStringSourceInfo('canvas', 'canvas', undefined, 'unknown', false);
  }

  if (isBlobSource(source)) {
    const mimeType = normalizeMimeType(source.type);
    const metadataFormat = getBlobMetadataFormat(source, mimeType);
    const shouldSniff = options.sniffSvgBlob ?? true;
    const sniffedSvg =
      shouldSniff && metadataFormat !== 'svg' && shouldSniffBlobForSvg(source, mimeType)
        ? await sniffSvgFromBlob(source, options.svgSniffBytes ?? DEFAULT_SVG_SNIFF_BYTES)
        : false;
    const isSvg = metadataFormat === 'svg' || sniffedSvg;
    const format = isSvg ? 'svg' : metadataFormat;

    return createNonStringSourceInfo(isSvg ? 'svg-blob' : 'blob', 'blob', mimeType || undefined, format, isSvg);
  }

  if (source instanceof ArrayBuffer) {
    return createNonStringSourceInfo('array-buffer', 'binary', undefined, 'unknown', false);
  }

  if (source instanceof Uint8Array) {
    return createNonStringSourceInfo('uint8-array', 'binary', undefined, 'unknown', false);
  }

  return createNonStringSourceInfo('blob', 'blob', undefined, 'unknown', false);
}

function createNonStringSourceInfo(
  type: Exclude<ImageSourceType, ImageStringSourceType>,
  family: 'element' | 'canvas' | 'blob' | 'binary',
  mimeType: string | undefined,
  format: ImageFormat | 'unknown',
  isSvg: boolean
): ImageSourceInfo {
  return {
    type,
    family,
    ...(mimeType ? { mimeType } : {}),
    format,
    isSvg,
    isUrl: false,
    isDataUrl: false,
    isBlobUrl: false,
  };
}

function isSvgDataUrl(source: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(source);
}

function parseDataUrlMimeType(source: string): string | undefined {
  if (!source.toLowerCase().startsWith('data:')) {
    return undefined;
  }

  const commaIndex = source.indexOf(',');
  const header = source.slice(5, commaIndex >= 0 ? commaIndex : undefined);
  const mimeType = normalizeMimeType(header.split(';', 1)[0] ?? '');

  return mimeType || undefined;
}

function getFormatFromPath(source: string): ImageFormat | 'unknown' {
  const pathname = getPathnameWithoutSuffix(source);
  const extension = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  return extension ? (IMAGE_FORMAT_BY_EXTENSION[extension] ?? 'unknown') : 'unknown';
}

function getPathnameWithoutSuffix(source: string): string {
  try {
    const url = source.startsWith('//') ? new URL(source, 'https://example.local') : new URL(source);
    return url.pathname;
  } catch {
    return source.split('#', 1)[0]?.split('?', 1)[0] ?? source;
  }
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function getBlobMetadataFormat(blob: Blob, mimeType: string): ImageFormat | 'unknown' {
  const mimeFormat = mimeType ? mimeTypeToImageFormat(mimeType) : 'unknown';

  if (mimeFormat !== 'unknown') {
    return mimeFormat;
  }

  return typeof (blob as File).name === 'string' ? getFormatFromPath((blob as File).name) : 'unknown';
}

function isSvgBlobByMetadata(blob: Blob): boolean {
  return getBlobMetadataFormat(blob, normalizeMimeType(blob.type)) === 'svg';
}

function shouldSniffBlobForSvg(blob: Blob, mimeType: string): boolean {
  if (!canReadBlobText(blob)) {
    return false;
  }

  return (
    mimeType === '' || mimeType === 'application/octet-stream' || mimeType === 'text/plain' || isXmlMimeType(mimeType)
  );
}

function isXmlMimeType(mimeType: string): boolean {
  return mimeType === 'text/xml' || mimeType === 'application/xml' || mimeType.endsWith('+xml');
}

async function sniffSvgFromBlob(blob: Blob, bytes: number): Promise<boolean> {
  try {
    return isInlineSvg(await blob.slice(0, Math.max(0, bytes)).text());
  } catch {
    return false;
  }
}

function isImageElementSource(source: unknown): source is HTMLImageElement {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return true;
  }

  return isObject(source) && getTagName(source) === 'IMG';
}

function isCanvasElementSource(source: unknown): source is HTMLCanvasElement {
  if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) {
    return true;
  }

  return (
    isObject(source) &&
    getTagName(source) === 'CANVAS' &&
    'getContext' in source &&
    typeof source.getContext === 'function' &&
    'toDataURL' in source &&
    typeof source.toDataURL === 'function'
  );
}

function isBlobSource(source: unknown): source is Blob {
  if (typeof Blob !== 'undefined' && source instanceof Blob) {
    return true;
  }

  return (
    isObject(source) &&
    'type' in source &&
    typeof source.type === 'string' &&
    'size' in source &&
    typeof source.size === 'number' &&
    ('slice' in source || 'arrayBuffer' in source)
  );
}

function canReadBlobText(blob: Blob): boolean {
  return typeof blob.slice === 'function' && typeof blob.slice(0, 0).text === 'function';
}

function getTagName(source: object): string {
  return 'tagName' in source && typeof source.tagName === 'string' ? source.tagName.toUpperCase() : '';
}

function isObject(source: unknown): source is Record<string, unknown> {
  return typeof source === 'object' && source !== null;
}
