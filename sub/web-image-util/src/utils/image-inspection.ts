/**
 * 이미지 픽셀 데이터를 직접 검사하는 유틸리티다.
 */

import { leaseCanvas } from '../base/canvas-lease.internal';
import { convertToImageElement } from '../core/source-converter/index';
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
  if (source instanceof HTMLCanvasElement) {
    return inspectTransparency(source, options);
  }

  const imageElement = await convertToImageElement(source);
  const width = imageElement.naturalWidth || imageElement.width;
  const height = imageElement.naturalHeight || imageElement.height;

  if (width <= 0 || height <= 0) {
    return false;
  }

  // 검사 전용 canvas는 pool에서 임대하고 boolean을 계산한 뒤 즉시 반환한다.
  return leaseCanvas(width, height).consume((canvas) => {
    const context = getCanvasContext(canvas);
    context.drawImage(imageElement, 0, 0, width, height);
    return inspectTransparency(canvas, options);
  });
}

/** 이미 그려진 canvas의 alpha 채널을 샘플링해 투명 픽셀 유무를 판정한다. */
function inspectTransparency(canvas: HTMLCanvasElement, options?: TransparencyOptions): boolean {
  const { width, height } = canvas;

  if (width <= 0 || height <= 0) {
    return false;
  }

  const context = getCanvasContext(canvas);
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
