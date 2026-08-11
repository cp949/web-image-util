/**
 * 체이닝 기반 이미지 처리를 담당하는 핵심 클래스다.
 *
 * @description Canvas 2D API를 바탕으로 브라우저 전용 이미지 처리 흐름을 구성한다.
 * 출력 경로 전체(소스 정규화·파이프라인 구성·인코딩·pool 반환)는
 * OutputPipeline이 담당하고, 이 클래스는 연산 축적과 타입 상태 전이만 맡는다.
 */

import type { InternalProcessorOptions } from './core/output-pipeline.internal';
import { OutputPipeline } from './core/output-pipeline.internal';
import { ShortcutBuilder } from './shortcut/shortcut-builder';
import type {
  BlurOptions,
  ImageSource,
  OutputFormat,
  OutputOptions,
  ProcessorOptions,
  ResultBlob,
  ResultCanvas,
  ResultDataURL,
  ResultFile,
} from './types';
import type { IImageProcessor, IShortcutBuilder } from './types/processor-interface';
import type { AfterResizeCall, ProcessorState } from './types/processor-state.internal';
import type { ResizeConfig } from './types/resize-config';
import type { ResizeOperation } from './types/shortcut-types';
import type { BeforeResize, InitialProcessor, TypedImageProcessor } from './types/typed-processor.internal';

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
export class ImageProcessor<TState extends ProcessorState = BeforeResize>
  implements TypedImageProcessor<TState>, IImageProcessor<TState>
{
  // 출력 경로 deep module. 연산 축적·1회 제약 런타임 가드·렌더·인코딩 전부 여기에 있다.
  private readonly output: OutputPipeline;

  constructor(source: ImageSource, options: InternalProcessorOptions = {}) {
    this.output = new OutputPipeline(source, options);
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
    // 런타임 검증과 1회 제약은 OutputPipeline이 담당하고, 여기서는 타입 상태 전이만 남는다.
    this.output.addResize(config);

    return this as unknown as ImageProcessor<AfterResizeCall<TState>>;
  }

  /**
   * 이미지 블러 효과
   *
   * @description
   * Canvas 2D filter API로 이미지에 가우시안 블러를 적용한다.
   * resize() 전후에 모두 사용할 수 있으며, 여러 번 호출하면 순차 패스로 누적 적용된다.
   *
   * **성능 고려사항:**
   * - 권장 범위: 0.5-10px (높은 값은 성능 문제를 일으킬 수 있음)
   * - 큰 이미지에서는 성능을 위해 resize 전에 blur 적용 권장
   * - blur를 여러 번 호출하면 각 호출이 CSS blur 패스 하나로 순차 합성됨
   *
   * @param radius 픽셀 단위 블러 반경 (기본값: 2, 0 = 블러 없음, 권장 범위: 0.5-10)
   * @param options 블러 옵션 (`options.radius`를 명시하면 radius 인자를 덮어씀)
   * @returns 같은 상태의 Processor (체이닝 가능)
   *
   * @example
   * ```typescript
   * // resize 전에 약한 blur 적용 (성능상 권장)
   * await processImage(source)
   *   .blur(2)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .toBlob();
   *
   * // resize 후 강한 blur 적용
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(5)
   *   .toBlob();
   *
   * // blur 여러 번 적용 (순차 패스)
   * await processImage(source)
   *   .blur(2)     // 첫 번째 blur 패스: 2px
   *   .blur(3)     // 두 번째 blur 패스: 위 결과에 3px 추가 적용
   *   .toBlob();
   *
   * // 썸네일용 성능 최적화 blur
   * await processImage(source)
   *   .blur(1)     // resize 전 약한 blur
   *   .resize({ fit: 'cover', width: 150, height: 150 })
   *   .toBlob();
   * ```
   */
  blur(radius: number = 2, options: Partial<BlurOptions> = {}): ImageProcessor<TState> {
    this.output.addBlur(radius, options);

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
    // 준비 전/후(pending/즉시 반영) 분기는 OutputPipeline 내부에서 처리된다.
    this.output.addResizeOperation(operation);
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
    return this.output.toBlob(optionsOrFormat);
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
    return this.output.toDataURL(optionsOrFormat);
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
    return this.output.toFile(filename, optionsOrFormat);
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
    return this.output.toCanvas();
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
    return this.output.toCanvasDetailed();
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
    return this.output.toElement();
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
    return this.output.toArrayBuffer();
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
    return this.output.toUint8Array();
  }
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
