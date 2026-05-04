/**
 * 체이닝 기반 이미지 처리를 담당하는 핵심 클래스다.
 *
 * @description Canvas 2D API를 바탕으로 브라우저 전용 이미지 처리 흐름을 구성한다.
 */

import { CanvasPool } from './base/canvas-pool';
import { LazyRenderPipeline } from './core/lazy-render-pipeline';
import type { SvgPassthroughMode } from './core/source-converter';
import { convertToImageElement } from './core/source-converter';
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
import { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';
import type { IImageProcessor, IShortcutBuilder } from './types/processor-interface';
import type { AfterResizeCall, ProcessorState } from './types/processor-state';
import type { ResizeConfig } from './types/resize-config';
import { validateResizeConfig } from './types/resize-config';
import { BlobResultImpl, CanvasResultImpl, DataURLResultImpl, FileResultImpl } from './types/result-implementations';
import type { ResizeOperation } from './types/shortcut-types';
import type { BeforeResize, InitialProcessor, TypedImageProcessor } from './types/typed-processor';
import { detectCanvasFormatSupport } from './utils/browser-capabilities/index';
import { formatToMimeType, mimeTypeToOutputFormat } from './utils/format-utils';
import { createImageElement } from './utils/image-element';

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
type InternalProcessorOptions = ProcessorOptions & {
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
    if (this.lazyPipeline) {
      return;
    }

    // 입력 소스를 공통 이미지 요소로 바꾼다.
    this.sourceImage = await convertToImageElement(this.source, this.options);

    // 이후 연산을 쌓아 둘 지연 파이프라인을 만든다.
    this.lazyPipeline = new LazyRenderPipeline(this.sourceImage);

    // 초기화 전에 예약된 연산을 순서대로 반영한다.
    if (this.pendingResizeConfig) {
      this.lazyPipeline.addResize(this.pendingResizeConfig);
      this.pendingResizeConfig = null;
    }

    // Shortcut API에서 예약한 리사이즈 연산도 이어서 반영한다.
    if (this.pendingResizeOperation) {
      this.lazyPipeline._addResizeOperation(this.pendingResizeOperation);
      this.pendingResizeOperation = null;
    }

    // 대기 중인 블러 연산도 모두 연결한다.
    for (const blurOption of this.pendingBlurOptions) {
      this.lazyPipeline.addBlur(blurOption);
    }
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
    // 1. Prevent multiple resize calls (prevent quality degradation)
    if (this.hasResized) {
      throw new ImageProcessError(
        'resize() can only be called once. Use a single resize() call to prevent image quality degradation.',
        'MULTIPLE_RESIZE_NOT_ALLOWED'
      );
    }

    // 2. Runtime validation
    validateResizeConfig(config);

    // 3. Record resize call
    this.hasResized = true;

    // 4. Add to LazyRenderPipeline
    // LazyRenderPipeline will be initialized later in ensureLazyPipeline()
    // Only store config here
    this.pendingResizeConfig = config;

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
    const blurOptions: BlurOptions = {
      radius,
      ...options,
    };

    // Add to LazyRenderPipeline
    // blur can be called multiple times, so manage with pending array
    this.pendingBlurOptions = this.pendingBlurOptions || [];
    this.pendingBlurOptions.push(blurOptions);

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
    if (this.hasResized) {
      throw new ImageProcessError(
        'resize() can only be called once. Use a single resize operation to prevent image quality degradation.',
        'MULTIPLE_RESIZE_NOT_ALLOWED'
      );
    }

    this.hasResized = true;

    // Before LazyRenderPipeline initialization: store in pending state
    // After LazyRenderPipeline initialization: pass directly
    if (this.lazyPipeline) {
      // If already initialized, pass directly
      this.lazyPipeline._addResizeOperation(operation);
    } else {
      // If not yet initialized, store in pending state
      // Automatically applied during initialization in ensureLazyPipeline()
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
   * Select optimal format based on browser support
   * @private
   */
  private getBestFormat(): OutputFormat {
    // Check WebP support
    if (this.supportsFormat('webp')) {
      return 'webp';
    }

    // Default: PNG (lossless, transparency support)
    return 'png';
  }

  /**
   * Return optimal quality for each format
   * @private
   */
  private getOptimalQuality(format: ImageFormat): number {
    // Get optimal quality value from OPTIMAL_QUALITY_BY_FORMAT constant
    // Use default value for unsupported output formats like gif, svg
    if (format === 'gif' || format === 'svg') {
      return this.options.defaultQuality ?? 0.8;
    }
    return OPTIMAL_QUALITY_BY_FORMAT[format as OutputFormat] ?? this.options.defaultQuality ?? 0.8;
  }

  /**
   * Check browser format support
   * @private
   */
  private supportsFormat(format: ImageFormat): boolean {
    return detectCanvasFormatSupport(format);
  }

  /**
   * Extract format from filename
   * @private
   */
  private getFormatFromFilename(filename: string): OutputFormat | null {
    const ext = filename.toLowerCase().split('.').pop();

    // Map only supported formats
    const formatMap: Record<string, OutputFormat> = {
      jpg: 'jpeg',
      jpeg: 'jpeg',
      png: 'png',
      webp: 'webp',
      avif: 'avif',
    };

    return formatMap[ext || ''] || null;
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

    // If string, treat as format and apply optimal quality
    const options: OutputOptions =
      typeof optionsOrFormat === 'string'
        ? {
            format: optionsOrFormat,
            quality: this.getOptimalQuality(optionsOrFormat),
          }
        : optionsOrFormat;

    // Smart default format selection: WebP if supported, otherwise PNG
    const smartFormat = this.getBestFormat();

    const outputOptions: Required<OutputOptions> = {
      format: smartFormat,
      quality: this.getOptimalQuality(smartFormat),
      fallbackFormat: 'png',
      ...options,
    };

    // If user provided options but no quality, use format-optimized quality
    if (options.format && options.quality === undefined) {
      outputOptions.quality = this.getOptimalQuality(options.format);
    }

    const { canvas, result } = await this.executeProcessing();

    try {
      const { blob, format } = await this.canvasToBlob(canvas, outputOptions);

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
    // Select appropriate toBlob call method based on type
    const { blob, ...metadata } =
      typeof optionsOrFormat === 'string'
        ? await this.toBlob(optionsOrFormat) // OutputFormat type
        : await this.toBlob(optionsOrFormat); // OutputOptions type

    try {
      const dataURL = await this.blobToDataURL(blob);

      // 🆕 Return extended result object (includes direct conversion methods)
      return new DataURLResultImpl(
        dataURL,
        metadata.width,
        metadata.height,
        metadata.processingTime,
        metadata.originalSize,
        metadata.format
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred during Data URL conversion', 'OUTPUT_FAILED', { cause: error });
    }
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
    // Auto-detect format from file extension
    const formatFromFilename = this.getFormatFromFilename(filename);

    // If options are empty, extract format from filename
    let finalOptions: OutputOptions;
    if (typeof optionsOrFormat === 'string') {
      // String format specified
      finalOptions = { format: optionsOrFormat };
    } else if (Object.keys(optionsOrFormat).length === 0 && formatFromFilename) {
      // Empty object and format detectable from filename
      finalOptions = {
        format: formatFromFilename,
        quality: this.getOptimalQuality(formatFromFilename),
      };
    } else {
      // Use provided options
      finalOptions = optionsOrFormat;
    }

    const { blob, ...metadata } = await this.toBlob(finalOptions);

    try {
      const file = new File([blob], filename, {
        type: blob.type,
        lastModified: Date.now(),
      });

      // 🆕 Return extended result object (includes direct conversion methods)
      return new FileResultImpl(
        file,
        metadata.width,
        metadata.height,
        metadata.processingTime,
        metadata.originalSize,
        metadata.format
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred while creating File object', 'OUTPUT_FAILED', { cause: error });
    }
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
    try {
      const { canvas, result } = await this.executeProcessing();
      return new CanvasResultImpl(
        canvas,
        result.width,
        result.height,
        result.processingTime,
        result.originalSize,
        undefined // Canvas has no format information
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred during Canvas conversion', 'OUTPUT_FAILED', { cause: error });
    }
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
    try {
      const { canvas, result } = await this.executeProcessing();
      return new CanvasResultImpl(
        canvas,
        result.width,
        result.height,
        result.processingTime,
        result.originalSize,
        undefined // Canvas has no format information
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred during detailed Canvas conversion', 'OUTPUT_FAILED', {
        cause: error,
      });
    }
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
    try {
      const { canvas } = await this.executeProcessing();

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          try {
            // blob 변환 시도 후 canvas는 더 이상 필요하지 않으므로 pool에 반환한다.
            CanvasPool.getInstance().release(canvas);

            if (!blob) {
              reject(new ImageProcessError('Blob creation failed', 'CANVAS_TO_BLOB_FAILED'));
              return;
            }

            const objectUrl = URL.createObjectURL(blob);
            const img = createImageElement();

            // loadImageElement 헬퍼 미사용: objectURL revoke 책임이 이 콜백 안에 있으므로
            // 헬퍼 서명(img, src, errorCode)으로는 objectURL 정리를 포함할 수 없다.
            // Promise 결정 시 핸들러를 해제하고 objectURL을 정리한다.
            const cleanup = () => {
              img.onload = null;
              img.onerror = null;
              URL.revokeObjectURL(objectUrl);
            };

            img.onload = () => {
              try {
                cleanup();
                resolve(img);
              } catch (error) {
                reject(
                  new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error })
                );
              }
            };

            img.onerror = () => {
              try {
                cleanup();
                reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
              } catch (error) {
                reject(
                  new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error })
                );
              }
            };

            img.src = objectUrl;
          } catch (error) {
            reject(
              new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error })
            );
          }
        });
      });
    } catch (error) {
      throw new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', { cause: error });
    }
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
      const { canvas } = await this.executeProcessing();

      return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          try {
            // blob 변환 시도 후 canvas는 더 이상 필요하지 않으므로 pool에 반환한다.
            CanvasPool.getInstance().release(canvas);

            if (!blob) {
              reject(new ImageProcessError('Blob creation failed', 'CANVAS_TO_BLOB_FAILED'));
              return;
            }
          } catch (error) {
            reject(
              new ImageProcessError('Error occurred during ArrayBuffer conversion', 'OUTPUT_FAILED', { cause: error })
            );
            return;
          }

          try {
            const arrayBuffer = await blob.arrayBuffer();
            resolve(arrayBuffer);
          } catch (error) {
            reject(
              new ImageProcessError('ArrayBuffer conversion failed', 'BLOB_TO_ARRAYBUFFER_FAILED', { cause: error })
            );
          }
        });
      });
    } catch (error) {
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

  /**
   * Convert Canvas to Blob
   */
  private async canvasToBlob(
    canvas: HTMLCanvasElement,
    options: Required<OutputOptions>
  ): Promise<{ blob: Blob; format: OutputFormat }> {
    const mimeType = formatToMimeType(options.format);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // 브라우저가 요청 포맷 대신 다른 MIME으로 Blob을 반환할 수 있으므로 실제 type 기준으로 포맷을 결정한다.
            const actualFormat = mimeTypeToOutputFormat(blob.type) ?? options.format;
            resolve({ blob, format: actualFormat });
          } else {
            // 요청 포맷 미지원 시 fallback 포맷으로 재시도한다.
            const fallbackMimeType = formatToMimeType(options.fallbackFormat);
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  const actualFallbackFormat = mimeTypeToOutputFormat(fallbackBlob.type) ?? options.fallbackFormat;
                  resolve({ blob: fallbackBlob, format: actualFallbackFormat });
                } else {
                  reject(new Error('Failed to create Blob'));
                }
              },
              fallbackMimeType,
              options.quality
            );
          }
        },
        mimeType,
        options.quality
      );
    });
  }

  /**
   * Convert Blob to Data URL
   */
  private async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert to Data URL'));
      reader.readAsDataURL(blob);
    });
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
 *
 * 적용되는 제약:
 * - 브라우저의 CORS 및 tainted canvas 보안은 이 경로에서도 그대로 적용된다.
 * - SVG 크기 제한(약 10MiB)은 이 경로에서도 유지된다.
 */
export function unsafe_processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, {
    ...options,
    __svgPassthroughMode: 'unsafe-pass-through',
  });
}
