/**
 * Contain 모드 리사이징 엔진
 * CSS object-fit: contain과 동일한 동작
 */

import type { ContainConfig } from '../../types/resize-config';
import { resizeCanvasWithPadding } from './common';
import { trimEmptySpace } from '../../utils/trim-empty';
import { ImageProcessError } from '../../types';

/**
 * Contain 모드 실행
 *
 * - 비율 유지하며 전체 이미지가 목표 영역에 들어가도록 맞춤
 * - 여백이 생길 수 있음 (배경색으로 채움)
 * - withoutEnlargement 옵션 지원
 * - trimEmpty 옵션 지원
 *
 * @param canvas - 원본 캔버스
 * @param config - contain 설정
 * @returns 리사이징된 캔버스
 */
export function executeContainResize(canvas: HTMLCanvasElement, config: ContainConfig): HTMLCanvasElement {
  const { width: targetWidth, height: targetHeight } = config;
  const { width: srcWidth, height: srcHeight } = canvas;

  // contain 로직: 비율 유지하며 전체가 들어가도록 크기 조정
  const scaleX = targetWidth / srcWidth;
  const scaleY = targetHeight / srcHeight;
  const scale = Math.min(scaleX, scaleY); // 작은 스케일 선택 (전체 들어가기)

  // withoutEnlargement 옵션 처리: 확대 방지
  const finalScale = config.withoutEnlargement && scale > 1 ? 1 : scale;

  const newWidth = Math.round(srcWidth * finalScale);
  const newHeight = Math.round(srcHeight * finalScale);

  // 목표 크기 캔버스 생성
  const newCanvas = document.createElement('canvas');
  newCanvas.width = targetWidth;
  newCanvas.height = targetHeight;

  const ctx = newCanvas.getContext('2d');
  if (!ctx) {
    throw new ImageProcessError('캔버스 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
  }

  // 고품질 설정
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 배경색 채우기
  if (config.background) {
    ctx.fillStyle = config.background;
    ctx.fillRect(0, 0, targetWidth, targetHeight);
  }

  // 중앙 정렬하여 이미지 그리기
  const offsetX = Math.round((targetWidth - newWidth) / 2);
  const offsetY = Math.round((targetHeight - newHeight) / 2);

  ctx.drawImage(canvas, 0, 0, srcWidth, srcHeight, offsetX, offsetY, newWidth, newHeight);

  let resultCanvas = newCanvas;

  // trimEmpty 옵션 처리
  if (config.trimEmpty) {
    resultCanvas = trimEmptySpace(resultCanvas, config.background);
  }

  // 패딩 적용
  if (config.padding) {
    return resizeCanvasWithPadding(resultCanvas, resultCanvas.width, resultCanvas.height, config);
  }

  return resultCanvas;
}