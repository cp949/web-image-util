/**
 * 단일 렌더러 — 분석기 하나(analyzeAllOperations), 렌더러 하나(renderLayout)
 *
 * 핵심 개념: "계산 먼저, 렌더링 한 번"
 * - analyzeAllOperations: 모든 연산(resize, blur, filter)을 분석해 최종 레이아웃 계산
 * - renderLayout: 계산된 레이아웃을 검증하고 단 한 번의 drawImage 로 렌더링
 * - 중간 Canvas 를 만들지 않고 최종 결과만 생성한다
 */

import { CanvasLease } from '../base/canvas-lease.internal';
import { CanvasPool } from '../base/canvas-pool.internal';
import { type BlurOptions, ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import { debugLog, productionLog } from '../utils/debug.internal';
import { ResizeCalculator } from './resize-calculator.internal';

/**
 * Operation definition for lazy execution
 *
 * 지연 렌더링 스택의 공유 타입 정의 지점 — 부모(LazyRenderPipeline)가 연산을
 * 누적할 때, 이 파일의 분석기·렌더러가 소비할 때 함께 사용한다.
 */
/**
 * Canvas filter 연산 옵션 — 각 필드는 CSS filter 함수 문자열로 변환된다
 *
 * analyzeFilterOperation 이 brightness(n)·contrast(n)·saturate(n)·
 * hue-rotate(ndeg) 형태로 누적한다. hueRotate 단위는 deg.
 */
export interface CanvasFilterOptions {
  brightness?: number;
  contrast?: number;
  saturate?: number;
  hueRotate?: number;
}

export type LazyOperation =
  | { type: 'resize'; config: ResizeConfig }
  | { type: 'blur'; options: BlurOptions }
  | { type: 'filter'; options: CanvasFilterOptions };

/**
 * Final layout information - Result of analyzing all operations
 */
export interface FinalLayout {
  width: number;
  height: number;
  position: { x: number; y: number };
  imageSize: { width: number; height: number };
  background: string;
  filters: string[];
}

/**
 * 렌더링 품질 수준
 *
 * - low: 속도 우선 (imageSmoothingEnabled = false)
 * - medium: 균형 (imageSmoothingQuality = 'medium')
 * - high: 품질 우선 (imageSmoothingQuality = 'high')
 */
export type RenderQuality = 'low' | 'medium' | 'high';

/**
 * 렌더링 옵션
 *
 * 배경색은 옵션이 아니라 레이아웃({@link FinalLayout.background})이 운반한다 —
 * 분석기가 ResizeConfig 에서 결정한 값을 렌더러는 그대로 그린다.
 */
export interface RenderOptions {
  /**
   * 렌더링 품질 수준
   * @default 'high'
   */
  quality?: RenderQuality;

  /**
   * 이미지 스무딩 명시 오버라이드.
   * 지정하면 quality 에 의한 자동 결정보다 우선한다.
   */
  smoothing?: boolean;
}

/**
 * 모든 연산을 분석해 최종 레이아웃을 계산한다.
 *
 * 복잡한 수학 계산은 전부 이 함수가 담당하고,
 * renderLayout() 은 계산된 레이아웃을 그리는 일만 한다.
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
function analyzeFilterOperation(layout: FinalLayout, options: CanvasFilterOptions): void {
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
 * 🚀 핵심 함수: 계산된 레이아웃을 단 한 번의 drawImage 로 렌더링한다.
 *
 * - 레이아웃 검증(크기·좌표) 후 pool 에서 canvas 를 획득한다.
 * - 배경을 먼저 그린 뒤 모든 필터를 한꺼번에 적용한다.
 * - drawImage 한 번으로 모든 처리를 완료한다 — SVG 품질 보존의 핵심.
 *
 * **Canvas 소유권 규칙 (중요)**
 * - 반환되는 canvas는 {@link CanvasPool}에서 획득하고 즉시 {@link CanvasLease}로 감싼다.
 * - 렌더링 중 오류가 나면 lease가 canvas를 pool로 반환한다.
 *
 * @param layout {@link analyzeAllOperations}가 계산한 최종 레이아웃
 * @param options 품질/스무딩 정책 (생략 시 고품질 스무딩)
 */
export function renderLayout(sourceImage: HTMLImageElement, layout: FinalLayout, options?: RenderOptions): CanvasLease {
  // 1. 레이아웃 검증 — pool 획득 전에 잘못된 값을 걸러낸다
  validateLayout(layout);

  // 2. 최종 Canvas 생성 — pool에서 우선 획득
  const canvas = CanvasPool.getInstance().acquire(Math.round(layout.width), Math.round(layout.height));
  const lease = new CanvasLease(canvas);

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageProcessError('Cannot create Canvas 2D context', 'CANVAS_CONTEXT_ERROR');
    }

    // 3. 품질/스무딩 설정 적용
    applyQualitySettings(ctx, options?.quality ?? 'high', options?.smoothing);

    // 4. 배경 채우기 — transparent 면 아무것도 하지 않는다
    if (layout.background && layout.background !== 'transparent') {
      ctx.fillStyle = layout.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 5. 🎯 drawImage 한 번으로 모든 처리 완료 (필터도 이 시점에 함께 적용)
    // 극단 종횡비에서 imageSize 가 0 으로 반올림되면 그릴 픽셀이 없다 —
    // drawImage 를 건너뛰고 배경만 채운 canvas 를 반환한다.
    const drawWidth = Math.round(layout.imageSize.width);
    const drawHeight = Math.round(layout.imageSize.height);
    if (drawWidth > 0 && drawHeight > 0) {
      if (layout.filters.length > 0) {
        ctx.filter = layout.filters.join(' ');
      }

      ctx.drawImage(sourceImage, Math.round(layout.position.x), Math.round(layout.position.y), drawWidth, drawHeight);

      // 필터 초기화 (pool 재사용 대비)
      ctx.filter = 'none';
    }

    return lease;
  } catch (error) {
    lease.release();
    throw error;
  }
}

/**
 * 레이아웃 검증 — 잘못된 값이면 렌더링 전에 ImageProcessError 를 던진다.
 *
 * - canvas 크기는 유한수이고 반올림 후에도 양수여야 한다 (실제 acquire 에는 반올림 값이 쓰인다)
 * - imageSize 는 음수·비유한수만 오류다. 반올림 0 은 극단 종횡비 입력에서
 *   calculator 가 산출할 수 있는 유효한 축퇴 케이스로, renderLayout 이 drawImage 를 건너뛴다.
 * - 좌표는 유한수여야 한다
 * - 초대형 canvas 는 오류 대신 경고만 남긴다 (기기별 메모리 부족 가능성 안내)
 */
function validateLayout(layout: FinalLayout): void {
  const { width, height, imageSize, position } = layout;

  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.round(width) <= 0 || Math.round(height) <= 0) {
    throw new ImageProcessError(
      `Invalid canvas size: ${width}x${height}. Both dimensions must round to > 0.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-canvas-size', width, height } }
    );
  }

  if (
    !Number.isFinite(imageSize.width) ||
    !Number.isFinite(imageSize.height) ||
    imageSize.width < 0 ||
    imageSize.height < 0
  ) {
    throw new ImageProcessError(
      `Invalid image size: ${imageSize.width}x${imageSize.height}. Both dimensions must be finite and >= 0.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-image-size', width: imageSize.width, height: imageSize.height } }
    );
  }

  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new ImageProcessError(
      `Invalid position: (${position.x}, ${position.y}). Must be finite numbers.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-position', x: position.x, y: position.y } }
    );
  }

  // 16384^2 = 약 2.7억 픽셀, RGBA 기준 약 1GB — 일부 기기에서 메모리 부족 가능
  const maxCanvasArea = 16384 * 16384;
  if (width * height > maxCanvasArea) {
    productionLog.warn(
      `Warning: Large canvas size (${width}x${height}). This may cause memory issues on some devices.`
    );
  }
}

/**
 * Canvas 품질 설정 적용
 *
 * - low: 스무딩 비활성 (속도 우선), medium/high: 해당 수준의 스무딩
 * - smoothingOverride 지정 시 quality 에 의한 자동 결정보다 우선한다
 */
function applyQualitySettings(
  ctx: CanvasRenderingContext2D,
  quality: RenderQuality,
  smoothingOverride?: boolean
): void {
  ctx.imageSmoothingEnabled = smoothingOverride ?? quality !== 'low';

  // imageSmoothingQuality 는 스무딩이 켜진 경우에만 의미가 있다
  if (ctx.imageSmoothingEnabled) {
    ctx.imageSmoothingQuality = quality;
  }
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
