/**
 * MaxFit 리사이징 엔진
 * Phase 4에서 구현
 *
 * maxFit: 최대 크기 제한 방식
 * - 작은 이미지는 크기 변경 없음 (확대 안함)
 * - 큰 이미지는 축소
 * - 비율 유지, 잘림 없음
 * - 하나 이상의 치수(width/height)가 지정된 제한을 넘지 않음
 */

import type { MaxFitConfig } from '../../types/resize-config';
import { resizeCanvasWithPadding, resizeCanvasHighQuality } from './common';

/**
 * MaxFit 리사이징 실행
 *
 * @param canvas - 원본 캔버스
 * @param config - MaxFitConfig
 * @returns 리사이징된 캔버스
 */
export function executeMaxFitResize(canvas: HTMLCanvasElement, config: MaxFitConfig): HTMLCanvasElement {
  const { width: maxWidth, height: maxHeight } = config;
  const { width: srcWidth, height: srcHeight } = canvas;

  // width나 height 중 하나는 반드시 지정되어야 함 (런타임에서 이미 검증됨)
  if (!maxWidth && !maxHeight) {
    throw new Error('maxFit requires at least width or height');
  }

  // 현재 크기가 제한보다 작거나 같으면 리사이징 불필요
  const needsResize = (maxWidth && srcWidth > maxWidth) || (maxHeight && srcHeight > maxHeight);

  if (!needsResize) {
    console.log('ℹ️ maxFit: 현재 크기가 제한 이하이므로 리사이징 불필요', {
      current: `${srcWidth}x${srcHeight}`,
      max: `${maxWidth || '∞'}x${maxHeight || '∞'}`,
    });

    // 패딩/배경이 지정된 경우에만 적용
    if (config.padding || config.background) {
      return resizeCanvasWithPadding(canvas, srcWidth, srcHeight, config);
    }

    return canvas;
  }

  // 스케일 계산: 제한 조건을 모두 만족하는 최대 스케일
  let scale = 1;

  if (maxWidth) {
    scale = Math.min(scale, maxWidth / srcWidth);
  }

  if (maxHeight) {
    scale = Math.min(scale, maxHeight / srcHeight);
  }

  // 확대는 하지 않음 (maxFit의 핵심 특성)
  scale = Math.min(scale, 1);

  const newWidth = Math.round(srcWidth * scale);
  const newHeight = Math.round(srcHeight * scale);

  console.log('📐 maxFit 스케일 계산:', {
    originalSize: `${srcWidth}x${srcHeight}`,
    maxSize: `${maxWidth || '∞'}x${maxHeight || '∞'}`,
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