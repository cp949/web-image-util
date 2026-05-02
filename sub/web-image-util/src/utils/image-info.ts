import { convertToImageElement, detectSourceType } from '../core/source-converter';
import type { ImageFormat, ImageSource } from '../types';
import { ImageFormats } from '../types';
import { extractSvgDimensions } from './svg-dimensions';

/** 이미지 치수 정보다. */
export interface ImageDimensions {
  width: number;
  height: number;
}

/** 입력 이미지에서 확인한 치수와 포맷 정보다. */
export interface ImageInfo extends ImageDimensions {
  /** 입력에서 확인한 이미지 포맷이다. DOM 요소처럼 원본 포맷을 알 수 없으면 `unknown`이다. */
  format: ImageFormat | 'unknown';
}

/** MIME 타입을 공개 이미지 포맷 값으로 변환한다. */
function formatFromMimeType(mimeType: string): ImageInfo['format'] {
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
function formatFromPath(input: string): ImageInfo['format'] {
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
function formatFromDataUrl(input: string): ImageInfo['format'] {
  const header = input.slice(0, input.indexOf(','));
  const match = header.match(/^data:([^;,]+)/i);
  return match ? formatFromMimeType(match[1]) : 'unknown';
}

/** 바이너리 시그니처에서 이미지 포맷을 가볍게 판정한다. */
function formatFromBytes(bytes: Uint8Array): ImageInfo['format'] {
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

/** 이미지 요소가 이미 가진 치수 값을 읽는다. */
function dimensionsFromElement(element: HTMLImageElement): ImageDimensions {
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}

/** 캔버스가 가진 치수 값을 읽는다. */
function dimensionsFromCanvas(canvas: HTMLCanvasElement): ImageDimensions {
  return {
    width: canvas.width,
    height: canvas.height,
  };
}

/** SVG 문자열이면 파싱 기반 치수를 반환하고, 아니면 undefined를 반환한다. */
function tryGetInlineSvgDimensions(source: ImageSource): ImageDimensions | undefined {
  if (typeof source !== 'string' || detectSourceType(source) !== 'svg') {
    return undefined;
  }

  const trimmed = source.trim();
  if (trimmed.startsWith('data:') || formatFromPath(trimmed) === ImageFormats.SVG) {
    return undefined;
  }

  const dimensions = extractSvgDimensions(source);
  return {
    width: dimensions.width,
    height: dimensions.height,
  };
}

/** MIME 또는 파일명으로 SVG가 확인된 Blob이면 원본 SVG 치수를 반환한다. */
async function tryGetSvgBlobDimensions(source: ImageSource): Promise<ImageDimensions | undefined> {
  if (!(source instanceof Blob) || detectSourceType(source) !== 'svg') {
    return undefined;
  }

  const dimensions = extractSvgDimensions(await source.text());
  return {
    width: dimensions.width,
    height: dimensions.height,
  };
}

/** Blob/File에서 추가 로딩 없이 알 수 있는 포맷 힌트를 얻는다. */
function formatFromBlobMetadata(blob: Blob): ImageInfo['format'] {
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

/**
 * 이미지 소스의 치수를 반환한다.
 *
 * @description `processImage()`와 같은 입력 타입을 받으며, 이미 치수를 가진 캔버스와 이미지 요소는
 * 변환 없이 바로 읽는다. SVG 문자열은 기존 SVG 치수 파서를 사용하고, 나머지는 기존 소스 변환 경로를
 * 통해 안전하게 로드한 뒤 치수를 확인한다.
 */
export async function getImageDimensions(source: ImageSource): Promise<ImageDimensions> {
  if (source instanceof HTMLCanvasElement) {
    return dimensionsFromCanvas(source);
  }

  if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) {
    return dimensionsFromElement(source);
  }

  const svgDimensions = tryGetInlineSvgDimensions(source);
  if (svgDimensions) {
    return svgDimensions;
  }

  const svgBlobDimensions = await tryGetSvgBlobDimensions(source);
  if (svgBlobDimensions) {
    return svgBlobDimensions;
  }

  const element = await convertToImageElement(source);
  return dimensionsFromElement(element);
}

/**
 * 이미지 소스의 치수와 입력 포맷을 반환한다.
 *
 * @description 포맷은 MIME, Data URL 헤더, 경로 확장자, 바이너리 시그니처 순으로 필요한 만큼만
 * 확인한다. 치수 확인은 `getImageDimensions()`와 같은 fast path를 공유해 이미지 로딩을 중복하지 않는다.
 */
export async function getImageInfo(source: ImageSource): Promise<ImageInfo> {
  const format = await detectImageFormat(source);
  const dimensions = await getImageDimensions(source);

  return {
    ...dimensions,
    format,
  };
}
