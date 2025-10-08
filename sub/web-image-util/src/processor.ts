/**
 * Image Processor - Core class for chaining API
 *
 * @description
 * Browser-only image processor based on Canvas 2D API
 * - Intuitive API through method chaining
 * - Compile-time safety using TypeScript type system
 * - Performance optimized with lazy rendering pipeline
 */

import { LazyRenderPipeline } from './core/lazy-render-pipeline';
import { convertToImageElement } from './core/source-converter';
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
import type { AfterResizeCall, EnsureCanResize, ProcessorState } from './types/processor-state';
import type { IImageProcessor, IShortcutBuilder } from './types/processor-interface';
import type { ResizeOperation } from './types/shortcut-types';
import type { ResizeConfig } from './types/resize-config';
import { validateResizeConfig } from './types/resize-config';
import { BlobResultImpl, CanvasResultImpl, DataURLResultImpl, FileResultImpl } from './types/result-implementations';
import type { BeforeResize, InitialProcessor, TypedImageProcessor } from './types/typed-processor';
import { ShortcutBuilder } from './shortcut/shortcut-builder';

/**
 * Image Processor Class
 *
 * @description
 * Image processing class providing type-safe method chaining API
 *
 * **Core Design Principles:**
 * - resize() can only be called once (prevents quality degradation)
 * - Compile-time safety guaranteed by TypeScript type system
 * - Performance optimized with lazy rendering (renders only once at final output)
 *
 * @template TState Processor state (BeforeResize | AfterResize)
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
export class ImageProcessor<TState extends ProcessorState = BeforeResize>
  implements TypedImageProcessor<TState>, IImageProcessor<TState>
{
  private lazyPipeline: LazyRenderPipeline | null = null;
  private sourceImage: HTMLImageElement | null = null;
  private options: ProcessorOptions;
  private hasResized = false;
  private pendingResizeConfig: ResizeConfig | null = null;
  private pendingBlurOptions: BlurOptions[] = [];
  private pendingResizeOperation: ResizeOperation | null = null;

  constructor(
    private source: ImageSource,
    options: ProcessorOptions = {}
  ) {
    this.options = {
      crossOrigin: 'anonymous',
      defaultQuality: 0.8,
      defaultBackground: { r: 0, g: 0, b: 0, alpha: 0 },
      ...options,
    };
  }

  /**
   * Convert source image to HTMLImageElement and initialize LazyRenderPipeline
   */
  private async ensureLazyPipeline(): Promise<void> {
    if (this.lazyPipeline) {
      return;
    }

    // Convert source to HTMLImageElement
    this.sourceImage = await convertToImageElement(this.source, this.options);

    // Initialize LazyRenderPipeline
    this.lazyPipeline = new LazyRenderPipeline(this.sourceImage);

    // Apply pending operations
    if (this.pendingResizeConfig) {
      this.lazyPipeline.addResize(this.pendingResizeConfig);
      this.pendingResizeConfig = null;
    }

    // Apply pending ResizeOperation (for Shortcut API)
    if (this.pendingResizeOperation) {
      this.lazyPipeline._addResizeOperation(this.pendingResizeOperation);
      this.pendingResizeOperation = null;
    }

    // Apply pending blur options
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
  resize(config: ResizeConfig, _constraint?: EnsureCanResize<TState>): ImageProcessor<AfterResizeCall<TState>> {
    // 1. Prevent multiple resize calls (prevent quality degradation)
    if (this.hasResized) {
      throw new ImageProcessError(
        'resize() can only be called once. Use a single resize() call to prevent image quality degradation.',
        'MULTIPLE_RESIZE_NOT_ALLOWED',
        undefined,
        [
          'Include all resizing options in a single resize() call',
          'Create separate processImage() instances for multiple sizes',
          'Example: processImage(source).resize({ fit: "cover", width: 300, height: 200 }).toBlob()',
        ]
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
   * Applies Gaussian blur to the image.
   * Can be used before or after resize(), and can be called multiple times.
   *
   * @param radius Blur radius (pixels, default: 2)
   * @param options Blur options (additional settings)
   * @returns Processor in same state (chainable)
   *
   * @example
   * ```typescript
   * // Apply blur before resize
   * await processImage(source)
   *   .blur(2)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .toBlob();
   *
   * // Apply blur after resize
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(5)
   *   .toBlob();
   *
   * // Multiple blur applications possible (cumulative)
   * await processImage(source)
   *   .blur(2)
   *   .blur(3)
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
      return this.options.defaultQuality || 0.8;
    }
    return OPTIMAL_QUALITY_BY_FORMAT[format as OutputFormat] || this.options.defaultQuality || 0.8;
  }

  /**
   * Check browser format support
   * @private
   */
  private supportsFormat(format: ImageFormat): boolean {
    if (typeof window === 'undefined') return false;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;

    try {
      const mimeType = `image/${format}`;
      // Check format support using Canvas toDataURL
      const dataUrl = canvas.toDataURL(mimeType, 0.5);
      // Unsupported formats are replaced with PNG
      return dataUrl.startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
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
    if (options.format && !options.quality) {
      outputOptions.quality = this.getOptimalQuality(options.format);
    }

    const { canvas, result } = await this.executeProcessing();

    try {
      const blob = await this.canvasToBlob(canvas, outputOptions);

      // 🆕 Return extended result object (includes direct conversion methods)
      return new BlobResultImpl(
        blob,
        result.width,
        result.height,
        result.processingTime,
        result.originalSize,
        outputOptions.format
      );
    } catch (error) {
      throw new ImageProcessError('Error occurred during Blob conversion', 'OUTPUT_FAILED', error as Error);
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
      throw new ImageProcessError('Error occurred during Data URL conversion', 'OUTPUT_FAILED', error as Error);
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
      throw new ImageProcessError('Error occurred while creating File object', 'OUTPUT_FAILED', error as Error);
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
      throw new ImageProcessError('Error occurred during Canvas conversion', 'OUTPUT_FAILED', error as Error);
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
      throw new ImageProcessError('Error occurred during detailed Canvas conversion', 'OUTPUT_FAILED', error as Error);
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
          if (!blob) {
            reject(new ImageProcessError('Blob creation failed', 'CANVAS_TO_BLOB_FAILED'));
            return;
          }

          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();

          img.onload = () => {
            URL.revokeObjectURL(objectUrl); // Immediate cleanup
            resolve(img);
          };

          img.onerror = () => {
            URL.revokeObjectURL(objectUrl); // Cleanup on error too
            reject(new ImageProcessError('Image loading failed', 'IMAGE_LOAD_FAILED'));
          };

          img.src = objectUrl;
        });
      });
    } catch (error) {
      throw new ImageProcessError('Error occurred during Element conversion', 'OUTPUT_FAILED', error as Error);
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
          if (!blob) {
            reject(new ImageProcessError('Blob creation failed', 'CANVAS_TO_BLOB_FAILED'));
            return;
          }

          try {
            const arrayBuffer = await blob.arrayBuffer();
            resolve(arrayBuffer);
          } catch (error) {
            reject(new ImageProcessError('ArrayBuffer conversion failed', 'BLOB_TO_ARRAYBUFFER_FAILED', error as Error));
          }
        });
      });
    } catch (error) {
      throw new ImageProcessError('Error occurred during ArrayBuffer conversion', 'OUTPUT_FAILED', error as Error);
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
      throw new ImageProcessError('Error occurred during Uint8Array conversion', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Clone Canvas (when safe reference is needed)
   * @private
   */
  private cloneCanvas(originalCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const clonedCanvas = document.createElement('canvas');
    const ctx = clonedCanvas.getContext('2d')!;

    clonedCanvas.width = originalCanvas.width;
    clonedCanvas.height = originalCanvas.height;

    ctx.drawImage(originalCanvas, 0, 0);
    return clonedCanvas;
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

      throw new ImageProcessError('Error occurred during image processing', 'CANVAS_CREATION_FAILED', error as Error);
    }
  }

  /**
   * Convert Canvas to Blob
   */
  private async canvasToBlob(canvas: HTMLCanvasElement, options: Required<OutputOptions>): Promise<Blob> {
    const mimeType = this.formatToMimeType(options.format);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Retry with fallback format
            const fallbackMimeType = this.formatToMimeType(options.fallbackFormat);
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  resolve(fallbackBlob);
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

  /**
   * Convert format to MIME type
   */
  private formatToMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
    };

    return mimeTypes[format.toLowerCase()] || 'image/png';
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
 * ```
 */
export function processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, options);
}
