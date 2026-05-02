import type { ImageFormat, OutputFormat, OutputOptions } from '../types';

export type ImageFormatOrUnknown = ImageFormat | 'unknown';

export interface OutputFilenameOptions extends Pick<OutputOptions, 'format'> {
  /** 출력 포맷 확장자를 자동으로 반영할지 여부 */
  autoExtension?: boolean;
}

export interface ResolveOutputFormatOptions {
  /** 선택 우선순위를 걸러낼 지원 포맷 목록. 후보가 모두 제외되면 최종 안전값으로 png를 반환한다. */
  supported?: readonly OutputFormat[];
  /** 선호 포맷을 사용할 수 없을 때 우선 적용할 대체 포맷 */
  fallback?: OutputFormat;
}

const IMAGE_FORMAT_BY_MIME_TYPE: Record<string, ImageFormatOrUnknown> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const MIME_TYPE_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const OUTPUT_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif'] as const satisfies readonly OutputFormat[];
const DEFAULT_OUTPUT_FALLBACK_ORDER = ['webp', 'jpeg', 'png'] as const satisfies readonly OutputFormat[];

/**
 * 이미지 포맷 식별자를 브라우저 Canvas/File API에서 사용하는 MIME 타입으로 변환한다.
 */
export function formatToMimeType(format: ImageFormat | OutputFormat): string {
  return MIME_TYPE_BY_FORMAT[format] ?? 'image/png';
}

/**
 * MIME 타입에서 이미지 포맷을 판정한다.
 *
 * 대소문자와 `charset` 같은 MIME 파라미터 차이를 흡수한다.
 */
export function mimeTypeToImageFormat(mimeType: string): ImageFormatOrUnknown {
  const normalizedMimeType = normalizeMimeType(mimeType);

  return IMAGE_FORMAT_BY_MIME_TYPE[normalizedMimeType] ?? 'unknown';
}

/**
 * MIME 타입을 Canvas 출력 가능한 포맷으로 변환한다.
 */
export function mimeTypeToOutputFormat(mimeType: string): OutputFormat | undefined {
  const format = mimeTypeToImageFormat(mimeType);

  return isSupportedOutputFormat(format) ? normalizeOutputFormat(format) : undefined;
}

/**
 * 값이 Canvas 출력 포맷인지 판정한다.
 */
export function isSupportedOutputFormat(format: unknown): format is OutputFormat {
  return typeof format === 'string' && OUTPUT_FORMATS.includes(format as OutputFormat);
}

/**
 * 파일명에서 쿼리와 해시를 제거한 뒤 마지막 확장자를 출력 포맷 확장자로 교체한다.
 */
export function replaceImageExtension(filename: string, format: OutputFormat): string {
  const cleanFilename = stripFilenameSuffix(filename);
  const lastSlashIndex = Math.max(cleanFilename.lastIndexOf('/'), cleanFilename.lastIndexOf('\\'));
  const lastDotIndex = cleanFilename.lastIndexOf('.');
  const hasExtension = lastDotIndex > lastSlashIndex + 1;
  const basename = hasExtension ? cleanFilename.slice(0, lastDotIndex) : cleanFilename;

  return `${basename}.${format}`;
}

/**
 * 출력 옵션에 맞춰 최종 파일명을 계산한다.
 */
export function getOutputFilename(filename: string, options: OutputFilenameOptions = {}): string {
  if (options.autoExtension === false || !options.format) {
    return filename;
  }

  return replaceImageExtension(filename, options.format);
}

/**
 * 선호 포맷과 지원 목록을 기준으로 실제 출력 포맷을 결정한다.
 *
 * `supported`는 선호 포맷, 대체 포맷, 기본 우선순위(webp, jpeg, png)를 고르는 데 사용한다.
 * 지원 목록 안에서 후보를 찾지 못하면 Canvas 호환성이 가장 넓은 png를 최종 폴백으로 반환한다.
 */
export function resolveOutputFormat(preferred: OutputFormat, options: ResolveOutputFormatOptions = {}): OutputFormat {
  const supported = options.supported ?? OUTPUT_FORMATS;

  if (supported.includes(preferred)) {
    return preferred;
  }

  if (options.fallback && supported.includes(options.fallback)) {
    return options.fallback;
  }

  return DEFAULT_OUTPUT_FALLBACK_ORDER.find((format) => supported.includes(format)) ?? 'png';
}

/**
 * MIME 타입 비교를 위해 파라미터를 제거하고 소문자로 정규화한다.
 */
function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

/**
 * 출력 포맷 별칭은 공개 API 관례에 맞춰 정규 포맷으로 맞춘다.
 */
function normalizeOutputFormat(format: OutputFormat): OutputFormat {
  return format === 'jpg' ? 'jpeg' : format;
}

/**
 * 파일명으로 취급하지 않는 URL 쿼리와 해시 영역을 제거한다.
 */
function stripFilenameSuffix(filename: string): string {
  const queryIndex = filename.indexOf('?');
  const hashIndex = filename.indexOf('#');
  const suffixIndexes = [queryIndex, hashIndex].filter((index) => index >= 0);

  if (suffixIndexes.length === 0) {
    return filename;
  }

  return filename.slice(0, Math.min(...suffixIndexes));
}
