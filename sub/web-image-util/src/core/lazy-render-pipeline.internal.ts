/**
 * Lazy rendering pipeline - Handle all operations as calculations only and render once at the end
 *
 * Core philosophy: "Calculate first, render once"
 * - Accumulate all resize, blur operations in memory
 * - Perform actual rendering only when toBlob(), toCanvas() is called
 * - Generate final result only without creating intermediate Canvas
 *
 * resize 1회 불변식의 런타임 소유자다 — 가드와 설정 검증은 addResize 한 곳에만 있다.
 * (컴파일 타임 전이는 AfterResizeCall 타입이 보조한다)
 */

import type { CanvasLease } from '../base/canvas-lease.internal';
import { createQuickError } from '../base/error-helpers';
import type { BlurOptions, ResultMetadata } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import { validateResizeConfig } from '../types/resize-config';
import { analyzeAllOperations, debugLayout, type LazyOperation, renderLayout } from './single-renderer.internal';

/**
 * Lazy rendering pipeline
 *
 * Unlike traditional pipelines that draw to Canvas immediately for each operation,
 * this completes all calculations first and renders only once at the end.
 *
 * 소스 이미지는 출력 시점에야 로딩되므로 생성 시점에는 받지 않고
 * {@link render}의 인자로 받는다 — 덕분에 OutputPipeline이 생성 직후부터
 * 연산을 이 파이프라인에 직접 축적할 수 있다(pending 재생 없음).
 */
export class LazyRenderPipeline {
  private operations: LazyOperation[] = [];
  private resizeCalled = false;

  /**
   * Add resize operation (calculation only, no rendering)
   *
   * resize 1회 불변식과 설정 검증의 단일 지점이다.
   * 검증 실패 시 어떤 상태도 남기지 않는다.
   */
  addResize(config: ResizeConfig): this {
    if (this.resizeCalled) {
      throw createQuickError('MULTIPLE_RESIZE_NOT_ALLOWED');
    }
    validateResizeConfig(config);
    this.resizeCalled = true;
    this.operations.push({ type: 'resize', config });
    return this;
  }

  /**
   * Add blur operation (calculation only, no rendering)
   * Multiple calls allowed
   */
  addBlur(options: BlurOptions): this {
    this.operations.push({ type: 'blur', options });
    return this;
  }

  /**
   * 🚀 Core: 모든 계산을 마친 뒤 단 한 번 렌더링한다.
   *
   * @param sourceImage 로딩이 끝난 소스 이미지 — scale·단일 축 fill 같은
   *   원본 크기 의존 설정은 이 시점에 ResizeCalculator가 해석한다.
   *
   * 결과 canvas는 pool 소유이며 {@link CanvasLease}에 담겨 반환된다.
   * 소비자는 lease.consume()으로 파생물을 만들거나(사용 후 pool 반환),
   * lease.detach()로 소유권을 가져간다(toCanvas 계열 — pool로 돌아가지 않음).
   */
  render(sourceImage: HTMLImageElement): { lease: CanvasLease; metadata: ResultMetadata } {
    const startTime = performance.now();

    // layout은 한 번만 계산해 렌더링과 디버그 출력에 재사용한다
    const layout = analyzeAllOperations(sourceImage, this.operations);
    const lease = renderLayout(sourceImage, layout);

    try {
      const canvas = lease.canvas;
      const metadata: ResultMetadata = {
        width: canvas.width,
        height: canvas.height,
        // format은 인코딩 시점(toBlob 등)에 결정된다 — 렌더 단계에서는 없다.
        size: canvas.width * canvas.height * 4, // RGBA estimation
        processingTime: performance.now() - startTime,
        operations: this.operations.length,
      };

      debugLayout(layout, this.operations.length);

      return { lease, metadata };
    } catch (error) {
      // 예외 발생 시 canvas를 pool에 반환하여 누수를 방지한다.
      lease.release();
      throw error;
    }
  }

  /**
   * Get operation count (for debugging)
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Get operations list (for debugging)
   */
  getOperations(): LazyOperation[] {
    return [...this.operations];
  }
}
