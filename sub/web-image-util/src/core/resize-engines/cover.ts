/**
 * Cover 모드 리사이징 엔진
 * CSS object-fit: cover와 동일한 동작
 */

import type { CoverConfig } from '../../types/resize-config';
import { resizeCanvasWithPadding } from './common';
import { ImageProcessError } from '../../types';

/**
 * Cover 모드 실행
 *
 * - 비율 유지하며 지정된 사각형에 가득 채움
 * - 필요시 이미지 일부 잘림 가능
 * - 크든 작든 항상 목표 크기로 맞춤
 *
 * @param canvas - 원본 캔버스
 * @param config - cover 설정
 * @returns 리사이징된 캔버스
 */
export function executeCoverResize(canvas: HTMLCanvasElement, config: CoverConfig): HTMLCanvasElement {
  const { width: targetWidth, height: targetHeight } = config;
  const { width: srcWidth, height: srcHeight } = canvas;

  // cover 로직: 비율 유지하며 목표 영역을 가득 채우는 스케일
  const scaleX = targetWidth / srcWidth;
  const scaleY = targetHeight / srcHeight;
  const scale = Math.max(scaleX, scaleY); // 큰 스케일 선택 (가득 채우기)

  const scaledWidth = srcWidth * scale;
  const scaledHeight = srcHeight * scale;

  // 중간 캔버스에 스케일링된 이미지 그리기
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = Math.round(scaledWidth);
  tempCanvas.height = Math.round(scaledHeight);

  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new ImageProcessError('임시 캔버스 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
  }

  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';
  tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

  // 목표 크기 캔버스에 중앙 크롭하여 그리기
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = targetWidth;
  finalCanvas.height = targetHeight;

  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) {
    throw new ImageProcessError('최종 캔버스 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
  }

  // 배경색 먼저 채우기 (padding이 있을 경우를 위해)
  if (config.background) {
    finalCtx.fillStyle = config.background;
    finalCtx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // 크롭 오프셋 계산 (중앙 정렬)
  const offsetX = (scaledWidth - targetWidth) / 2;
  const offsetY = (scaledHeight - targetHeight) / 2;

  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(
    tempCanvas,
    offsetX,
    offsetY,
    targetWidth,
    targetHeight, // 소스 영역
    0,
    0,
    targetWidth,
    targetHeight // 대상 영역
  );

  // 패딩과 배경색 적용
  if (config.padding || config.background) {
    return resizeCanvasWithPadding(finalCanvas, targetWidth, targetHeight, config);
  }

  return finalCanvas;
}