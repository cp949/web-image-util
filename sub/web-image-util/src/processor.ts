/**
 * 체이닝 기반 이미지 처리를 담당하는 핵심 클래스다.
 *
 * @description Canvas 2D API를 바탕으로 브라우저 전용 이미지 처리 흐름을 구성한다.
 */

import { CanvasPool } from './base/canvas-pool.internal';
import type { LazyRenderPipeline } from './core/lazy-render-pipeline.internal';
import type { SvgPassthroughMode } from './core/source-converter.internal';
import { canvasToBlobOutput } from './processor/blob-output.internal';
import { renderToCanvasResult } from './processor/canvas-output.internal';
import { blobToImageElement } from './processor/dom-output.internal';
import { blobResultToDataURL, blobResultToFile } from './processor/encoded-output.internal';
import { getBestFormat, getOptimalQuality } from './processor/format-helpers.internal';
import {
  MULTIPLE_RESIZE_OPERATION_MESSAGE,
  MULTIPLE_RESIZE_RESIZE_MESSAGE,
} from './processor/operation-helpers.internal';
import { resolveFileOutput } from './processor/output-helpers.internal';
import { resolveOutputOptions } from './processor/output-options.internal';
import { setupLazyPipeline } from './processor/pipeline-setup.internal';
import { appendBlurState, applyResizeState, planResizeOperation } from './processor/state-helpers.internal';
import { ShortcutBuilder } from './shortcut/shortcut-builder';
import type {
  BlurOptions,
  ImageFormat,
  ImageSource,
  OutputFormat,
  OutputOptions,
  ProcessorOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultFile,
} from './types';
import { ImageProcessError } from './types';
import type { IImageProcessor, IShortcutBuilder } from './types/processor-interface';
import type { AfterResizeCall, ProcessorState } from './types/processor-state';
import type { ResizeConfig } from './types/resize-config';
import { BlobResultImpl } from './types/result-implementations.internal';
import type { ResizeOperation } from './types/shortcut-types';
import type { BeforeResize, InitialProcessor, TypedImageProcessor } from './types/typed-processor';

/**
 * 타입 안전한 이미지 처리 체이닝 API를 제공한다.
 *
 * @description resize 1회 제한, 지연 렌더링, 브라우저 포맷 선택을 한 곳에서 관리한다.
 *
 * @template TState 프로세서 상태
 *
 * @example
 * ```typescript
 * // ✅ Correct usage: call resize() only once
 * const result = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // ❌ Compilation error: duplicate resize() calls
 * const processor = processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 Type error!
 *
 * // ✅ For multiple sizes: use separate instances
 * const small = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
 * const large = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
 * ```
 */

// 공개 ProcessorOptions를 확장하는 내부 전용 옵션 타입이다.
// 내부 helper(pipeline-setup 등)에서 재사용하므로 export하되, index.ts에서 re-export하지 않는다.
export type InternalProcessorOptions = ProcessorOptions & {
  __svgPassthroughMode?: SvgPassthroughMode;
};

export class ImageProcessor<TState extends ProcessorState = BeforeResize>
  implements TypedImageProcessor<TState>, IImageProcessor<TState>
{
  private lazyPipeline: LazyRenderPipeline | null = null;
  private sourceImage: HTMLImageElement | null = null;
  private options: InternalProcessorOptions;
  private hasResized = false;
  private pendingResizeConfig: ResizeConfig | null = null;
  private pendingBlurOptions: BlurOptions[] = [];
  private pendingResizeOperation: ResizeOperation | null = null;

  constructor(
    private source: ImageSource,
    options: InternalProcessorOptions = {}
  ) {
    this.options = {
      crossOrigin: 'anonymous',
      defaultQuality: 0.8,
      defaultBackground: { r: 0, g: 0, b: 0, alpha: 0 },
      __svgPassthroughMode: 'safe',
      ...options,
    };
  }

  /**
   * 입력 소스를 HTMLImageElement로 정규화하고 지연 파이프라인을 준비한다.
   */
  private async ensureLazyPipeline(): Promise<void> {
    // 이미 초기화됐으면 pending을 건드리지 않고 그대로 둔다.
    if (this.lazyPipeline) {
      return;
    }

    // source 로딩, pipeline 생성, pending 연산 반영은 helper가 담당한다.
    const result = await setupLazyPipeline({
      source: this.source,
      options: this.options,
      currentPipeline: this.lazyPipeline,
      currentSourceImage: this.sourceImage,
      pendingResizeConfig: this.pendingResizeConfig,
      pendingResizeOperation: this.pendingResizeOperation,
      pendingBlurOptions: this.pendingBlurOptions,
    });

    this.lazyPipeline = result.lazyPipeline;
    this.sourceImage = result.sourceImage;

    // helper가 반영을 끝냈으므로 pending 필드를 비운다.
    this.pendingResizeConfig = null;
    this.pendingResizeOperation = null;
    this.pendingBlurOptions = [];
  }

  /**
   * Image resizing
   *
   * @description
   * **Important: Can only be called once**
   * - Prevents quality degradation: Multiple resizing causes vector (SVG) → raster conversion quality loss
   * - Performance optimization: Prevents unnecessary intermediate Canvas creation
   * - TypeScript prevents duplicate calls at compile time
   *
   * @param config Resize configuration (ResizeConfig)
   * @param _constraint Type-level constraint (internal use, please ignore)
   * @returns Processor in AfterResize state (blur, toBlob etc. available)
   *
   * @throws {ImageProcessError} Runtime error if resize() is called more than once
   *
   * @example
   * ```typescript
   * // ✅ Correct usage: call resize() only once
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(2)
   *   .toBlob();
   *
   * // ❌ Compilation error: duplicate resize() calls
   * processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 Type error!
   *
   * // ✅ For multiple sizes: create separate instances
   * const small = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
   * const large = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
   * ```
   */
  resize(config: ResizeConfig): ImageProcessor<AfterResizeCall<TState>> {
    // 검증과 상태 전이는 helper에 위임하고, 결과만 필드에 반영한다.
    const update = applyResizeState(this.hasResized, config, MULTIPLE_RESIZE_RESIZE_MESSAGE);
    this.hasResized = update.hasResized;
    this.pendingResizeConfig = update.pendingResizeConfig;

    return this as unknown as ImageProcessor<AfterResizeCall<TState>>;
  }

  /**
   * Image blur effect
   *
   * @description
   * Applies Gaussian blur to the image using Canvas 2D filter API.
   * Can be used before or after resize(), and can be called multiple times for cumulative effect.
   *
   * **Performance Considerations:**
   * - Recommended range: 0.5-10 pixels (higher values may cause performance issues)
   * - Blur before resize for better performance on large images
   * - Multiple blur calls are cumulative (blur(2) + blur(3) = blur(5) effect)
   *
   * @param radius Blur radius in pixels (default: 2, recommended range: 0.5-10)
   * @param options Blur options (additional settings, currently unused but reserved for future extensions)
   * @returns Processor in same state (chainable)
   *
   * @example
   * ```typescript
   * // Apply subtle blur before resize (recommended for performance)
   * await processImage(source)
   *   .blur(2)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .toBlob();
   *
   * // Apply strong blur after resize
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(5)
   *   .toBlob();
   *
   * // Multiple blur applications (cumulative effect)
   * await processImage(source)
   *   .blur(2)     // First blur: 2px
   *   .blur(3)     // Total blur: 5px (2+3)
   *   .toBlob();
   *
   * // Performance-optimized blur for thumbnails
   * await processImage(source)
   *   .blur(1)     // Light blur before resize
   *   .resize({ fit: 'cover', width: 150, height: 150 })
   *   .toBlob();
   * ```
   */
  blur(radius: number = 2, options: Partial<BlurOptions> = {}): ImageProcessor<TState> {
    // blur 옵션 누적은 helper에 위임한다(호출 순서 보존).
    this.pendingBlurOptions = appendBlurState(this.pendingBlurOptions, radius, options);

    return this as ImageProcessor<TState>;
  }

  /**
   * Add lazy resize operation (internal method for Shortcut API)
   *
   * @description Internal API used by ShortcutBuilder.
   * Stores operations requiring source size (scale, toWidth, toHeight) in pending state.
   * Actual conversion is performed at final output time (toBlob, toCanvas, etc.).
   *
   * @param operation ResizeOperation (scale, toWidth, toHeight)
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void {
    // resize 1회 제약 검사와 pending/즉시 적용 분기 결정은 helper에 위임한다.
    const plan = planResizeOperation(this.hasResized, this.lazyPipeline !== null, MULTIPLE_RESIZE_OPERATION_MESSAGE);

    this.hasResized = true;

    if (plan.mode === 'apply') {
      // 이미 초기화된 경우 즉시 전달
      this.lazyPipeline?._addResizeOperation(operation);
    } else {
      // 아직 초기화되지 않은 경우 pending 저장 (ensureLazyPipeline()에서 자동 반영)
      this.pendingResizeOperation = operation;
    }
  }

  /**
   * Shortcut API accessor
   *
   * @description
   * Returns ShortcutBuilder that provides convenient resizing methods.
   * Allows resizing with intuitive method names instead of complex ResizeConfig.
   *
   * @returns ShortcutBuilder instance
   *
   * @example
   * ```typescript
   * // Standard approach
   * await processImage(src).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();
   *
   * // Shortcut API (more concise)
   * await processImage(src).shortcut.coverBox(300, 200).toBlob();
   *
   * // Various shortcut method examples
   * await processImage(src).shortcut.maxWidth(500).toBlob();                        // Maximum width constraint
   * await processImage(src).shortcut.containBox(300, 200, { withoutEnlargement: true }).toBlob();  // Prevent enlargement
   * await processImage(src).shortcut.exactSize(400, 300).toBlob();                  // Exact size
   * await processImage(src).shortcut.scale(1.5).toBlob();                           // Scale adjustment
   * ```
   */
  get shortcut(): IShortcutBuilder<TState> {
    return new ShortcutBuilder(this);
  }

  // ==============================================
  // Smart format selection and optimization methods
  // ==============================================

  /**
   * 브라우저 지원에 따라 최적 출력 포맷을 선택한다.
   * @private
   */
  private getBestFormat(): OutputFormat {
    return getBestFormat();
  }

  /**
   * 포맷별 권장 품질을 반환한다. (defaultQuality 기반 fallback 포함)
   * @private
   */
  private getOptimalQuality(format: ImageFormat): number {
    return getOptimalQuality(format, this.options.defaultQuality);
  }

  /**
   * Convert to Blob (with metadata)
   *
   * @param options Output options
   * @returns Processed image Blob with metadata
   *
   * @example
   * ```typescript
   * // Use defaults (WebP/quality 0.8 if supported, PNG/quality 0.8 if not)
   * const result = await processor.toBlob()
   *
   * // Explicit options
   * const result = await processor.toBlob({
   *   format: 'webp',
   *   quality: 0.8
   * })
   *
   * // Format only (optimal quality auto-selected)
   * const result = await processor.toBlob('jpeg') // Quality 0.85 auto-applied
   *
   * // Using metadata
   * const { blob, width, height, processingTime } = result;
   * console.log(`${width}x${height} image, ${processingTime}ms elapsed`);
   * ```
   */

  async toBlob(options?: OutputOptions): Promise<ResultBlob>;
  async toBlob(format: OutputFormat): Promise<ResultBlob>;
  async toBlob(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultBlob> {
    // ✅ All sources use the same pipeline (SVG branching removed)

    // 옵션 정규화를 헬퍼에 위임한다.
    const outputOptions = resolveOutputOptions({
      optionsOrFormat,
      getBestFormat: () => this.getBestFormat(),
      getOptimalQuality: (f) => this.getOptimalQuality(f),
    });

    const { canvas, result } = await this.executeProcessing();

    try {
      const { blob, format } = await canvasToBlobOutput(canvas, outputOptions);

      // 🆕 Return extended result object (includes direct conversion methods)
      return new BlobResultImpl(blob, result.width, result.height, result.processingTime, result.originalSize, format);
    } catch (error) {
      throw new ImageProcessError('Error occurred during Blob conversion', 'OUTPUT_FAILED', { cause: error });
    } finally {
      // blob 변환이 끝났으므로 pool-acquired canvas를 반환한다.
      CanvasPool.getInstance().release(canvas);
    }
  }

  /**
   * Convert to Data URL (with metadata)
   *
   * @param options Output options
   * @returns Processed image Data URL with metadata
   *
   * @example
   * ```typescript
   * // Use defaults (WebP/quality 0.8 if supported, PNG/quality 1.0 if not)
   * const result = await processor.toDataURL()
   *
   * // Explicit options
   * const result = await processor.toDataURL({
   *   format: 'jpeg',
   *   quality: 0.9
   * });
   *
   * // Format only (optimal quality auto-selected)
   * const result2 = await processor.toDataURL('webp'); // Quality 0.8 auto-applied
   *
   * // Can be used directly in img tag
   * imgElement.src = result.dataURL;
   * ```
   */
  async toDataURL(options?: OutputOptions): Promise<ResultDataURL>;
  async toDataURL(format: OutputFormat): Promise<ResultDataURL>;
  async toDataURL(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultDataURL> {
    const blobResult = await this.toBlob(optionsOrFormat as OutputOptions);
    return blobResultToDataURL(blobResult);
  }

  /**
   * Convert to File object (with metadata)
   *
   * @param filename File name
   * @param options Output options (if empty, format auto-detected from file extension)
   * @returns Processed image File with metadata
   *
   * @example
   * ```typescript
   * // Explicit options
   * const result = await processor.toFile('thumbnail.webp', {
   *   format: 'webp',
   *   quality: 0.8
   * });
   *
   * // Auto-detect format from filename + optimal quality
   * const result2 = await processor.toFile('image.jpg'); // JPEG/quality 0.85 auto-applied
   * const result3 = await processor.toFile('thumbnail.webp'); // WebP/quality 0.8 auto-applied
   *
   * // Format only (optimal quality auto-selected)
   * const result4 = await processor.toFile('image.jpg', 'jpeg'); // Quality 0.85 auto-applied
   *
   * // Add to FormData for upload
   * const formData = new FormData();
   * formData.append('image', result.file);
   * ```
   */
  async toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;
  async toFile(filename: string, format: OutputFormat): Promise<ResultFile>;
  async toFile(filename: string, optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultFile> {
    // 포맷/파일명 해석은 헬퍼에 위임한다.
    const { finalOptions, resolvedFilename } = resolveFileOutput(
      filename,
      optionsOrFormat,
      this.options.defaultQuality
    );
    const blobResult = await this.toBlob(finalOptions);
    return blobResultToFile(blobResult, resolvedFilename);
  }

  /**
   * Convert to Canvas (with metadata)
   *
   * @returns Result object containing processed Canvas with metadata
   *
   * @example
   * ```typescript
   * const result = await processor.toCanvas();
   * // Both Canvas element and metadata are available
   * document.body.appendChild(result.canvas);
   * console.log(`${result.width}x${result.height}, ${result.processingTime}ms`);
   * ```
   */
  async toCanvas(): Promise<ResultCanvas> {
    return renderToCanvasResult(() => this.executeProcessing(), 'Error occurred during Canvas conversion');
  }

  /**
   * Canvas result with metadata
   *
   * @returns Result object containing Canvas with metadata
   *
   * @example
   * ```typescript
   * const result = await processor.toCanvasDetailed();
   * console.log(`${result.width}x${result.height} Canvas, ${result.processingTime}ms elapsed`);
   * ```
   */
  async toCanvasDetailed(): Promise<ResultCanvas> {
    return renderToCanvasResult(() => this.executeProcessing(), 'Error occurred during detailed Canvas conversion');
  }

  /**
   * Create HTMLImageElement directly
   * Optimized path: Canvas → Blob → ObjectURL → Image
   *
   * @returns HTMLImageElement
   *
   * @example
   * ```typescript
   * const imgElement = await processor.toElement();
   * document.body.appendChild(imgElement);
   * ```
   */
  async toElement(): Promise<HTMLImageElement> {
    let blobResult: ResultBlob;
    try {
      blobResult = await this.toBlob('png');
    } catch (error) {
      throw new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error });
    }

    return blobToImageElement(blobResult.blob);
  }

  /**
   * Convert to ArrayBuffer directly
   * Optimized path: Canvas → Blob → ArrayBuffer
   *
   * @returns ArrayBuffer
   *
   * @example
   * ```typescript
   * const buffer = await processor.toArrayBuffer();
   * const uint8Array = new Uint8Array(buffer);
   * ```
   */
  async toArrayBuffer(): Promise<ArrayBuffer> {
    try {
      const blobResult = await this.toBlob('png');

      try {
        return await blobResult.blob.arrayBuffer();
      } catch (error) {
        throw new ImageProcessError('ArrayBuffer conversion failed', 'BLOB_TO_ARRAYBUFFER_FAILED', { cause: error });
      }
    } catch (error) {
      if (error instanceof ImageProcessError && error.code === 'BLOB_TO_ARRAYBUFFER_FAILED') {
        throw error;
      }

      throw new ImageProcessError('Error occurred during ArrayBuffer conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /**
   * Convert to Uint8Array directly
   *
   * @returns Uint8Array
   *
   * @example
   * ```typescript
   * const uint8Array = await processor.toUint8Array();
   * console.log('Image data size:', uint8Array.length);
   * ```
   */
  async toUint8Array(): Promise<Uint8Array> {
    try {
      const arrayBuffer = await this.toArrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new ImageProcessError('Error occurred during Uint8Array conversion', 'OUTPUT_FAILED', { cause: error });
    }
  }

  /**
   * Execute pipeline processing
   */
  private async executeProcessing() {
    try {
      // Process with LazyRenderPipeline
      await this.ensureLazyPipeline();

      if (!this.lazyPipeline) {
        throw new ImageProcessError('LazyRenderPipeline initialization failed', 'PROCESSING_FAILED');
      }

      const { canvas, metadata } = this.lazyPipeline.toCanvas();

      return {
        canvas,
        result: {
          width: metadata.width,
          height: metadata.height,
          processingTime: metadata.processingTime,
          originalSize: {
            width: this.sourceImage?.naturalWidth || 0,
            height: this.sourceImage?.naturalHeight || 0,
          },
          operations: metadata.operations,
        },
      };
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }

      throw new ImageProcessError('Error occurred during image processing', 'CANVAS_CREATION_FAILED', { cause: error });
    }
  }

  // ==============================================
  // ✅ SVG-specific processing path removed - all sources use unified pipeline
  // ==============================================
}

/**
 * Image processor factory function
 *
 * @description
 * Creates ImageProcessor instance from various types of image sources.
 * Utilizes TypeScript type system to prevent duplicate resize() calls at compile time.
 *
 * @param source Image source (HTMLImageElement, Blob, URL, Data URL, SVG, ArrayBuffer, etc.)
 * @param options Processor options (crossOrigin, defaultQuality, etc.)
 * @returns ImageProcessor in BeforeResize state (resize() callable)
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await processImage(imageElement)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // Various source type support
 * processImage(blob)                    // Blob
 * processImage('https://example.com/image.jpg')  // HTTP URL
 * processImage('data:image/svg+xml,...')         // Data URL
 * processImage('<svg>...</svg>')                 // SVG XML
 * processImage(arrayBuffer)                       // ArrayBuffer
 *
 * // Usage with options
 * const processor = processImage(source, {
 *   crossOrigin: 'use-credentials',
 *   defaultQuality: 0.9,
 *   defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 }
 * });
 *
 * // When multiple sizes needed: create separate instances
 * const thumbnail = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
 * const fullsize = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
 *
 * // SVG with strict sanitizer opt-in for untrusted input
 * await processImage(userProvidedSource, { svgSanitizer: 'strict' })
 *   .resize({ fit: 'cover', width: 300, height: 300 })
 *   .toBlob();
 * ```
 */
export function processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, options);
}

/**
 * 개발 및 디버깅 전용 SVG escape hatch.
 *
 * `processImage()`가 적용하는 경량 방어층(lightweight safety guard)과 브라우저
 * 호환성 보정을 모두 건너뛰고 원본 SVG를 그대로 로딩한다. 렌더링 문제를 재현하거나
 * 디버깅하는 등 신뢰할 수 있는 입력에 대해서만 사용한다.
 *
 * 위험 경고:
 * - 신뢰할 수 없는 SVG에는 절대 사용하지 않는다.
 * - `<script>`, `on*` 이벤트 핸들러, 외부 `href`/`xlink:href`/`src`,
 *   외부 CSS `url(...)`이 모두 그대로 통과되어 XSS와 canvas taint 위험이 발생한다.
 * - 신뢰할 수 없는 SVG는 `processImage(source, { svgSanitizer: 'strict' })`를 사용한다.
 * - 이미 자체 정제를 끝냈고 sanitizer/assert만 건너뛰려면 `processImage(source, { svgSanitizer: 'skip' })`를 사용한다.
 * - 이 API는 compatibility enhancement까지 건너뛰는 하위 호환 escape hatch이며, `svgSanitizer: 'skip'`과 동일하지 않다.
 * - `unsafe_processImage()`에는 `svgSanitizer` 옵션을 적용할 수 없다. sanitizer 정책이 필요하면 `processImage()`를 사용한다.
 *
 * 적용되는 제약:
 * - 브라우저의 CORS 및 tainted canvas 보안은 이 경로에서도 그대로 적용된다.
 * - SVG 크기 제한(약 10MiB)은 이 경로에서도 유지된다.
 */
export function unsafe_processImage(
  source: ImageSource,
  options?: Omit<ProcessorOptions, 'svgSanitizer'>
): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, {
    ...options,
    __svgPassthroughMode: 'unsafe-pass-through',
  });
}
