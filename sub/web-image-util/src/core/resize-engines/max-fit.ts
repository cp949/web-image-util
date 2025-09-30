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
import { resizeCanvasHighQuality } from './common';

/**
 * 패딩 값 정규화 함수
 */
function normalizePadding(padding?: number | { top?: number; right?: number; bottom?: number; left?: number }): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  } else if (padding && typeof padding === 'object') {
    return {
      top: padding.top || 0,
      right: padding.right || 0,
      bottom: padding.bottom || 0,
      left: padding.left || 0,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

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

  // 🐛 DEBUG: maxFit 엔진 호출 확인
  console.log('🔧 executeMaxFitResize 호출:', {
    원본크기: `${srcWidth}x${srcHeight}`,
    최대크기: `${maxWidth || '∞'}x${maxHeight || '∞'}`,
    config: JSON.stringify(config, null, 2)
  });

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

  // 🎨 SVG 화질 최적화: Canvas가 이미 최적 크기로 생성된 경우 확인
  // Pipeline에서 최적 크기로 Canvas를 생성했다면 추가 리사이징 불필요
  // maxFit에서는 정확한 크기가 아닐 수 있으므로 스케일 기반으로 확인
  let optimalScale = 1;
  if (maxWidth) optimalScale = Math.min(optimalScale, maxWidth / srcWidth);
  if (maxHeight) optimalScale = Math.min(optimalScale, maxHeight / srcHeight);
  optimalScale = Math.min(optimalScale, 1);

  const optimalWidth = Math.round(srcWidth * optimalScale);
  const optimalHeight = Math.round(srcHeight * optimalScale);

  if (srcWidth === optimalWidth && srcHeight === optimalHeight) {
    console.log('✨ maxFit: Canvas가 이미 최적 크기로 생성됨 (SVG 화질 최적화)', {
      current: `${srcWidth}x${srcHeight}`,
      optimal: `${optimalWidth}x${optimalHeight}`,
      scale: optimalScale.toFixed(3),
    });

    // 패딩/배경 적용만 수행
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

  // 🚀 효율적인 한 번의 처리: 리사이징 + 패딩을 동시에 수행
  if (config.padding || config.background) {
    // 패딩을 고려한 최종 Canvas 크기 계산
    const { top, right, bottom, left } = normalizePadding(config.padding);
    const finalWidth = newWidth + left + right;
    const finalHeight = newHeight + top + bottom;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;

    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot create canvas context for maxFit with padding');
    }

    // 고품질 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 배경색 적용
    if (config.background) {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    }

    // 한 번에 리사이징 + 패딩 위치에 배치
    ctx.drawImage(canvas, left, top, newWidth, newHeight);

    return finalCanvas;
  } else {
    // 패딩 없는 경우: 단순 리사이징
    const resizedCanvas = resizeCanvasHighQuality(canvas, newWidth, newHeight);
    return resizedCanvas;
  }
}