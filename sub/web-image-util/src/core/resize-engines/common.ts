/**
 * Resize engines 공통 유틸리티 함수
 * Phase 4에서 구현
 */

import type { BaseResizeConfig } from '../../types/resize-config';

/**
 * 캔버스 리사이징 + 패딩/배경 적용 공통 함수
 *
 * @param canvas - 원본 캔버스
 * @param newWidth - 리사이징된 이미지 너비 (패딩 제외)
 * @param newHeight - 리사이징된 이미지 높이 (패딩 제외)
 * @param config - ResizeConfig (padding, background 사용)
 * @returns 패딩과 배경이 적용된 새 캔버스
 */
export function resizeCanvasWithPadding(
  canvas: HTMLCanvasElement,
  newWidth: number,
  newHeight: number,
  config: BaseResizeConfig
): HTMLCanvasElement {
  // 패딩 값 정규화
  const { top, right, bottom, left } = normalizePadding(config.padding);
  const finalWidth = newWidth + left + right;
  const finalHeight = newHeight + top + bottom;

  const newCanvas = document.createElement('canvas');
  newCanvas.width = finalWidth;
  newCanvas.height = finalHeight;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create canvas context');
  }

  // 배경색 적용
  if (config.background) {
    ctx.fillStyle = config.background;
    ctx.fillRect(0, 0, finalWidth, finalHeight);
  }

  // 고품질 설정
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 이미지 그리기 (패딩 고려)
  ctx.drawImage(canvas, left, top, newWidth, newHeight);

  return newCanvas;
}

/**
 * 패딩 값 정규화 함수
 * number 또는 객체를 {top, right, bottom, left} 형태로 변환
 */
function normalizePadding(padding?: number | { top?: number; right?: number; bottom?: number; left?: number }): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof padding === 'number') {
    // 숫자 하나면 4방향 동일
    return { top: padding, right: padding, bottom: padding, left: padding };
  } else if (padding && typeof padding === 'object') {
    // 객체면 필요한 방향만 선택적으로 지정
    return {
      top: padding.top || 0,
      right: padding.right || 0,
      bottom: padding.bottom || 0,
      left: padding.left || 0,
    };
  } else {
    // 패딩이 없으면 모두 0
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

/**
 * 고품질 캔버스 리사이징 함수
 *
 * @param canvas - 원본 캔버스
 * @param targetWidth - 목표 너비
 * @param targetHeight - 목표 높이
 * @returns 리사이징된 새 캔버스
 */
export function resizeCanvasHighQuality(
  canvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  const newCanvas = document.createElement('canvas');
  newCanvas.width = targetWidth;
  newCanvas.height = targetHeight;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Cannot create canvas context');
  }

  // 고품질 설정
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  return newCanvas;
}

/**
 * 이미지 비율 계산 유틸리티
 *
 * @param srcWidth - 원본 너비
 * @param srcHeight - 원본 높이
 * @returns 비율 (width/height)
 */
export function calculateAspectRatio(srcWidth: number, srcHeight: number): number {
  return srcWidth / srcHeight;
}

/**
 * 목표 크기에 맞춰 비율 유지한 크기 계산
 *
 * @param srcWidth - 원본 너비
 * @param srcHeight - 원본 높이
 * @param targetWidth - 목표 너비 (선택적)
 * @param targetHeight - 목표 높이 (선택적)
 * @returns 계산된 크기 {width, height}
 */
export function calculateProportionalSize(
  srcWidth: number,
  srcHeight: number,
  targetWidth?: number,
  targetHeight?: number
): { width: number; height: number } {
  const aspectRatio = calculateAspectRatio(srcWidth, srcHeight);

  if (targetWidth && targetHeight) {
    // 둘 다 지정된 경우, 비율을 유지하며 둘 중 작은 제한에 맞춤
    const scale = Math.min(targetWidth / srcWidth, targetHeight / srcHeight);
    return {
      width: Math.round(srcWidth * scale),
      height: Math.round(srcHeight * scale),
    };
  } else if (targetWidth) {
    // 너비만 지정된 경우
    return {
      width: targetWidth,
      height: Math.round(targetWidth / aspectRatio),
    };
  } else if (targetHeight) {
    // 높이만 지정된 경우
    return {
      width: Math.round(targetHeight * aspectRatio),
      height: targetHeight,
    };
  } else {
    // 아무것도 지정되지 않은 경우 원본 크기 반환
    return { width: srcWidth, height: srcHeight };
  }
}