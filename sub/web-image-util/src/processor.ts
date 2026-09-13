/**
 * 체이닝 기반 이미지 처리를 담당하는 핵심 클래스다.
 *
 * @description Canvas 2D API를 바탕으로 브라우저 전용 이미지 처리 흐름을 구성한다.
 * 출력 경로 전체(소스 정규화·파이프라인 구성·인코딩·pool 반환)는
 * OutputPipeline이 담당하고, 이 클래스는 연산 축적과 위임만 맡는다.
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
import type { BoxOptions } from './types/box-config';
import type { IImageProcessor } from './types/processor-interface';
import type { ResizeConfig } from './types/resize-config';
import type { TransformOptions } from './types/transform-config';

/**
 * 타입 안전한 이미지 처리 체이닝 API를 제공한다.
 *
 * @description resize 1회 제한, 지연 렌더링, 브라우저 포맷 선택을 한 곳에서 관리한다.
 *
 * @example
 * ```typescript
 * // ✅ Correct usage: call resize() only once
 * const result = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // ❌ Throws at runtime: duplicate resize() calls
 * const processor = processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError: MULTIPLE_RESIZE_NOT_ALLOWED
 *
 * // ✅ For multiple sizes: use separate instances
 * const small = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
 * const large = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
 * ```
 */
export class ImageProcessor implements IImageProcessor {
  // 출력 경로 deep module. 연산 축적·1회 제약 런타임 가드·렌더·인코딩 전부 여기에 있다.
  private readonly output: OutputPipeline;

  constructor(source: ImageSource, options: InternalProcessorOptions = {}) {
    this.output = new OutputPipeline(source, options);
  }

  /**
   * crop / flip / rotate 변환
   *
   * @description
   * **한 번만, resize() 앞에서만 호출할 수 있다.**
   * - 연산 순서는 호출 순서와 무관하게 crop → flip → rotate → resize로 고정된다.
   * - crop 좌표는 원본 픽셀 기준이다. SVG는 `getImageDimensions()`가 보고하는 유효 크기 기준이다.
   * - crop이 원본을 벗어나면 요청 크기를 유지하고 밖은 투명이다. 색이 필요하면 `box({ background })`를 쓴다(캔버스 전체 아래).
   *   원본과 교집합이 없으면 출력 시점에 INVALID_DIMENSIONS를 던진다.
   * - `rotate`는 도 단위이며 양수가 시계 방향이다. `rotate: 90`은 `{ degrees: 90 }`과 같다.
   *   `expand: true`(기본)는 회전 결과를 모두 담고, `false`는 입력 프레임을 유지한다.
   * - 최종 출력은 여전히 drawImage 한 번이다. 중간 Canvas를 만들지 않는다.
   * - JPEG 출력은 투명 영역이 검정이 되므로 `box({ background })`를 지정한다. 크기를 바꾸지 않으려면 `{ fit: 'scale', scale: 1 }`을 쓴다.
   *
   * @param options 변환 옵션 (TransformOptions). 빈 객체는 no-op
   * @returns 같은 상태의 Processor (resize() 호출 가능)
   *
   * @throws {ImageProcessError} OPTION_INVALID — 두 번째 호출, resize() 뒤 호출, 옵션 값 오류
   * @throws {ImageProcessError} INVALID_DIMENSIONS — crop 값 오류(즉시), 원본과 교집합 없음(출력 시점).
   *   단, `toCanvas()`/`toCanvasDetailed()`는 이 오류를 `OUTPUT_FAILED`로 감싸 던진다(원인은 `cause`에 보존).
   *
   * @example
   * ```typescript
   * // crop만 (resize 없음)
   * await processImage(source).transform({ crop: { x: 10, y: 20, width: 640, height: 480 } }).toBlob();
   *
   * // 회전 + 반전 + 리사이즈
   * await processImage(source)
   *   .transform({ rotate: 90, flip: { horizontal: true } })
   *   .resize({ fit: 'cover', width: 320, height: 240 })
   *   .toBlob();
   *
   * // 임의각 회전. 빈 모서리는 투명이므로 JPEG면 box()로 색을 준다 (scale 1이면 크기 그대로)
   * await processImage(source)
   *   .transform({ rotate: { degrees: 15, expand: true } })
   *   .resize({ fit: 'scale', scale: 1 })
   *   .box({ background: '#fff' })
   *   .toBlob('jpeg');
   *
   * // ❌ 런타임 오류: resize() 뒤에는 transform()을 부를 수 없다
   * processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).transform({ rotate: 90 });
   * ```
   */
  transform(options: TransformOptions): ImageProcessor {
    // 1회 제약·resize 앞 제약·검증은 LazyRenderPipeline이 단일 소유한다.
    this.output.addTransform(options);

    return this;
  }

  /**
   * Image resizing
   *
   * @description
   * **Important: Can only be called once**
   * - Prevents quality degradation: Multiple resizing causes vector (SVG) → raster conversion quality loss
   * - Performance optimization: Prevents unnecessary intermediate Canvas creation
   * - ImageProcessor rejects a second call at runtime
   *
   * @param config Resize configuration (ResizeConfig)
   * @returns Processor instance (blur, toBlob etc. available)
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
   * // ❌ Runtime error: duplicate resize() calls
   * processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 Throws ImageProcessError at runtime
   *
   * // ✅ For multiple sizes: create separate instances
   * const small = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
   * const large = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
   * ```
   */
  resize(config: ResizeConfig): ImageProcessor {
    // 런타임 검증과 1회 제약은 LazyRenderPipeline이 단일 소유한다.
    this.output.addResize(config);

    return this;
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
   * **transform() + 비균일 resize와 함께 쓸 때**: blur 반경은 캔버스 좌표계(user space)
   * 기준이다. `transform()` 뒤에 비균일 배율의 `resize()`(예: `fit: 'fill'`로 가로세로
   * 배율이 다른 경우)를 적용하면 실제 렌더링되는 blur 강도가 축별로 달라질 수 있다.
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
  blur(radius: number = 2, options: Partial<BlurOptions> = {}): ImageProcessor {
    this.output.addBlur(radius, options);

    return this;
  }

  /**
   * padding / background / radius / border — CSS box model
   *
   * @description
   * **한 번만 호출할 수 있다. 체인 위치는 무관하다(resize 앞뒤 모두 가능).**
   * - 항상 가장 바깥에 적용된다: transform → resize → box. 호출 순서와 무관하다.
   * - `padding`은 content(transform·resize 결과) 바깥 간격이다.
   * - `background`는 border 안쪽 전체(content + padding) 아래에 칠한다. 소스 투명 픽셀도
   *   이 색과 합성된다. 기본 투명 — JPEG로 출력하면 투명 영역이 검정이 된다.
   * - `radius`는 CSS `border-radius`와 같은 의미다. px 또는 `%`(가로는 상자 너비, 세로는
   *   상자 높이 기준 — 비정사각형에 `50%`를 쓰면 원이 아니라 타원 모서리가 된다). 배열은
   *   `[TL, TR, BR, BL]` 순서. 인접 반지름 합이 변 길이를 넘으면 CSS 규칙대로 전체를 같은
   *   비율로 축소한다. **radius로 둥근 모서리를 만들 때는 PNG나 WebP로 출력한다** — JPEG는
   *   모서리 바깥이 검정으로 채워진다.
   * - `border`는 `{ width, color, inset? }`다. `color`는 반투명 허용. `inset: true`면 바깥
   *   상자 크기를 늘리지 않고 안쪽에 그린다(기본 false — 크기가 `width * 2`만큼 늘어난다).
   * - 최종 출력은 여전히 drawImage 한 번이다. 중간 Canvas를 만들지 않는다.
   * - 원본과 목표 비율이 다른 `resize({ fit: 'cover' })`와 함께 쓰면 이미지가 padding 영역까지
   *   번질 수 있다 — `radius`를 지정해도 막히지 않는다(현재 완화 방법 없음).
   *
   * @param options box 옵션(BoxOptions). 빈 객체는 no-op
   * @returns 같은 상태의 Processor(체이닝 가능) — 상태를 바꾸지 않는다
   *
   * @throws {ImageProcessError} OPTION_INVALID — 두 번째 호출, 옵션 값 형식 오류(padding 음수,
   *   radius 형식 오류, border 값 오류, 유효하지 않은 CSS 색)
   *
   * @example
   * ```typescript
   * // 둥근 avatar (PNG로 출력)
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 128, height: 128 })
   *   .box({ radius: '50%' })
   *   .toBlob('png');
   *
   * // padding + 배경 + 테두리
   * await processImage(source)
   *   .box({ padding: 16, background: '#ffffff', border: { width: 2, color: '#e5e5e5' } })
   *   .toBlob();
   *
   * // 안쪽 테두리(크기 변화 없음)
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 200, height: 200 })
   *   .box({ border: { width: 3, color: 'rgba(0,0,0,0.4)', inset: true } })
   *   .toBlob();
   * ```
   */
  box(options: BoxOptions): ImageProcessor {
    // 1회 제약·검증은 LazyRenderPipeline이 단일 소유한다.
    this.output.addBox(options);

    return this;
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
  get shortcut(): ShortcutBuilder {
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
 * resize() can be called at most once on the returned chain; a second call throws at runtime.
 *
 * @param source Image source (HTMLImageElement, Blob, URL, Data URL, SVG, ArrayBuffer, etc.)
 * @param options Processor options (crossOrigin, defaultQuality, etc.)
 * @returns ImageProcessor instance (resize() callable)
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
export function processImage(source: ImageSource, options?: ProcessorOptions): IImageProcessor {
  return new ImageProcessor(source, options);
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
): IImageProcessor {
  return new ImageProcessor(source, {
    ...options,
    __svgPassthroughMode: 'unsafe-pass-through',
  });
}
