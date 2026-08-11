/**
 * Single rendering function - processes all operations at once
 *
 * Core concept: "Calculate first, render once"
 * - Analyzes all operations (resize, blur, filter, etc.) to calculate final layout
 * - After calculation, completes all processing with a single drawImage call
 * - Generates only final result without creating intermediate Canvas objects
 */

import { CanvasLease } from '../base/canvas-lease.internal';
import { CanvasPool } from '../base/canvas-pool.internal';
import { ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import { debugLog } from '../utils/debug.internal';
import type { FinalLayout, LazyOperation } from './lazy-render-pipeline.internal';
import { ResizeCalculator } from './resize-calculator.internal';

/**
 * Analyze all operations to calculate final layout
 *
 * This function handles all complex mathematical calculations,
 * while renderAllOperationsOnce() is purely responsible for rendering
 */
export function analyzeAllOperations(sourceImage: HTMLImageElement, operations: LazyOperation[]): FinalLayout {
  const sourceWidth = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;

  // Default layout (original size)
  let layout: FinalLayout = {
    width: sourceWidth,
    height: sourceHeight,
    position: { x: 0, y: 0 },
    imageSize: { width: sourceWidth, height: sourceHeight },
    background: 'transparent',
    filters: [],
  };

  // Analyze each operation sequentially
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
 * Analyze resize operation - utilizing ResizeCalculator
 */
function analyzeResizeOperation(sourceImage: HTMLImageElement, layout: FinalLayout, config: ResizeConfig): FinalLayout {
  const calculator = new ResizeCalculator();

  // Calculate precise layout using ResizeCalculator
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
    filters: layout.filters, // Maintain existing filters
  };
}

/**
 * Analyze blur operation
 */
function analyzeBlurOperation(layout: FinalLayout, options: any): void {
  const radius = options.radius || 2;
  layout.filters.push(`blur(${radius}px)`);
}

/**
 * Analyze other filter operations
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
 * Combine all filters into a single string
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
 * 🚀 핵심 함수: 모든 연산을 한 번에 렌더링한다.
 *
 * - 배경을 먼저 그린 뒤 모든 필터를 한꺼번에 적용한다.
 * - drawImage 한 번으로 모든 처리를 완료한다.
 *
 * **Canvas 소유권 규칙 (중요)**
 * - 반환되는 canvas는 {@link CanvasPool}에서 획득하고 즉시 {@link CanvasLease}로 감싼다.
 * - 렌더링 중 오류가 나면 lease가 canvas를 pool로 반환한다.
 *
 * @param precomputedLayout 이미 계산한 layout이 있으면 전달해 중복 분석을 피한다
 */
export function renderAllOperationsOnce(
  sourceImage: HTMLImageElement,
  operations: LazyOperation[],
  precomputedLayout?: FinalLayout
): CanvasLease {
  // 1. Analyze all operations to calculate final layout
  const layout = precomputedLayout ?? analyzeAllOperations(sourceImage, operations);

  // 2. 최종 Canvas 생성 — pool에서 우선 획득
  const canvas = CanvasPool.getInstance().acquire(layout.width, layout.height);
  const lease = new CanvasLease(canvas);

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageProcessError('Cannot create Canvas 2D context', 'CANVAS_CONTEXT_ERROR');
    }

    // 3. Set up high-quality rendering
    setupHighQualityRendering(ctx);

    // 4. Draw background (if needed)
    if (layout.background !== 'transparent') {
      ctx.fillStyle = layout.background;
      ctx.fillRect(0, 0, layout.width, layout.height);
    }

    // 5. Apply all filter effects at once
    if (layout.filters.length > 0) {
      ctx.filter = layout.filters.join(' ');
    }

    // 6. 🎯 Complete all processing with a single drawImage call
    // This is the key to SVG quality preservation
    ctx.drawImage(
      sourceImage,
      Math.round(layout.position.x),
      Math.round(layout.position.y),
      Math.round(layout.imageSize.width),
      Math.round(layout.imageSize.height)
    );

    // 7. Reset filter (for next use)
    ctx.filter = 'none';

    return lease;
  } catch (error) {
    lease.release();
    throw error;
  }
}

/**
 * High-quality rendering setup
 * Settings that maximize SVG vector characteristics
 */
function setupHighQualityRendering(ctx: CanvasRenderingContext2D): void {
  // SVG is vector, so browser automatically provides optimal quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Delegate to browser without scaleFactor or complex calculations
  // This is the core idea of SVG quality preservation
}

/**
 * For debugging: Output layout information
 */
export function debugLayout(layout: FinalLayout, operationCount: number): void {
  debugLog.log('🎯 Single rendering layout:', {
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
