/**
 * 타입 가드 함수들
 *
 * @description 런타임에서 타입을 안전하게 검증하는 함수들
 * TypeScript의 타입 narrowing을 지원하여 컴파일 타임 안전성 향상
 */

import type { ImageSource, ResizeFit, ResizePosition, BackgroundColor, ImageFormat } from './index';

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
 * Data URL 문자열 타입 가드
 *
 * @param value 검사할 값
 * @returns Data URL 문자열 여부
 */
export function isDataURL(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

/**
 * HTTP/HTTPS URL 문자열 타입 가드
 *
 * @param value 검사할 값
 * @returns HTTP/HTTPS URL 문자열 여부
 */
export function isHttpURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
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
 */
export function isSVGString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().startsWith('<svg') && value.trim().includes('</svg>');
}

/**
 * 유효한 이미지 소스 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ImageSource 여부
 *
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
    (typeof value === 'string' && value.length > 0)
  ); // 파일 경로 등
}

/**
 * 유효한 리사이즈 fit 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ResizeFit 여부
 */
export function isValidResizeFit(value: unknown): value is ResizeFit {
  return typeof value === 'string' && ['cover', 'pad', 'stretch', 'atMost', 'atLeast'].includes(value);
}

/**
 * 유효한 리사이즈 위치 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ResizePosition 여부
 */
export function isValidResizePosition(value: unknown): value is ResizePosition {
  if (typeof value === 'number') {
    return value >= 0 && value <= 100;
  }

  if (typeof value === 'string') {
    const validPositions = [
      'center',
      'centre',
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
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
    ];
    return validPositions.includes(value);
  }

  if (typeof value === 'object' && value !== null) {
    const pos = value as any;
    return (
      typeof pos.x === 'number' && typeof pos.y === 'number' && pos.x >= 0 && pos.x <= 100 && pos.y >= 0 && pos.y <= 100
    );
  }

  return false;
}

/**
 * 유효한 배경색 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 BackgroundColor 여부
 */
export function isValidBackgroundColor(value: unknown): value is BackgroundColor {
  if (typeof value === 'string') {
    // CSS 색상 검증 (간단한 형태만)
    return /^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|\w+)/.test(value.toLowerCase()) || value === 'transparent';
  }

  if (typeof value === 'object' && value !== null) {
    const color = value as any;
    return (
      typeof color.r === 'number' &&
      color.r >= 0 &&
      color.r <= 255 &&
      typeof color.g === 'number' &&
      color.g >= 0 &&
      color.g <= 255 &&
      typeof color.b === 'number' &&
      color.b >= 0 &&
      color.b <= 255 &&
      (color.alpha === undefined || (typeof color.alpha === 'number' && color.alpha >= 0 && color.alpha <= 1))
    );
  }

  return false;
}

/**
 * 유효한 이미지 포맷 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 ImageFormat 여부
 */
export function isValidImageFormat(value: unknown): value is ImageFormat {
  return (
    typeof value === 'string' &&
    ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp'].includes(value.toLowerCase())
  );
}

/**
 * 유효한 품질 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 품질 값 (0.0-1.0) 여부
 */
export function isValidQuality(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1 && !isNaN(value);
}

/**
 * 유효한 차원(크기) 값 타입 가드
 *
 * @param value 검사할 값
 * @returns 유효한 차원 값 (양수) 여부
 */
export function isValidDimension(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isInteger(value);
}

/**
 * 옵션 객체 검증
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 리사이즈 옵션 검증
 *
 * @param options 검증할 옵션 객체
 * @returns 검증 결과
 */
export function validateResizeOptions(options: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (options.width !== undefined) {
    if (!isValidDimension(options.width)) {
      result.errors.push('width는 양의 정수여야 합니다');
      result.isValid = false;
    }
  }

  if (options.height !== undefined) {
    if (!isValidDimension(options.height)) {
      result.errors.push('height는 양의 정수여야 합니다');
      result.isValid = false;
    }
  }

  if (options.fit !== undefined) {
    if (!isValidResizeFit(options.fit)) {
      result.errors.push('fit은 cover, pad, stretch, atMost, atLeast 중 하나여야 합니다');
      result.isValid = false;
    }
  }

  if (options.position !== undefined) {
    if (!isValidResizePosition(options.position)) {
      result.errors.push('position이 유효하지 않습니다');
      result.isValid = false;
    }
  }

  if (options.background !== undefined) {
    if (!isValidBackgroundColor(options.background)) {
      result.errors.push('background 색상 형식이 유효하지 않습니다');
      result.isValid = false;
    }
  }

  // 경고 사항들
  if (!options.width && !options.height) {
    result.warnings.push('width와 height가 모두 지정되지 않았습니다');
  }

  if ((options.width && options.height && options.width > 4096) || options.height > 4096) {
    result.warnings.push('매우 큰 이미지 크기입니다. 메모리 사용량에 주의하세요');
  }

  return result;
}

/**
 * 출력 옵션 검증
 *
 * @param options 검증할 옵션 객체
 * @returns 검증 결과
 */
export function validateOutputOptions(options: any): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (options.format !== undefined) {
    if (!isValidImageFormat(options.format)) {
      result.errors.push('format이 유효하지 않습니다');
      result.isValid = false;
    }
  }

  if (options.quality !== undefined) {
    if (!isValidQuality(options.quality)) {
      result.errors.push('quality는 0.0과 1.0 사이의 숫자여야 합니다');
      result.isValid = false;
    }
  }

  if (options.fallbackFormat !== undefined) {
    if (!isValidImageFormat(options.fallbackFormat)) {
      result.errors.push('fallbackFormat이 유효하지 않습니다');
      result.isValid = false;
    }
  }

  // 경고 사항들
  if (options.quality && options.quality < 0.1) {
    result.warnings.push('품질이 매우 낮습니다. 이미지 품질이 크게 저하될 수 있습니다');
  }

  if (options.format === 'png' && options.quality && options.quality < 1.0) {
    result.warnings.push('PNG는 무손실 포맷이므로 quality 설정이 효과가 없습니다');
  }

  return result;
}

/**
 * 런타임 타입 검증 데코레이터 (실험적)
 *
 * @description 함수 매개변수의 타입을 런타임에 검증하는 데코레이터
 * 개발 모드에서만 동작
 */
export function validateTypes(validators: Record<string, (value: any) => boolean>) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value;

    if (!originalMethod) return;

    descriptor.value = function (this: any, ...args: any[]) {
      // 개발 모드에서만 검증
      if (process?.env?.NODE_ENV === 'development') {
        const paramNames = Object.keys(validators);

        paramNames.forEach((paramName, index) => {
          const validator = validators[paramName];
          const value = args[index];

          if (value !== undefined && !validator(value)) {
            throw new TypeError(`Parameter '${paramName}' failed type validation`);
          }
        });
      }

      return originalMethod.apply(this, args);
    } as T;
  };
}

/**
 * 타입 어설션 함수들 (런타임 검증 포함)
 */

/**
 * 이미지 소스 어설션
 */
export function assertImageSource(value: unknown, paramName = 'source'): asserts value is ImageSource {
  if (!isValidImageSource(value)) {
    throw new TypeError(`${paramName}은(는) 유효한 이미지 소스여야 합니다 (HTMLImageElement, Blob, 또는 URL 문자열)`);
  }
}

/**
 * 양의 정수 어설션
 */
export function assertPositiveInteger(value: unknown, paramName = 'value'): asserts value is number {
  if (!isValidDimension(value)) {
    throw new TypeError(`${paramName}은(는) 양의 정수여야 합니다`);
  }
}

/**
 * 품질 값 어설션
 */
export function assertQuality(value: unknown, paramName = 'quality'): asserts value is number {
  if (!isValidQuality(value)) {
    throw new TypeError(`${paramName}은(는) 0.0과 1.0 사이의 숫자여야 합니다`);
  }
}
