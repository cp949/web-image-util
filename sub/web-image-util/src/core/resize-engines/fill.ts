/**
 * Fill 모드 리사이징 엔진
 * 비율 무시하고 정확히 목표 크기로 맞춤
 */

import type { FillConfig } from '../../types/resize-config';
import { resizeCanvasWithPadding } from './common';
import { ImageProcessError } from '../../types';

/**
 * Fill 모드 실행
 *
 * - 비율 무시하고 정확히 목표 크기로 맞춤
 * - 이미지가 늘어나거나 압축될 수 있음
 * - withoutReduction/withoutEnlargement 불필요 (fill의 본질과 맞지 않음)
 *
 * @param canvas - 원본 캔버스
 * @param config - fill 설정
 * @returns 리사이징된 캔버스
 */
export function executeFillResize(canvas: HTMLCanvasElement, config: FillConfig): HTMLCanvasElement {
  const { width: targetWidth, height: targetHeight } = config;

  // 단순히 목표 크기로 리사이징 (비율 무시)
  const newCanvas = document.createElement('canvas');
  newCanvas.width = targetWidth;
  newCanvas.height = targetHeight;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new ImageProcessError('캔버스 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 배경색 먼저 채우기 (선택적)
  if (config.background) {
    ctx.fillStyle = config.background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // 전체 캔버스에 이미지 늘려서 그리기
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  // 패딩과 배경색 적용
  if (config.padding || config.background) {
    return resizeCanvasWithPadding(newCanvas, targetWidth, targetHeight, config);
  }

  return newCanvas;
}