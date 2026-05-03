import { convertToImageElement, detectSourceType } from '../core/source-converter';
import type { ImageFormat, ImageSource } from '../types';
import { ImageFormats, ImageProcessError } from '../types';
import { isInlineSvg } from './svg-detection';
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

/** 네트워크 조회 기반 이미지 포맷 판정 옵션이다. */
export interface FetchImageFormatOptions {
  /** 응답 앞부분에서 읽을 최대 바이트 수다. 기본값은 4096이다. */
  sniffBytes?: number;
  /** fetch 요청에 전달할 추가 옵션이다. `method`는 본문 스니핑을 위해 항상 GET으로 고정된다. */
  fetchOptions?: Omit<RequestInit, 'body' | 'method'>;
}

export interface FetchImageSourceBlobOptions {
  allowedProtocols?: string[];
  maxBytes?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  fetchOptions?: Omit<RequestInit, 'body' | 'method' | 'signal'>;
}

export interface FetchImageSourceBlobResult {
  blob: Blob;
  bytes: number;
  contentType: string;
  url: string;
  responseUrl: string;
  status: number;
}

/** 이미지 치수 기준 방향 값이다. */
export type ImageOrientation = 'landscape' | 'portrait' | 'square';

const DEFAULT_FORMAT_SNIFF_BYTES = 4096;
const DEFAULT_FETCH_SOURCE_PROTOCOLS = ['http:', 'https:'];

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

/** 문자열 소스가 fetch로 조회 가능한 형태인지 판정한다. */
function canFetchStringSource(source: string): boolean {
  const trimmed = source.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.length === 0 || lower.startsWith('data:') || isInlineSvg(trimmed)) {
    return false;
  }

  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('blob:') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  );
}

/** Response 본문 앞부분만 읽어 포맷 스니핑에 필요한 바이트를 반환한다. */
async function readResponsePrefix(response: Response, bytes: number): Promise<Uint8Array> {
  const byteLimit = Math.max(0, bytes);
  if (byteLimit === 0) {
    return new Uint8Array();
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer, 0, Math.min(buffer.byteLength, byteLimit));
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let shouldCancelReader = false;

  try {
    while (totalBytes < byteLimit) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const remainingBytes = byteLimit - totalBytes;
      const chunk = value.byteLength > remainingBytes ? value.slice(0, remainingBytes) : value;
      chunks.push(chunk);
      totalBytes += chunk.byteLength;

      if (value.byteLength > remainingBytes) {
        shouldCancelReader = true;
        break;
      }
    }

    if (totalBytes >= byteLimit) {
      shouldCancelReader = true;
    }

    if (shouldCancelReader) {
      try {
        await reader.cancel();
      } catch {
        // 스트림 정리 실패는 이미 읽은 prefix 기반 포맷 판정을 무효화하지 않는다.
      }
    }
  } finally {
    reader.releaseLock();
  }

  const prefix = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    prefix.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return prefix;
}

/** 응답 MIME과 본문 앞부분을 조합해 실제 이미지 포맷을 판정한다. */
function formatFromResponsePrefix(bytes: Uint8Array, contentType: string): ImageInfo['format'] {
  const byteFormat = formatFromBytes(bytes);
  if (byteFormat !== 'unknown') {
    return byteFormat;
  }

  const text = new TextDecoder().decode(bytes);
  if (isInlineSvg(text)) {
    return ImageFormats.SVG;
  }

  return formatFromMimeType(contentType);
}

function assertFetchSourceProtocol(source: string, allowedProtocols: string[]): void {
  let url: URL;

  try {
    url = new URL(source);
  } catch (error) {
    throw new ImageProcessError(`유효한 URL이 아닙니다: ${source}`, 'INVALID_SOURCE', error as Error);
  }

  if (!allowedProtocols.includes(url.protocol)) {
    throw new ImageProcessError(
      `허용되지 않는 프로토콜입니다: ${url.protocol}. 허용 목록: ${allowedProtocols.join(', ')}`,
      'INVALID_SOURCE'
    );
  }
}

function createFetchSourceAbortSignal(
  timeoutMs: number | undefined,
  abortSignal: AbortSignal | undefined
): AbortSignal | undefined {
  if ((timeoutMs === undefined || timeoutMs === 0) && !abortSignal) {
    return undefined;
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const abort = () => controller.abort();

  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort();
    } else {
      abortSignal.addEventListener('abort', abort, { once: true });
    }
  }

  if (timeoutMs !== undefined && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  controller.signal.addEventListener(
    'abort',
    () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      abortSignal?.removeEventListener('abort', abort);
    },
    { once: true }
  );

  return controller.signal;
}

function sanitizeFetchSourceOptions(
  fetchOptions: FetchImageSourceBlobOptions['fetchOptions'] | undefined
): Omit<RequestInit, 'body' | 'method' | 'signal'> {
  if (!fetchOptions) return {};

  const { body: _body, method: _method, signal: _signal, ...safeOptions } = fetchOptions as RequestInit;
  return safeOptions;
}

function throwSourceBytesExceeded(message: string): never {
  throw new ImageProcessError(message, 'SOURCE_BYTES_EXCEEDED');
}

function wrapFetchSourceBodyReadError(error: unknown): never {
  if (error instanceof ImageProcessError && error.code === 'SOURCE_BYTES_EXCEEDED') {
    throw error;
  }

  throw new ImageProcessError('이미지 URL 응답 본문을 읽을 수 없습니다', 'SOURCE_LOAD_FAILED', error as Error);
}

function checkFetchSourceContentLength(response: Response, maxBytes: number, label: string): void {
  if (maxBytes === 0) return;

  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) return;

  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength)) return;

  if (contentLength > maxBytes) {
    throwSourceBytesExceeded(
      `${label} 응답 크기(${contentLength} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`
    );
  }
}

async function readFetchSourceBlob(
  response: Response,
  maxBytes: number,
  label: string
): Promise<{ blob: Blob; bytes: number }> {
  checkFetchSourceContentLength(response, maxBytes, label);

  if (!response.body) {
    let blob: Blob;

    try {
      blob = await response.blob();
    } catch (error) {
      wrapFetchSourceBodyReadError(error);
    }

    if (maxBytes > 0 && blob.size > maxBytes) {
      throwSourceBytesExceeded(
        `${label} 응답 크기(${blob.size} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`
      );
    }

    return { blob, bytes: blob.size };
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;

      if (maxBytes > 0 && totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // 크기 초과 오류가 public contract이므로 스트림 정리 실패가 이를 가리지 않게 한다.
        }

        throwSourceBytesExceeded(
          `${label} 응답 크기(${totalBytes} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`
        );
      }

      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    wrapFetchSourceBodyReadError(error);
  } finally {
    reader.releaseLock();
  }

  const contentType = response.headers.get('content-type') ?? '';
  return {
    blob: new Blob(chunks, { type: contentType }),
    bytes: totalBytes,
  };
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

/** 이미지 소스의 입력 포맷을 반환한다. */
export async function getImageFormat(source: ImageSource): Promise<ImageInfo['format']> {
  return detectImageFormat(source);
}

/**
 * URL 또는 브라우저 경로 응답을 fetch해 실제 이미지 포맷을 판정한다.
 *
 * @description 확장자 힌트는 사용하지 않고 응답의 Content-Type과 앞부분 바이트/SVG 텍스트 루트를 확인한다.
 * fetch 대상이 아니거나 응답을 읽을 수 없거나 포맷을 알 수 없으면 `unknown`을 반환한다.
 */
export async function fetchImageFormat(
  source: string,
  options: FetchImageFormatOptions = {}
): Promise<ImageInfo['format']> {
  if (!canFetchStringSource(source)) {
    return 'unknown';
  }

  try {
    const response = await fetch(source.trim(), {
      ...options.fetchOptions,
      method: 'GET',
    });

    if (!response.ok) {
      return 'unknown';
    }

    const contentType = response.headers.get('content-type') ?? '';
    const prefix = await readResponsePrefix(response, options.sniffBytes ?? DEFAULT_FORMAT_SNIFF_BYTES);

    return formatFromResponsePrefix(prefix, contentType);
  } catch {
    return 'unknown';
  }
}

export async function fetchImageSourceBlob(
  source: string,
  options: FetchImageSourceBlobOptions = {}
): Promise<FetchImageSourceBlobResult> {
  const url = source.trim();
  const allowedProtocols = options.allowedProtocols ?? DEFAULT_FETCH_SOURCE_PROTOCOLS;
  const maxBytes = options.maxBytes ?? 100 * 1024 * 1024;

  assertFetchSourceProtocol(url, allowedProtocols);

  const signal = createFetchSourceAbortSignal(options.timeoutMs, options.abortSignal);

  let response: Response;
  try {
    response = await fetch(url, {
      ...sanitizeFetchSourceOptions(options.fetchOptions),
      method: 'GET',
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    throw new ImageProcessError('이미지 URL을 fetch할 수 없습니다', 'SOURCE_LOAD_FAILED', error as Error);
  }

  if (!response.ok) {
    throw new ImageProcessError(`Failed to load URL: ${response.status}`, 'SOURCE_LOAD_FAILED');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const { blob, bytes } = await readFetchSourceBlob(response, maxBytes, '이미지 URL');

  return {
    blob,
    bytes,
    contentType,
    url,
    responseUrl: response.url || url,
    status: response.status,
  };
}

/** 이미지 소스의 가로/세로 비율을 반환한다. */
export async function getImageAspectRatio(source: ImageSource): Promise<number> {
  const { width, height } = await getImageDimensions(source);
  return width / height;
}

/** 이미지 소스의 치수 기준 방향을 반환한다. */
export async function getImageOrientation(source: ImageSource): Promise<ImageOrientation> {
  const { width, height } = await getImageDimensions(source);

  if (width === height) {
    return 'square';
  }

  return width > height ? 'landscape' : 'portrait';
}

/**
 * 이미지 소스의 치수와 입력 포맷을 반환한다.
 *
 * @description 포맷은 MIME, Data URL 헤더, 경로 확장자, 바이너리 시그니처 순으로 필요한 만큼만
 * 확인한다. 치수 확인은 `getImageDimensions()`와 같은 fast path를 공유해 이미지 로딩을 중복하지 않는다.
 */
export async function getImageInfo(source: ImageSource): Promise<ImageInfo> {
  const format = await getImageFormat(source);
  const dimensions = await getImageDimensions(source);

  return {
    ...dimensions,
    format,
  };
}
