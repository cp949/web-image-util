/**
 * Lazy rendering pipeline - Handle all operations as calculations only and render once at the end
 *
 * Core philosophy: "Calculate first, render once"
 * - Accumulate all resize, blur operations in memory
 * - Perform actual rendering only when toBlob(), toCanvas() is called
 * - Generate final result only without creating intermediate Canvas
 */

import type { BlurOptions, ResultMetadata } from '../types';
import { ImageProcessError } from '../types';
import type { ResizeConfig } from '../types/resize-config';
import type { ResizeOperation, ScaleOperation } from '../types/shortcut-types';
import { analyzeAllOperations, debugLayout, renderAllOperationsOnce } from './single-renderer';

/**
 * Operation definition for lazy execution
 */
export type LazyOperation =
  | { type: 'resize'; config: ResizeConfig }
  | { type: 'blur'; options: BlurOptions }
  | { type: 'filter'; options: any };

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

  /**
   * Add resize operation (calculation only, no rendering)
   * Constraint to allow only one call
   */
  addResize(config: ResizeConfig): this {
    if (this.resizeCalled) {
      throw new ImageProcessError(
        'resize() can only be called once. If you need multiple resizes, use a new processImage()',
        'MULTIPLE_RESIZE_NOT_ALLOWED'
      );
    }
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
   * Add lazy resize operation (Internal method for Shortcut API)
   *
   * @description Store operations that require source size in pending state.
   * Converts to ResizeConfig via convertToResizeConfig at final output.
   *
   * @param operation ResizeOperation (scale, toWidth, toHeight)
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void {
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
   * Analyze all operations and calculate final layout
   * Uses analyzeAllOperations from single-renderer
   */
  private calculateFinalLayout(): FinalLayout {
    return analyzeAllOperations(this.sourceImage, this.operations);
  }

  /**
   * 🚀 Core: Render only once based on all calculation results
   * Uses renderAllOperationsOnce from single-renderer
   */
  private renderOnce(): HTMLCanvasElement {
    return renderAllOperationsOnce(this.sourceImage, this.operations);
  }

  /**
   * Output final result as Blob
   * Actual rendering performed at this point
   */
  async toBlob(format: string = 'image/png', quality?: number): Promise<{ blob: Blob; metadata: ResultMetadata }> {
    const startTime = performance.now();
    const canvas = this.renderOnce();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new ImageProcessError('Blob creation failed', 'BLOB_CONVERSION_ERROR'));
            return;
          }

          const metadata: ResultMetadata = {
            width: canvas.width,
            height: canvas.height,
            format: format as any,
            size: blob.size,
            processingTime: performance.now() - startTime,
            operations: this.operations.length,
          };

          // Output debugging information
          const layout = this.calculateFinalLayout();
          debugLayout(layout, this.operations.length);

          resolve({ blob, metadata });
        },
        format,
        quality
      );
    });
  }

  /**
   * Output final result as Canvas
   * Actual rendering performed at this point
   */
  toCanvas(): { canvas: HTMLCanvasElement; metadata: ResultMetadata } {
    const startTime = performance.now();

    // 🎯 Philosophy implementation: Perform operations only at final output
    if (this.pendingResizeOperation) {
      const resizeConfig = this.convertToResizeConfig(this.pendingResizeOperation);
      this.addResize(resizeConfig); // Utilize existing system
      this.pendingResizeOperation = undefined; // Clean up after processing
    }

    const canvas = this.renderOnce();

    const metadata: ResultMetadata = {
      width: canvas.width,
      height: canvas.height,
      format: 'canvas' as any,
      size: canvas.width * canvas.height * 4, // RGBA estimation
      processingTime: performance.now() - startTime,
      operations: this.operations.length,
    };

    // Output debugging information
    const layout = this.calculateFinalLayout();
    debugLayout(layout, this.operations.length);

    return { canvas, metadata };
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

      // TypeScript exhaustive checking:
      // Default is unreachable since all cases are handled
      // Compile error will occur when new types are added, ensuring safety
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
