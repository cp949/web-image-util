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
 * MinFit 리사이징 실행
 *
 * @param canvas - 원본 캔버스
 * @param config - MinFitConfig
 * @returns 리사이징된 캔버스
 */
export function executeMinFitResize(canvas: HTMLCanvasElement, config: MinFitConfig): HTMLCanvasElement {
  const { width: minWidth, height: minHeight } = config;
  const { width: srcWidth, height: srcHeight } = canvas;

  // 🐛 DEBUG: minFit 엔진 호출 확인
  console.log('🔧 executeMinFitResize 호출:', {
    원본크기: `${srcWidth}x${srcHeight}`,
    최소크기: `${minWidth || '0'}x${minHeight || '0'}`,
    config: JSON.stringify(config, null, 2),
  });

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

  // 🎨 SVG 화질 최적화: Canvas가 이미 최적 크기로 생성된 경우 확인
  // Pipeline에서 최종 크기로 Canvas를 생성했다면 추가 리사이징 불필요

  // 현재 Canvas 크기 기준으로 역산한 원본 크기 추정
  const estimatedOriginalWidth = srcWidth;
  const estimatedOriginalHeight = srcHeight;

  // minFit 스케일 계산 (현재 Canvas 크기가 이미 확대된 경우를 고려)
  let scale = 1;
  if (minWidth) scale = Math.max(scale, minWidth / estimatedOriginalWidth);
  if (minHeight) scale = Math.max(scale, minHeight / estimatedOriginalHeight);
  scale = Math.max(scale, 1);

  // Pipeline에서 이미 최적 크기로 Canvas를 생성했는지 확인
  // 현재 Canvas 크기가 계산된 최종 크기와 일치하면 추가 처리 불필요
  const calculatedFinalWidth = Math.round(estimatedOriginalWidth * scale);
  const calculatedFinalHeight = Math.round(estimatedOriginalHeight * scale);

  if (srcWidth === calculatedFinalWidth && srcHeight === calculatedFinalHeight && scale > 1) {
    console.log('✨ minFit: SVG가 이미 최적 크기로 렌더링됨 (Pipeline 최적화)', {
      canvasSize: `${srcWidth}x${srcHeight}`,
      calculatedSize: `${calculatedFinalWidth}x${calculatedFinalHeight}`,
      scale: scale.toFixed(3),
      status: 'pipeline_optimized_no_additional_processing',
    });

    // 패딩/배경 적용만 수행
    if (config.padding || config.background) {
      return resizeCanvasWithPadding(canvas, srcWidth, srcHeight, config);
    }

    return canvas;
  }

  // minFit 전용 로직: 최소 조건을 만족하면서 원본 비율 유지, 잘림 없음
  // 스케일 재계산: 현재 Canvas가 원본 크기인 경우의 최소 스케일 (축소 방지)
  scale = 1;

  if (minWidth) {
    scale = Math.max(scale, minWidth / srcWidth);
  }

  if (minHeight) {
    scale = Math.max(scale, minHeight / srcHeight);
  }

  // 축소는 하지 않음 (minFit의 핵심 특성)
  scale = Math.max(scale, 1);

  // 최종 크기: 원본 비율 유지하며 모든 최소 조건 만족
  const finalWidth = Math.round(srcWidth * scale);
  const finalHeight = Math.round(srcHeight * scale);

  console.log('📐 minFit 스케일 계산:', {
    originalSize: `${srcWidth}x${srcHeight}`,
    minSize: `${minWidth || '0'}x${minHeight || '0'}`,
    scale: scale.toFixed(3),
    finalSize: `${finalWidth}x${finalHeight}`,
    meetsMinWidth: minWidth ? finalWidth >= minWidth : 'N/A',
    meetsMinHeight: minHeight ? finalHeight >= minHeight : 'N/A',
    비율유지: (finalWidth / finalHeight).toFixed(3) + ' vs ' + (srcWidth / srcHeight).toFixed(3),
  });

  // 🚀 효율적인 한 번의 처리: 리사이징 + 패딩을 동시에 수행
  if (config.padding || config.background) {
    // 패딩을 고려한 최종 Canvas 크기 계산
    const { top, right, bottom, left } = normalizePadding(config.padding);
    const paddedWidth = finalWidth + left + right;
    const paddedHeight = finalHeight + top + bottom;

    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = paddedWidth;
    paddedCanvas.height = paddedHeight;

    const ctx = paddedCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot create canvas context for minFit with padding');
    }

    // 고품질 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 배경색 적용
    if (config.background) {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, paddedWidth, paddedHeight);
    }

    // 한 번에 리사이징 + 패딩 위치에 배치
    ctx.drawImage(canvas, left, top, finalWidth, finalHeight);

    return paddedCanvas;
  } else {
    // 패딩 없는 경우: 단순 복사
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = finalWidth;
    finalCanvas.height = finalHeight;

    const ctx = finalCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot create canvas context for minFit');
    }

    // 고품질 설정
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 배경색 적용 (투명도 지원)
    if (config.background) {
      ctx.fillStyle = config.background;
      ctx.fillRect(0, 0, finalWidth, finalHeight);
    }

    // Pipeline에서 이미 최적 크기로 Canvas가 생성되었으므로 단순 복사
    ctx.drawImage(canvas, 0, 0, finalWidth, finalHeight);

    return finalCanvas;
  }
}
