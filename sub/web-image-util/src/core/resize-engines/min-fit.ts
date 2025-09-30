/**
 * MinFit 리사이징 엔진
 * Phase 4에서 구현
 *
 * minFit: 최소 크기 보장 방식
 * - 작은 이미지는 확대
 * - 큰 이미지는 크기 변경 없음 (축소 안함)
 * - 비율 유지, 잘림 없음
 * - 모든 지정된 치수(width/height)가 최소값을 만족
 */

import type { MinFitConfig } from '../../types/resize-config';
import { resizeCanvasWithPadding, resizeCanvasHighQuality } from './common';

/**
 * MinFit 리사이징 실행
 *
 * @param canvas - 원본 캔버스
 * @param config - MinFitConfig
 * @returns 리사이징된 캔버스
 */
export function executeMinFitResize(canvas: HTMLCanvasElement, config: MinFitConfig): HTMLCanvasElement {
  const { width: minWidth, height: minHeight } = config;
  const { width: srcWidth, height: srcHeight } = canvas;

  // width나 height 중 하나는 반드시 지정되어야 함
  if (!minWidth && !minHeight) {
    throw new Error('minFit requires at least width or height');
  }

  // 현재 크기가 최소값보다 크거나 같으면 리사이징 불필요
  const needsResize = (minWidth && srcWidth < minWidth) || (minHeight && srcHeight < minHeight);

  if (!needsResize) {
    console.log('ℹ️ minFit: 현재 크기가 최소값 이상이므로 리사이징 불필요', {
      current: `${srcWidth}x${srcHeight}`,
      min: `${minWidth || '0'}x${minHeight || '0'}`,
    });

    // 패딩/배경이 지정된 경우에만 적용
    if (config.padding || config.background) {
      return resizeCanvasWithPadding(canvas, srcWidth, srcHeight, config);
    }

    return canvas;
  }

  // 스케일 계산: 모든 최소 조건을 만족하는 최소 스케일
  let scale = 1;

  if (minWidth) {
    scale = Math.max(scale, minWidth / srcWidth);
  }

  if (minHeight) {
    scale = Math.max(scale, minHeight / srcHeight);
  }

  // 축소는 하지 않음 (minFit의 핵심 특성)
  scale = Math.max(scale, 1);

  const newWidth = Math.round(srcWidth * scale);
  const newHeight = Math.round(srcHeight * scale);

  console.log('📐 minFit 스케일 계산:', {
    originalSize: `${srcWidth}x${srcHeight}`,
    minSize: `${minWidth || '0'}x${minHeight || '0'}`,
    scale: scale.toFixed(3),
    newSize: `${newWidth}x${newHeight}`,
  });

  // 고품질 리사이징 실행
  const resizedCanvas = resizeCanvasHighQuality(canvas, newWidth, newHeight);

  // 패딩/배경 적용
  if (config.padding || config.background) {
    return resizeCanvasWithPadding(resizedCanvas, newWidth, newHeight, config);
  }

  return resizedCanvas;
}