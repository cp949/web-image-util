/**
 * 이미지 픽셀 데이터를 직접 검사하는 유틸리티다.
 */

import { convertToImageElement } from '../core/source-converter';
import type { ImageSource } from '../types';
import { ImageProcessError } from '../types';

/** 투명도 검사 옵션이다. */
export interface TransparencyOptions {
  /** 픽셀 검사 간격 */
  sampleStep?: number;
}

/** 캔버스 2D 컨텍스트를 얻거나 표준 캔버스 생성 오류를 던진다. */
function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new ImageProcessError('Unable to create Canvas 2D context', 'CANVAS_CREATION_FAILED');
  }

  return context;
}

/** sampleStep 옵션을 1 이상의 정수로 정규화한다. */
function normalizeSampleStep(sampleStep: number | undefined): number {
  if (sampleStep === undefined) {
    return 1;
  }

  const flooredStep = Math.floor(sampleStep);
  return Number.isFinite(flooredStep) ? Math.max(1, flooredStep) : 1;
}

/** 이미지 요소를 캔버스에 그려 픽셀 검사 가능한 형태로 변환한다. */
async function imageSourceToCanvas(source: ImageSource): Promise<HTMLCanvasElement> {
  const imageElement = await convertToImageElement(source);
  const canvas = document.createElement('canvas');
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;

  canvas.width = width;
  canvas.height = height;

  const context = getCanvasContext(canvas);
  context.drawImage(imageElement, 0, 0, width, height);

  return canvas;
}

/**
 * 이미지에 완전히 불투명하지 않은 픽셀이 있는지 확인한다.
 *
 * @param source 검사할 이미지 소스 또는 캔버스
 * @param options 픽셀 샘플링 옵션
 * @returns 샘플링한 픽셀 중 alpha 값이 255 미만이면 true
 */
export async function hasTransparency(
  source: ImageSource | HTMLCanvasElement,
  options?: TransparencyOptions
): Promise<boolean> {
  const canvas = source instanceof HTMLCanvasElement ? source : await imageSourceToCanvas(source);
  const context = getCanvasContext(canvas);
  const { width, height } = canvas;
  const imageData = context.getImageData(0, 0, width, height);
  const sampleStep = normalizeSampleStep(options?.sampleStep);

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const alphaIndex = (y * width + x) * 4 + 3;

      if (imageData.data[alphaIndex] < 255) {
        return true;
      }
    }
  }

  return false;
}
