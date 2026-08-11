/**
 * Lazy rendering pipeline - Handle all operations as calculations only and render once at the end
 *
 * Core philosophy: "Calculate first, render once"
 * - Accumulate all resize, blur operations in memory
 * - Perform actual rendering only when toBlob(), toCanvas() is called
 * - Generate final result only without creating intermediate Canvas
 */

import type { CanvasLease } from '../base/canvas-lease.internal';
import type { BlurOptions, ResultMetadata } from '../types';
import { ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import type { ResizeOperation, ScaleOperation } from '../types/shortcut-types';
import { analyzeAllOperations, debugLayout, type LazyOperation, renderLayout } from './single-renderer.internal';

/**
 * Size information interface
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Lazy rendering pipeline
 *
 * Unlike traditional pipelines that draw to Canvas immediately for each operation,
 * this completes all calculations first and renders only once at the end
 */
export class LazyRenderPipeline {
  private operations: LazyOperation[] = [];
  private sourceImage: HTMLImageElement;
  private resizeCalled = false;
  private pendingResizeOperation?: ResizeOperation;

  constructor(sourceImage: HTMLImageElement) {
    this.sourceImage = sourceImage;
  }

  private assertResizeNotCalled(): void {
    if (this.resizeCalled || this.pendingResizeOperation) {
      throw new ImageProcessError(
        'resize() can only be called once. If you need multiple resizes, use a new processImage()',
        'MULTIPLE_RESIZE_NOT_ALLOWED'
      );
    }
  }

  private appendResize(config: ResizeConfig): void {
    this.operations.push({ type: 'resize', config });
  }

  private applyPendingResizeOperation(): void {
    if (!this.pendingResizeOperation) {
      return;
    }

    const resizeConfig = this.convertToResizeConfig(this.pendingResizeOperation);
    this.appendResize(resizeConfig);
    this.pendingResizeOperation = undefined;
  }

  /**
   * Add resize operation (calculation only, no rendering)
   * Constraint to allow only one call
   */
  addResize(config: ResizeConfig): this {
    this.assertResizeNotCalled();
    this.resizeCalled = true;
    this.appendResize(config);
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
   * Add lazy resize operation (Internal method for Shortcut API)
   *
   * @description Store operations that require source size in pending state.
   * Converts to ResizeConfig via convertToResizeConfig at final output.
   *
   * @param operation ResizeOperation (scale, toWidth, toHeight)
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void {
    this.assertResizeNotCalled();
    this.resizeCalled = true;
    this.pendingResizeOperation = operation;
  }

  /**
   * Add filter operation (calculation only, no rendering)
   */
  addFilter(options: any): this {
    this.operations.push({ type: 'filter', options });
    return this;
  }

  /**
   * 🚀 Core: 모든 계산을 마친 뒤 단 한 번 렌더링한다.
   *
   * 결과 canvas는 pool 소유이며 {@link CanvasLease}에 담겨 반환된다.
   * 소비자는 lease.consume()으로 파생물을 만들거나(사용 후 pool 반환),
   * lease.detach()로 소유권을 가져간다(toCanvas 계열 — pool로 돌아가지 않음).
   */
  render(): { lease: CanvasLease; metadata: ResultMetadata } {
    const startTime = performance.now();

    // 🎯 Philosophy implementation: Perform operations only at final output
    this.applyPendingResizeOperation();

    // layout은 한 번만 계산해 렌더링과 디버그 출력에 재사용한다
    const layout = analyzeAllOperations(this.sourceImage, this.operations);
    const lease = renderLayout(this.sourceImage, layout);

    try {
      const canvas = lease.canvas;
      const metadata: ResultMetadata = {
        width: canvas.width,
        height: canvas.height,
        format: 'canvas' as any,
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

  /**
   * Get source image size
   * @private
   */
  private getSourceSize(): Size {
    return {
      width: this.sourceImage.naturalWidth,
      height: this.sourceImage.naturalHeight,
    };
  }

  /**
   * Convert ResizeOperation to ResizeConfig
   *
   * @description Source size is queried only at this point to generate the final ResizeConfig.
   * Discriminated Union pattern is used to ensure type safety.
   *
   * TypeScript best practices (Context7):
   * - Use switch statement for Discriminated Union type narrowing
   * - Types are automatically narrowed in each case block
   * - Exhaustive checking ensures all cases are handled
   *
   * @param operation ResizeOperation to convert
   * @returns ResizeConfig
   * @private
   */
  private convertToResizeConfig(operation: ResizeOperation): ResizeConfig {
    const sourceSize = this.getSourceSize(); // Query size only at this point!

    // TypeScript best practice: Handle Discriminated Union with switch statement
    // Type is automatically narrowed according to operation.type in each case
    switch (operation.type) {
      case 'scale':
        // operation: { type: 'scale'; value: ScaleOperation }
        return this.handleScale(sourceSize, operation.value);

      case 'toWidth': {
        // operation: { type: 'toWidth'; width: number }
        const aspectRatio = sourceSize.height / sourceSize.width;
        return {
          fit: 'fill',
          width: operation.width,
          height: Math.round(operation.width * aspectRatio),
        };
      }

      case 'toHeight': {
        // operation: { type: 'toHeight'; height: number }
        const aspectRatio = sourceSize.width / sourceSize.height;
        return {
          fit: 'fill',
          width: Math.round(operation.height * aspectRatio),
          height: operation.height,
        };
      }

      default: {
        // 새 ResizeOperation variant 추가 시 컴파일 에러로 누락 감지
        const _exhaustive: never = operation;
        throw new ImageProcessError(
          `Unknown ResizeOperation type: ${(_exhaustive as { type?: unknown }).type ?? 'unknown'}`,
          'INVALID_DIMENSIONS'
        );
      }
    }
  }

  /**
   * Convert ScaleOperation to ResizeConfig
   *
   * @description Handles all 4 forms of ScaleOperation:
   * - number: uniform scale
   * - { sx }: X-axis only scale
   * - { sy }: Y-axis only scale
   * - { sx, sy }: individual X/Y axis scale
   *
   * TypeScript best practices:
   * - Use explicit type guards for Discriminated Union type narrowing
   * - Apply exhaustive checking pattern for type safety
   *
   * @param source Source image size
   * @param scale ScaleOperation
   * @returns ResizeConfig
   * @private
   */
  private handleScale(source: Size, scale: ScaleOperation): ResizeConfig {
    // Case for uniform scale (type: number)
    if (typeof scale === 'number') {
      return {
        fit: 'fill',
        width: Math.round(source.width * scale),
        height: Math.round(source.height * scale),
      };
    }

    // Case for object form: { sx?, sy? }
    // TypeScript best practice: Type narrowing with 'in' operator
    // Apply appropriate default values based on presence of sx and sy
    const sx = 'sx' in scale ? scale.sx : 1;
    const sy = 'sy' in scale ? scale.sy : 1;

    return {
      fit: 'fill',
      width: Math.round(source.width * sx),
      height: Math.round(source.height * sy),
    };
  }
}
