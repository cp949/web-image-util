/**
 * 소스 변환기 - 기존 image-common.ts의 로직을 통합하고 개선
 */

import type { ImageSource, ProcessorOptions } from '../types';
import { ImageProcessError } from '../types';

/**
 * 이미지 소스 타입 감지
 */
export type SourceType = 'element' | 'blob' | 'svg' | 'dataurl' | 'url' | 'path';

/**
 * 이미지 소스 타입을 감지합니다
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

/**
 * 기본 네임스페이스·viewBox 없을 때 보강
 */
function normalizeSvgBasics(src: string): string {
  try {
    const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
    const svgEl = doc.documentElement;

    // 네임스페이스 추가
    if (!svgEl.getAttribute('xmlns')) {
      svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!svgEl.getAttribute('xmlns:xlink')) {
      svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }

    // width/height나 viewBox가 모두 없으면 기본값 부여
    const hasSize = svgEl.hasAttribute('width') || svgEl.hasAttribute('height') || svgEl.hasAttribute('viewBox');
    if (!hasSize) {
      svgEl.setAttribute('viewBox', '0 0 512 512');
      svgEl.setAttribute('width', '512');
      svgEl.setAttribute('height', '512');
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    return new XMLSerializer().serializeToString(doc);
  } catch {
    return src; // 파서 실패 시 원본 그대로
  }
}

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
    // img.crossOrigin = 'anonymous'; // Blob URL에는 불필요. 외부 리소스 포함 시 sanitize 단계에서 제거 권장.
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
