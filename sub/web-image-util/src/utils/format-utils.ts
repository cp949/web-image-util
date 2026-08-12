import type { ImageFormat, OutputFormat, OutputOptions } from '../types';
import { normalizeMimeType } from './source-utils/mime.internal';

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

/** 포맷 → MIME 정본 테이블. 라이브러리의 다른 포맷↔MIME 매핑은 이 테이블의 소비자다. */
export const MIME_TYPE_BY_FORMAT: Record<ImageFormat, string> = {
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
 * 파일명 확장자에서 출력 포맷을 판정한다.
 *
 * 쿼리·해시를 제거한 뒤 마지막 확장자를 읽는다. Canvas 출력 포맷이 아닌 확장자
 * (`.txt`, `.gif`, `.svg`)와 확장자 없는 파일명은 `undefined`를 반환한다.
 * `jpg`는 `jpeg`로 정규화한다.
 */
export function outputFormatFromFilename(filename: string): OutputFormat | undefined {
  const { extension } = splitFilenameExtension(stripFilenameSuffix(filename));

  return isSupportedOutputFormat(extension) ? normalizeOutputFormat(extension) : undefined;
}

/**
 * 파일명에서 쿼리와 해시를 제거한 뒤 마지막 확장자를 출력 포맷 확장자로 교체한다.
 *
 * 라이브러리의 파일명 확장자 정책 정본이다 — `ensureFile`과 `toFile`이 모두 이 함수를 거친다.
 *
 * - 기존 확장자가 이미 같은 포맷을 가리키면 표기를 보존한다 (`photo.jpeg` + `jpeg` → `photo.jpeg`).
 * - 그 외에는 마지막 확장자를 권장 확장자로 교체한다. 이미지 확장자가 아니어도 교체한다
 *   (`photo.txt` + `png` → `photo.png`).
 * - 확장자가 없으면 권장 확장자를 덧붙인다.
 */
export function replaceImageExtension(filename: string, format: OutputFormat): string {
  const cleanFilename = stripFilenameSuffix(filename);
  const { basename, extension } = splitFilenameExtension(cleanFilename);

  if (isSupportedOutputFormat(extension) && normalizeOutputFormat(extension) === normalizeOutputFormat(format)) {
    return cleanFilename;
  }

  return `${basename}.${getCanonicalExtension(format)}`;
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
 * 출력 포맷 별칭은 공개 API 관례에 맞춰 정규 포맷으로 맞춘다.
 */
function normalizeOutputFormat(format: OutputFormat): OutputFormat {
  return format === 'jpg' ? 'jpeg' : format;
}

/**
 * 출력 포맷의 권장 파일 확장자를 반환한다. JPEG 계열은 웹 관례에 맞춰 `jpg`로 통일한다.
 */
function getCanonicalExtension(format: OutputFormat): string {
  return normalizeOutputFormat(format) === 'jpeg' ? 'jpg' : format;
}

/**
 * 쿼리·해시를 제거한 파일명을 basename과 확장자(소문자, 점 제외)로 나눈다.
 *
 * 디렉터리 구분자 뒤 첫 글자가 점인 경우(`.hidden`, `dir/.gitignore`)는 확장자로 보지 않는다.
 */
function splitFilenameExtension(cleanFilename: string): { basename: string; extension?: string } {
  const lastSlashIndex = Math.max(cleanFilename.lastIndexOf('/'), cleanFilename.lastIndexOf('\\'));
  const lastDotIndex = cleanFilename.lastIndexOf('.');

  if (lastDotIndex <= lastSlashIndex + 1) {
    return { basename: cleanFilename };
  }

  return {
    basename: cleanFilename.slice(0, lastDotIndex),
    extension: cleanFilename.slice(lastDotIndex + 1).toLowerCase(),
  };
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
