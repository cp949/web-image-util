/**
 * 이미지 소스의 픽셀 치수와 그에 파생되는 비율/방향을 계산하는 모듈.
 *
 * Canvas/HTMLImageElement처럼 이미 치수를 가진 입력은 변환 없이 즉시 읽고,
 * SVG 문자열·SVG Blob은 별도 파서로 폭/높이를 추출하며, 그 외 입력은 공통 소스 변환 경로를
 * 통해 안전하게 로드한 뒤 자연 치수를 측정한다.
 */

import { convertToImageElement, detectSourceType } from '../../core/source-converter';
import type { ImageSource } from '../../types';
import { ImageFormats } from '../../types';
import { extractSvgDimensions } from '../svg-dimensions';
import { formatFromPath } from './format-detection';
import type { ImageDimensions, ImageOrientation } from './types';

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
