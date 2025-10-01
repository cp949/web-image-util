/**
 * OnehotRenderer: 단일 drawImage 호출 기반 렌더링 엔진
 *
 * @description
 * - 단일 drawImage() 호출로 리사이징과 패딩을 동시에 처리
 * - ResizeCalculator가 계산한 레이아웃 정보를 기반으로 렌더링
 * - Canvas 품질 설정 및 최적화 담당
 * - 메모리 효율적인 Canvas 관리
 *
 * @design-philosophy
 * - 계산(ResizeCalculator)과 렌더링(OnehotRenderer)의 명확한 분리
 * - 단일 책임: 렌더링만 수행, 계산 로직 없음
 * - Canvas 2D API 호환성 고려
 */

import type { ResizeConfig } from '../types/resize-config';
import type { LayoutResult } from './resize-calculator';
import { productionLog } from '../utils/debug';

// ============================================================================
// INTERFACES - 인터페이스 정의
// ============================================================================

/**
 * 렌더링 품질 수준
 *
 * @description
 * - low: 속도 우선 (imageSmoothingEnabled = false)
 * - medium: 균형 (기본 브라우저 설정)
 * - high: 품질 우선 (imageSmoothingQuality = 'high')
 */
export type RenderQuality = 'low' | 'medium' | 'high';

/**
 * 렌더링 옵션
 *
 * @description
 * OnehotRenderer의 render() 메서드에 전달되는 옵션
 * - background: 배경색 (패딩 영역 색상)
 * - quality: 렌더링 품질 수준
 * - smoothing: 이미지 스무딩 활성화 여부 (명시적 제어)
 */
export interface RenderOptions {
  /**
   * 배경색 (CSS 색상 문자열)
   * @default 'transparent'
   * @example '#ffffff', 'rgba(255, 255, 255, 0.5)'
   */
  background?: string;

  /**
   * 렌더링 품질 수준
   * @default 'high'
   */
  quality?: RenderQuality;

  /**
   * 이미지 스무딩 활성화 여부
   * @default true (quality 설정에 따라 자동 결정되지만 명시적 재정의 가능)
   */
  smoothing?: boolean;
}

// ============================================================================
// CLASS - OnehotRenderer 클래스
// ============================================================================

/**
 * OnehotRenderer 클래스
 *
 * @description
 * 단일 drawImage 호출로 리사이징과 패딩을 동시에 처리하는 렌더링 엔진
 *
 * @example
 * ```typescript
 * const renderer = new OnehotRenderer();
 * const layout = calculator.calculateFinalLayout(sourceSize, config);
 * const outputCanvas = renderer.render(sourceCanvas, layout, config);
 * ```
 */
export class OnehotRenderer {
  /**
   * 메인 렌더링 메서드
   *
   * @description
   * ResizeCalculator가 계산한 레이아웃 정보를 기반으로 실제 렌더링 수행
   * - 새 캔버스 생성 (layout.canvasSize 기반)
   * - 배경색 채우기 (options.background)
   * - 단일 drawImage 호출로 리사이징 + 위치 조정
   *
   * @param sourceCanvas 원본 이미지가 로드된 캔버스
   * @param layout ResizeCalculator가 계산한 레이아웃 정보
   * @param config ResizeConfig (옵션 정보 포함)
   * @param options 렌더링 옵션 (배경색, 품질 등)
   * @returns 렌더링된 결과 캔버스
   *
   * @example
   * ```typescript
   * const output = renderer.render(sourceCanvas, layout, config, {
   *   background: '#ffffff',
   *   quality: 'high'
   * });
   * ```
   */
  render(
    sourceCanvas: HTMLCanvasElement,
    layout: LayoutResult,
    config: ResizeConfig,
    options?: RenderOptions
  ): HTMLCanvasElement {
    // 1. 출력 캔버스 생성 및 크기 검증
    this.validateLayout(layout);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(layout.canvasSize.width);
    canvas.height = Math.round(layout.canvasSize.height);

    // 2. 컨텍스트 설정 (품질 옵션 적용)
    const ctx = this.setupCanvas(canvas, options);

    // 3. 배경색 채우기
    const background = options?.background ?? config.background ?? 'transparent';
    this.applyBackground(ctx, canvas.width, canvas.height, background);

    // 4. 🚀 핵심: 단일 drawImage 호출로 리사이징 + 위치 조정 동시 수행
    // 부동소수점 좌표 처리를 위해 Math.round 적용
    ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height, // 소스 영역 (원본 이미지 전체)
      Math.round(layout.position.x),
      Math.round(layout.position.y), // 대상 위치 (패딩 고려)
      Math.round(layout.imageSize.width),
      Math.round(layout.imageSize.height) // 대상 크기 (리사이징됨)
    );

    return canvas;
  }

  /**
   * 캔버스 컨텍스트 설정
   *
   * @description
   * Canvas 2D 컨텍스트를 가져오고 품질 설정 적용
   * - imageSmoothingEnabled
   * - imageSmoothingQuality
   *
   * @param canvas 설정할 캔버스
   * @param options 렌더링 옵션
   * @returns 설정이 적용된 2D 컨텍스트
   *
   * @throws {Error} 2D 컨텍스트를 가져올 수 없는 경우
   */
  private setupCanvas(canvas: HTMLCanvasElement, options?: RenderOptions): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // 품질 설정 적용
    const quality = options?.quality ?? 'high';
    this.applyQualitySettings(ctx, quality, options?.smoothing);

    return ctx;
  }

  /**
   * Canvas 품질 설정 적용
   *
   * @description
   * RenderQuality에 따라 Canvas 2D 컨텍스트의 품질 관련 속성 설정
   * - low: imageSmoothingEnabled = false (속도 우선)
   * - medium: imageSmoothingEnabled = true, imageSmoothingQuality = 'medium'
   * - high: imageSmoothingEnabled = true, imageSmoothingQuality = 'high'
   *
   * @param ctx Canvas 2D 컨텍스트
   * @param quality 품질 수준
   * @param smoothingOverride 스무딩 명시적 재정의 (옵션)
   */
  private applyQualitySettings(
    ctx: CanvasRenderingContext2D,
    quality: RenderQuality,
    smoothingOverride?: boolean
  ): void {
    // 스무딩 활성화 여부
    if (smoothingOverride !== undefined) {
      // 명시적 재정의가 있으면 우선 적용
      ctx.imageSmoothingEnabled = smoothingOverride;
    } else {
      // quality에 따라 자동 결정
      ctx.imageSmoothingEnabled = quality !== 'low';
    }

    // imageSmoothingQuality 설정 (스무딩이 활성화된 경우만)
    if (ctx.imageSmoothingEnabled) {
      ctx.imageSmoothingQuality = quality;
    }
  }

  /**
   * 배경색 적용
   *
   * @description
   * Canvas에 배경색을 채움. 투명 배경인 경우 아무것도 하지 않음.
   * - 'transparent': 아무것도 하지 않음 (투명 배경 유지)
   * - CSS 색상 문자열: fillStyle로 설정하고 fillRect로 채움
   *
   * @param ctx Canvas 2D 컨텍스트
   * @param width Canvas 너비
   * @param height Canvas 높이
   * @param background 배경색 (CSS 색상 문자열 또는 'transparent')
   *
   * @example
   * ```typescript
   * applyBackground(ctx, 800, 600, '#ffffff');  // 흰색 배경
   * applyBackground(ctx, 800, 600, 'rgba(0, 0, 0, 0.5)');  // 반투명 검은색
   * applyBackground(ctx, 800, 600, 'transparent');  // 투명 (아무것도 안함)
   * ```
   */
  private applyBackground(ctx: CanvasRenderingContext2D, width: number, height: number, background: string): void {
    // 투명 배경인 경우 아무것도 하지 않음
    if (background === 'transparent' || !background) {
      return;
    }

    // 배경색 채우기
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * 레이아웃 검증
   *
   * @description
   * LayoutResult가 유효한 값인지 검증. 잘못된 값이면 에러 발생.
   * - Canvas 크기가 0 이하이면 안됨
   * - 이미지 크기가 0 이하이면 안됨
   * - 좌표가 NaN이거나 Infinity이면 안됨
   *
   * @param layout 검증할 레이아웃
   * @throws {Error} 레이아웃이 유효하지 않은 경우
   */
  private validateLayout(layout: LayoutResult): void {
    const { canvasSize, imageSize, position } = layout;

    // Canvas 크기 검증
    if (canvasSize.width <= 0 || canvasSize.height <= 0) {
      throw new Error(`Invalid canvas size: ${canvasSize.width}x${canvasSize.height}. Both dimensions must be > 0.`);
    }

    // 이미지 크기 검증
    if (imageSize.width <= 0 || imageSize.height <= 0) {
      throw new Error(`Invalid image size: ${imageSize.width}x${imageSize.height}. Both dimensions must be > 0.`);
    }

    // 좌표 검증 (NaN 또는 Infinity 체크)
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      throw new Error(`Invalid position: (${position.x}, ${position.y}). Must be finite numbers.`);
    }

    // Canvas 크기가 너무 큰 경우 경고 (메모리 부족 가능성)
    const maxCanvasArea = 16384 * 16384; // 약 268MB (RGBA 기준)
    const canvasArea = canvasSize.width * canvasSize.height;
    if (canvasArea > maxCanvasArea) {
      productionLog.warn(
        `Warning: Large canvas size (${canvasSize.width}x${canvasSize.height}). ` +
          `This may cause memory issues on some devices.`
      );
    }
  }
}
