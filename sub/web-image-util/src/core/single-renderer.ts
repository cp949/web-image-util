/**
 * 단일 렌더링 함수 - 모든 연산을 한 번에 처리
 *
 * 핵심 개념: "계산은 미리, 렌더링은 한 번"
 * - 모든 연산(resize, blur, filter 등)을 분석하여 최종 레이아웃 계산
 * - 계산 완료 후 단 한 번의 drawImage로 모든 처리 완료
 * - 중간 Canvas 생성 없이 최종 결과만 생성
 */

import type { LazyOperation, FinalLayout } from './lazy-render-pipeline';
import type { ResizeConfig } from '../types/resize-config';
import { ImageProcessError } from '../types';
import { ResizeCalculator } from './resize-calculator';
import { debugLog } from '../utils/debug';

/**
 * 모든 연산을 분석하여 최종 레이아웃 계산
 *
 * 이 함수가 복잡한 수학적 계산을 모두 처리하고,
 * renderAllOperationsOnce()는 순수하게 렌더링만 담당
 */
export function analyzeAllOperations(sourceImage: HTMLImageElement, operations: LazyOperation[]): FinalLayout {
  const sourceWidth = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;

  // 기본 레이아웃 (원본 크기)
  let layout: FinalLayout = {
    width: sourceWidth,
    height: sourceHeight,
    position: { x: 0, y: 0 },
    imageSize: { width: sourceWidth, height: sourceHeight },
    background: 'transparent',
    filters: [],
  };

  // 각 연산을 순차적으로 분석
  for (const operation of operations) {
    switch (operation.type) {
      case 'resize':
        layout = analyzeResizeOperation(sourceImage, layout, operation.config);
        break;
      case 'blur':
        analyzeBlurOperation(layout, operation.options);
        break;
      case 'filter':
        analyzeFilterOperation(layout, operation.options);
        break;
    }
  }

  return layout;
}

/**
 * 리사이즈 연산 분석 - ResizeCalculator 활용
 */
function analyzeResizeOperation(sourceImage: HTMLImageElement, layout: FinalLayout, config: ResizeConfig): FinalLayout {
  const calculator = new ResizeCalculator();

  // ResizeCalculator를 사용하여 정확한 레이아웃 계산
  const result = calculator.calculateFinalLayout(sourceImage.naturalWidth, sourceImage.naturalHeight, config);

  return {
    width: result.canvasSize.width,
    height: result.canvasSize.height,
    position: {
      x: result.position.x,
      y: result.position.y,
    },
    imageSize: {
      width: result.imageSize.width,
      height: result.imageSize.height,
    },
    background: config.background || 'transparent',
    filters: layout.filters, // 기존 필터 유지
  };
}

/**
 * 블러 연산 분석
 */
function analyzeBlurOperation(layout: FinalLayout, options: any): void {
  const radius = options.radius || 2;
  layout.filters.push(`blur(${radius}px)`);
}

/**
 * 기타 필터 연산 분석
 */
function analyzeFilterOperation(layout: FinalLayout, options: any): void {
  if (options.brightness !== undefined) {
    layout.filters.push(`brightness(${options.brightness})`);
  }
  if (options.contrast !== undefined) {
    layout.filters.push(`contrast(${options.contrast})`);
  }
  if (options.saturate !== undefined) {
    layout.filters.push(`saturate(${options.saturate})`);
  }
  if (options.hueRotate !== undefined) {
    layout.filters.push(`hue-rotate(${options.hueRotate}deg)`);
  }
}

/**
 * 모든 필터를 하나의 문자열로 결합
 */
export function calculateAllFilters(operations: LazyOperation[]): string {
  const filters: string[] = [];

  for (const operation of operations) {
    if (operation.type === 'blur') {
      const radius = operation.options.radius || 2;
      filters.push(`blur(${radius}px)`);
    } else if (operation.type === 'filter') {
      const options = operation.options;
      if (options.brightness !== undefined) {
        filters.push(`brightness(${options.brightness})`);
      }
      if (options.contrast !== undefined) {
        filters.push(`contrast(${options.contrast})`);
      }
      if (options.saturate !== undefined) {
        filters.push(`saturate(${options.saturate})`);
      }
      if (options.hueRotate !== undefined) {
        filters.push(`hue-rotate(${options.hueRotate}deg)`);
      }
    }
  }

  return filters.join(' ');
}

/**
 * 🚀 핵심 함수: 모든 연산을 한 번에 렌더링
 *
 * 이 함수가 SVG 화질 개선의 핵심입니다.
 * - 배경을 먼저 그리고
 * - 모든 필터를 한 번에 적용하고
 * - 단 한 번의 drawImage로 모든 처리 완료
 */
export function renderAllOperationsOnce(sourceImage: HTMLImageElement, operations: LazyOperation[]): HTMLCanvasElement {
  // 1. 모든 연산을 분석하여 최종 레이아웃 계산
  const layout = analyzeAllOperations(sourceImage, operations);

  // 2. 최종 Canvas 생성
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageProcessError('Canvas 2D context를 생성할 수 없습니다', 'CANVAS_CONTEXT_ERROR');
  }

  // 3. 고품질 렌더링 설정
  setupHighQualityRendering(ctx);

  // 4. 배경 그리기 (필요한 경우)
  if (layout.background !== 'transparent') {
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  // 5. 모든 필터 효과를 한 번에 적용
  if (layout.filters.length > 0) {
    ctx.filter = layout.filters.join(' ');
  }

  // 6. 🎯 단 한 번의 drawImage로 모든 처리 완료
  // 이것이 SVG 화질 보존의 핵심입니다
  ctx.drawImage(
    sourceImage,
    Math.round(layout.position.x),
    Math.round(layout.position.y),
    Math.round(layout.imageSize.width),
    Math.round(layout.imageSize.height)
  );

  // 7. 필터 리셋 (다음 사용을 위해)
  ctx.filter = 'none';

  return canvas;
}

/**
 * 고품질 렌더링 설정
 * SVG 벡터 특성을 최대한 활용하는 설정
 */
function setupHighQualityRendering(ctx: CanvasRenderingContext2D): void {
  // SVG는 벡터이므로 브라우저가 자동으로 최적 품질 제공
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // scaleFactor나 복잡한 계산 없이 브라우저에 위임
  // 이것이 SVG 화질 보존의 핵심 아이디어
}

/**
 * 디버깅용: 레이아웃 정보 출력
 */
export function debugLayout(layout: FinalLayout, operationCount: number): void {
  debugLog.log('🎯 단일 렌더링 레이아웃:', {
    canvasSize: `${layout.width}x${layout.height}`,
    imagePosition: `(${layout.position.x}, ${layout.position.y})`,
    imageSize: `${layout.imageSize.width}x${layout.imageSize.height}`,
    background: layout.background,
    filters: layout.filters,
    operationCount,
    renderingApproach: 'single-pass',
    timestamp: Date.now(),
  });
}
