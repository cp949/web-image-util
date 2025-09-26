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
export type SourceType = 'element' | 'blob' | 'svg' | 'dataurl' | 'url' | 'path';

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

  if (source instanceof Blob) {
    return 'blob';
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

    if (source instanceof Blob) {
      return convertBlobToElement(source);
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
