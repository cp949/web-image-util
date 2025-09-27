/**
 * 타입 가드 함수들
 *
 * @description 런타임에서 타입을 안전하게 검증하는 함수들
 * TypeScript의 타입 narrowing을 지원하여 컴파일 타임 안전성 향상
 */

import type { ImageSource, ImageFormat, ResizeFit, ResizePosition, ResizeBackground } from './base';

// 순환 import 방지를 위해 상수 직접 정의
const VALID_RESIZE_FITS = ['cover', 'contain', 'fill', 'inside', 'outside'] as const;
const VALID_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'svg'] as const;

const VALID_POSITION_STRINGS = new Set([
  'center',
  'centre',
  'top',
  'right',
  'bottom',
  'left',
  'top left',
  'top right',
  'bottom left',
  'bottom right',
  'left top',
  'right top',
  'left bottom',
  'right bottom',
]);

// CSS 색상 정규식 - 간단하고 실용적인 버전
const CSS_COLOR_REGEX = /^(#[0-9a-f]{3,8}|rgb|rgba|hsl|hsla|[a-z])/i;

// 타입 가드 헬퍼 함수들
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}

function isValidRGBValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 255;
}

// DOM 타입 가드들
/**
 * HTMLImageElement 타입 가드
 *
 * @param value 검사할 값
 * @returns HTMLImageElement 여부
 */
export function isImageElement(value: unknown): value is HTMLImageElement {
  return value instanceof HTMLImageElement;
}

/**
 * HTMLCanvasElement 타입 가드
 *
 * @param value 검사할 값
 * @returns HTMLCanvasElement 여부
 */
export function isCanvasElement(value: unknown): value is HTMLCanvasElement {
  return value instanceof HTMLCanvasElement;
}

/**
 * Blob 타입 가드
 *
 * @param value 검사할 값
 * @returns Blob 여부
 */
export function isBlob(value: unknown): value is Blob {
  return value instanceof Blob;
}

/**
 * File 타입 가드
 *
 * @param value 검사할 값
 * @returns File 여부
 */
export function isFile(value: unknown): value is File {
  return value instanceof File;
}

/**
 * Uint8Array 타입 가드
 *
 * @param value 검사할 값
 * @returns Uint8Array 여부
 */
export function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

/**
 * ArrayBuffer 타입 가드
 *
 * @param value 검사할 값
 * @returns ArrayBuffer 여부
 */
export function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

// 문자열 타입 가드들
/**
 * Data URL 문자열 타입 가드
 *
 * @param value 검사할 값
 * @returns Data URL 문자열 여부
 * @example
 * ```typescript
 * isDataURL('data:image/png;base64,iVBOR...') // true
 * isDataURL('http://example.com/image.jpg') // false
 * ```
 */
export function isDataURL(value: unknown): value is string {
  return isNonEmptyString(value) && value.startsWith('data:image/');
}

/**
 * HTTP/HTTPS URL 문자열 타입 가드
 *
 * @param value 검사할 값
 * @returns HTTP/HTTPS URL 문자열 여부
 * @example
 * ```typescript
 * isHttpURL('https://example.com/image.jpg') // true
 * isHttpURL('ftp://example.com/file.txt') // false
 * ```
 */
export function isHttpURL(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * SVG 문자열 타입 가드
 *
 * @param value 검사할 값
 * @returns SVG 문자열 여부
 * @description XML 선언이 있는 SVG와 직접 <svg 태그로 시작하는 SVG 모두 지원
 * @example
 * ```typescript
 * isSVGString('<svg><circle r="40"/></svg>') // true
 * isSVGString('<?xml version="1.0"?><svg>...</svg>') // true
 * isSVGString('<?xml version="1.0"?><div>...</div>') // false
 * ```
 */
export function isSVGString(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;

  const trimmed = value.trim();

  // SVG 태그가 있고 닫는 태그도 있어야 함
  if (!trimmed.includes('<svg') || !trimmed.includes('</svg>')) {
    return false;
  }

  // 1. 직접 <svg로 시작하는 경우
  if (trimmed.startsWith('<svg')) {
    return true;
  }

  // 2. XML 선언으로 시작하는 경우 - 선언 이후 첫 번째 태그가 <svg여야 함
  if (trimmed.startsWith('<?xml')) {
    const afterXmlDeclaration = trimmed.replace(/^<\?xml[^>]*\?>\s*/, '');
    return afterXmlDeclaration.startsWith('<svg');
  }

  return false;
}

// 합성 타입 가드들
/**
 * 유효한 이미지 소스 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ImageSource 여부
 * @description HTMLImageElement, Blob, Data URL, HTTP URL, SVG 문자열, 파일 경로 등을 지원
 * @example
 * ```typescript
 * if (isValidImageSource(userInput)) {
 *   // userInput이 ImageSource 타입으로 narrowing됨
 *   const result = await processImage(userInput);
 * }
 * ```
 */
export function isValidImageSource(value: unknown): value is ImageSource {
  return (
    isImageElement(value) ||
    isBlob(value) ||
    isDataURL(value) ||
    isHttpURL(value) ||
    isSVGString(value) ||
    isNonEmptyString(value) // 파일 경로 등
  );
}

/**
 * 유효한 리사이즈 fit 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ResizeFit 여부
 * @description cover, contain, fill, inside, outside 값 지원
 */
export function isValidResizeFit(value: unknown): value is ResizeFit {
  return isNonEmptyString(value) && VALID_RESIZE_FITS.includes(value as ResizeFit);
}

/**
 * 유효한 리사이즈 위치 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ResizePosition 여부
 * @description 문자열('center', 'top' 등), 숫자(0-100), 객체({x, y}) 형태 지원
 * @example
 * ```typescript
 * isValidResizePosition('center') // true
 * isValidResizePosition(50) // true
 * isValidResizePosition({x: 25, y: 75}) // true
 * ```
 */
export function isValidResizePosition(value: unknown): value is ResizePosition {
  // 숫자 (0-100 범위)
  if (isNumberInRange(value, 0, 100)) {
    return true;
  }

  // 문자열 위치
  if (isNonEmptyString(value) && VALID_POSITION_STRINGS.has(value)) {
    return true;
  }

  // 객체 {x, y} 형태
  if (typeof value === 'object' && value !== null) {
    const pos = value as Record<string, unknown>;
    return isNumberInRange(pos.x, 0, 100) && isNumberInRange(pos.y, 0, 100) && Object.keys(pos).length === 2;
  }

  return false;
}

/**
 * 유효한 배경색 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ResizeBackground 여부
 * @description CSS 색상 문자열(hex, rgb, hsl 등) 또는 RGB 객체 형태 지원
 * @example
 * ```typescript
 * isValidBackgroundColor('#ffffff') // true
 * isValidBackgroundColor('red') // true
 * isValidBackgroundColor({r: 255, g: 0, b: 0}) // true
 * ```
 */
export function isValidBackgroundColor(value: unknown): value is ResizeBackground {
  // CSS 색상 문자열
  if (isNonEmptyString(value)) {
    return value === 'transparent' || CSS_COLOR_REGEX.test(value);
  }

  // RGB 객체
  if (typeof value === 'object' && value !== null) {
    const color = value as Record<string, unknown>;
    const hasValidRGB = isValidRGBValue(color.r) && isValidRGBValue(color.g) && isValidRGBValue(color.b);

    if (!hasValidRGB) return false;

    // alpha는 선택적이지만, 있다면 0-1 범위여야 함
    if (color.alpha !== undefined) {
      return isNumberInRange(color.alpha, 0, 1);
    }

    return true;
  }

  return false;
}

/**
 * 유효한 이미지 포맷 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ImageFormat 여부
 * @description jpeg, jpg, png, webp, avif, gif, svg 포맷 지원
 */
export function isValidImageFormat(value: unknown): value is ImageFormat {
  return isNonEmptyString(value) && VALID_IMAGE_FORMATS.includes(value.toLowerCase() as ImageFormat);
}

/**
 * 유효한 출력 포맷 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 출력 포맷 여부
 * @description jpeg, png, webp 등 브라우저에서 출력 가능한 포맷 지원
 */
export function isOutputFormat(value: unknown): value is 'jpeg' | 'png' | 'webp' {
  const outputFormats = ['jpeg', 'png', 'webp'] as const;
  return isNonEmptyString(value) && outputFormats.includes(value.toLowerCase() as any);
}

/**
 * ImageSource 타입 가드
 */
export function isImageSource(value: unknown): value is ImageSource {
  return (
    isImageElement(value) ||
    isCanvasElement(value) ||
    isBlob(value) ||
    isArrayBuffer(value) ||
    isUint8Array(value) ||
    isNonEmptyString(value)
  );
}

// 별칭 함수들 (테스트 호환성)
export const isHTMLImageElement = isImageElement;
export const isHTMLCanvasElement = isCanvasElement;

/**
 * 유효한 품질 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 품질 값(0.0-1.0) 여부
 * @description 이미지 압축 품질을 나타내는 0.0~1.0 범위의 숫자
 */
export function isValidQuality(value: unknown): value is number {
  return isNumberInRange(value, 0, 1);
}

/**
 * 유효한 차원(크기) 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 차원 값(양수) 여부
 * @description 이미지의 width, height 등에 사용되는 양의 정수
 */
export function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// 검증 결과 인터페이스
/**
 * 옵션 검증 결과 인터페이스
 *
 * @interface ValidationResult
 * @property isValid 전체 검증 결과 (에러가 없으면 true)
 * @property errors 에러 메시지 배열
 * @property warnings 경고 메시지 배열
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

// ValidationResult 팩토리 함수
function createValidationResult(): {
  errors: string[];
  warnings: string[];
  build(): ValidationResult;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  return {
    errors,
    warnings,
    build(): ValidationResult {
      return {
        isValid: errors.length === 0,
        errors: Object.freeze([...errors]),
        warnings: Object.freeze([...warnings]),
      };
    },
  };
}

// 옵션 검증 함수들
/**
 * 리사이즈 옵션 검증
 *
 * @param options 검증할 옵션 객체
 * @returns 검증 결과
 * @description width, height, fit, position, background 옵션들을 검증하고 에러와 경고 메시지를 반환
 */
export function validateResizeOptions(options: any): ValidationResult {
  const result = createValidationResult();

  // 필수 검증들
  if (options.width !== undefined && !isValidDimension(options.width)) {
    result.errors.push('width는 양의 정수여야 합니다');
  }

  if (options.height !== undefined && !isValidDimension(options.height)) {
    result.errors.push('height는 양의 정수여야 합니다');
  }

  if (options.fit !== undefined && !isValidResizeFit(options.fit)) {
    result.errors.push(`fit은 다음 중 하나여야 합니다: ${VALID_RESIZE_FITS.join(', ')}`);
  }

  if (options.position !== undefined && !isValidResizePosition(options.position)) {
    result.errors.push('position은 유효한 위치 값이어야 합니다 (문자열, 숫자 0-100, 또는 {x, y} 객체)');
  }

  if (options.background !== undefined && !isValidBackgroundColor(options.background)) {
    result.errors.push('background는 유효한 색상 값이어야 합니다 (CSS 색상 문자열 또는 RGB 객체)');
  }

  // 경고들
  if (!options.width && !options.height) {
    result.warnings.push('width와 height가 모두 지정되지 않았습니다');
  }

  // 대용량 이미지 경고 (논리 수정)
  const hasLargeDimension = (options.width && options.width > 4096) || (options.height && options.height > 4096);
  if (hasLargeDimension) {
    result.warnings.push('매우 큰 이미지 크기입니다. 메모리 사용량에 주의하세요');
  }

  return result.build();
}

/**
 * 출력 옵션 검증
 *
 * @param options 검증할 옵션 객체
 * @returns 검증 결과
 * @description format, quality, fallbackFormat 옵션들을 검증하고 에러와 경고 메시지를 반환
 */
export function validateOutputOptions(options: any): ValidationResult {
  const result = createValidationResult();

  // 필수 검증들
  if (options.format !== undefined && !isValidImageFormat(options.format)) {
    result.errors.push(`format은 다음 중 하나여야 합니다: ${VALID_IMAGE_FORMATS.join(', ')}`);
  }

  if (options.quality !== undefined && !isValidQuality(options.quality)) {
    result.errors.push('quality는 0.0과 1.0 사이의 숫자여야 합니다');
  }

  if (options.fallbackFormat !== undefined && !isValidImageFormat(options.fallbackFormat)) {
    result.errors.push(`fallbackFormat은 다음 중 하나여야 합니다: ${VALID_IMAGE_FORMATS.join(', ')}`);
  }

  // 경고들
  if (options.quality !== undefined && options.quality < 0.1) {
    result.warnings.push('품질이 매우 낮습니다. 이미지 품질이 크게 저하될 수 있습니다');
  }

  if (options.format === 'png' && options.quality !== undefined && options.quality < 1.0) {
    result.warnings.push('PNG는 무손실 포맷이므로 quality 설정이 무시됩니다');
  }

  return result.build();
}

// 타입 어설션 함수들
/**
 * 이미지 소스 어설션
 *
 * @param value 검사할 값
 * @param paramName 매개변수 이름 (에러 메시지에 사용)
 * @throws {TypeError} 유횤하지 않은 이미지 소스인 경우
 * @description 런타임에 이미지 소스의 타입을 검증하고, 유효하지 않으면 에러를 발생
 */
export function assertImageSource(value: unknown, paramName = 'source'): asserts value is ImageSource {
  if (!isValidImageSource(value)) {
    throw new TypeError(
      `${paramName}은(는) 유효한 이미지 소스여야 합니다 (HTMLImageElement, Blob, Data URL, HTTP URL, SVG 문자열, 또는 파일 경로)`
    );
  }
}

/**
 * 양의 정수 어설션
 *
 * @param value 검사할 값
 * @param paramName 매개변수 이름 (에러 메시지에 사용)
 * @throws {TypeError} 양의 정수가 아닌 경우
 * @description width, height 등의 차원 값이 양의 정수인지 검증
 */
export function assertPositiveInteger(value: unknown, paramName = 'value'): asserts value is number {
  if (!isValidDimension(value)) {
    throw new TypeError(`${paramName}은(는) 양의 정수여야 합니다`);
  }
}

/**
 * 품질 값 어설션
 *
 * @param value 검사할 값
 * @param paramName 매개변수 이름 (에러 메시지에 사용)
 * @throws {TypeError} 0.0~1.0 범위의 숫자가 아닌 경우
 * @description 이미지 압축 품질이 유효한 범위인지 검증
 */
export function assertQuality(value: unknown, paramName = 'quality'): asserts value is number {
  if (!isValidQuality(value)) {
    throw new TypeError(`${paramName}은(는) 0.0과 1.0 사이의 숫자여야 합니다`);
  }
}
