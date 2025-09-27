/**
 * 소스 변환기 - 다양한 이미지 소스를 HTMLImageElement로 변환
 */

import type { ImageSource, ProcessorOptions } from '../types';
import { ImageProcessError } from '../types';
import { normalizeSvgBasics } from '../utils/svg-compatibility';

/**
 * 이미지 소스 타입
 *
 * @description 지원되는 이미지 소스의 타입들
 */
export type SourceType = 'element' | 'canvas' | 'blob' | 'arrayBuffer' | 'uint8Array' | 'svg' | 'dataurl' | 'url' | 'path';

/**
 * 이미지 소스 타입을 감지합니다
 *
 * @description 입력된 이미지 소스의 타입을 분석하여 적절한 변환 방법을 결정합니다.
 * @param source 분석할 이미지 소스
 * @returns 감지된 소스 타입
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // HTMLCanvasElement 감지
  if (source instanceof HTMLCanvasElement || (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source && typeof (source as any).getContext === 'function')) {
    return 'canvas';
  }

  // Blob 감지 - instanceof와 덕 타이핑 둘 다 사용
  if (source instanceof Blob ||
      (source && typeof source === 'object' &&
       'type' in source &&
       'size' in source &&
       ('slice' in source || 'arrayBuffer' in source))) {
    return 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // SVG XML 감지
    if (trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')) {
      return 'svg';
    }

    // Data URL 감지
    if (trimmed.startsWith('data:')) {
      return 'dataurl';
    }

    // HTTP/HTTPS URL 감지
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return 'url';
    }

    // 나머지는 파일 경로로 취급
    return 'path';
  }

  throw new ImageProcessError(`지원하지 않는 소스 타입입니다: ${typeof source}`, 'INVALID_SOURCE');
}

/**
 * 문자열 소스를 HTMLImageElement로 변환
 */
async function convertStringToElement(source: string, options?: ProcessorOptions): Promise<HTMLImageElement> {
  const sourceType = detectSourceType(source);

  switch (sourceType) {
    case 'svg':
      return convertSvgToElement(source);
    case 'dataurl':
    case 'url':
    case 'path':
      return loadImageFromUrl(source, options?.crossOrigin);
    default:
      throw new ImageProcessError(`변환할 수 없는 문자열 소스입니다: ${sourceType}`, 'INVALID_SOURCE');
  }
}

// SVG 정규화는 브라우저 호환성을 위해 svg-compatibility 모듈에서 처리

/**
 * SVG 문자열을 HTMLImageElement로 변환
 */
async function convertSvgToElement(svgString: string): Promise<HTMLImageElement> {
  // SVG 정규화 처리
  const normalizedSvg = normalizeSvgBasics(svgString);

  const blob = new Blob([normalizedSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    // Blob URL은 동일 출처이므로 crossOrigin 설정 불필요
    const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new ImageProcessError('SVG 이미지 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));
    });

    img.decoding = 'async';
    img.src = url;

    await loaded;
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * URL에서 이미지를 로드하여 HTMLImageElement로 변환
 */
async function loadImageFromUrl(url: string, crossOrigin?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (crossOrigin) {
      img.crossOrigin = crossOrigin;
    }

    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageProcessError(`이미지 로딩에 실패했습니다: ${url}`, 'SOURCE_LOAD_FAILED'));

    img.src = url;
  });
}

/**
 * ArrayBuffer에서 MIME 타입을 자동 감지합니다
 *
 * @param buffer ArrayBuffer 데이터
 * @returns 감지된 MIME 타입
 */
function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG 시그니처: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'image/png';
  }

  // JPEG 시그니처: FF D8 FF
  if (bytes.length >= 3 &&
      bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }

  // WebP 시그니처: RIFF ... WEBP (파일 헤더 확인)
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // WEBP 시그니처 확인 (8-11 바이트)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // GIF 시그니처: GIF87a 또는 GIF89a
  if (bytes.length >= 6) {
    const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
    if (gifSignature === 'GIF') {
      const version = String.fromCharCode(...bytes.slice(3, 6));
      if (version === '87a' || version === '89a') {
        return 'image/gif';
      }
    }
  }

  // BMP 시그니처: BM
  if (bytes.length >= 2 &&
      bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'image/bmp';
  }

  // TIFF 시그니처: II* (little-endian) 또는 MM* (big-endian)
  if (bytes.length >= 4) {
    if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
        (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) {
      return 'image/tiff';
    }
  }

  // ICO 시그니처: 00 00 01 00
  if (bytes.length >= 4 &&
      bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // 기본값으로 PNG 반환
  return 'image/png';
}

/**
 * HTMLCanvasElement를 HTMLImageElement로 변환
 */
async function convertCanvasToElement(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const dataURL = canvas.toDataURL();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageProcessError('Canvas 이미지 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));

    img.src = dataURL;
  });
}

/**
 * Blob을 HTMLImageElement로 변환
 */
async function convertBlobToElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageProcessError('Blob 이미지 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));
    };

    img.src = objectUrl;
  });
}

/**
 * 모든 ImageSource를 HTMLImageElement로 변환하는 메인 함수
 *
 * @description 다양한 타입의 이미지 소스를 HTMLImageElement로 통일된 형태로 변환합니다.
 * HTMLImageElement, Blob, 문자열(URL, SVG, Data URL) 등을 지원합니다.
 * @param source 변환할 이미지 소스
 * @param options 변환 옵션 (CORS 설정 등)
 * @returns HTMLImageElement 객체
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  try {
    if (source instanceof HTMLImageElement) {
      // 이미 로드된 이미지인지 확인
      if (source.complete && source.naturalWidth > 0) {
        return source;
      }

      // 로딩이 완료될 때까지 대기
      return new Promise((resolve, reject) => {
        if (source.complete && source.naturalWidth > 0) {
          resolve(source);
        } else {
          source.onload = () => resolve(source);
          source.onerror = () =>
            reject(new ImageProcessError('HTMLImageElement 로딩에 실패했습니다', 'SOURCE_LOAD_FAILED'));
        }
      });
    }

    // HTMLCanvasElement 처리
    if (source instanceof HTMLCanvasElement || (source && typeof source === 'object' && 'getContext' in source && 'toDataURL' in source)) {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    // Blob 감지 - instanceof와 덕 타이핑 둘 다 사용
    if (source instanceof Blob ||
        (source && typeof source === 'object' &&
         'type' in source &&
         'size' in source &&
         ('slice' in source || 'arrayBuffer' in source))) {
      return convertBlobToElement(source as Blob);
    }

    if (source instanceof ArrayBuffer) {
      const mimeType = detectMimeTypeFromBuffer(source);
      const blob = new Blob([source], { type: mimeType });
      return convertBlobToElement(blob);
    }

    if (source instanceof Uint8Array) {
      // Uint8Array를 ArrayBuffer로 안전하게 변환
      const arrayBuffer = source.buffer instanceof ArrayBuffer
        ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
        : source.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertBlobToElement(blob);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, options);
    }

    throw new ImageProcessError(`지원하지 않는 소스 타입입니다: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError('소스 변환 중 알 수 없는 오류가 발생했습니다', 'SOURCE_LOAD_FAILED', error as Error);
  }
}

/**
 * 이미지 소스의 크기 정보를 얻습니다
 *
 * @description 다양한 이미지 소스로부터 실제 크기 정보를 추출합니다.
 * @param source 크기를 알고 싶은 이미지 소스
 * @returns 이미지의 너비와 높이 정보
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
