/**
 * 이미지 프로세서 - 체이닝 API의 핵심 클래스
 *
 * @description
 * Canvas 2D API 기반 브라우저 전용 이미지 처리기
 * - 메서드 체이닝을 통한 직관적인 API
 * - TypeScript 타입 시스템을 활용한 컴파일 타임 안전성
 * - 지연 렌더링 파이프라인으로 최적화된 성능
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
 * 이미지 프로세서 클래스
 *
 * @description
 * 타입 안전한 메서드 체이닝 API를 제공하는 이미지 처리 클래스
 *
 * **핵심 설계 원칙:**
 * - resize()는 한 번만 호출 가능 (화질 저하 방지)
 * - TypeScript 타입 시스템으로 컴파일 타임 안전성 보장
 * - 지연 렌더링으로 성능 최적화 (최종 출력 시 한 번만 렌더링)
 *
 * @template TState 프로세서 상태 (BeforeResize | AfterResize)
 *
 * @example
 * ```typescript
 * // ✅ 올바른 사용: resize() 한 번만 호출
 * const result = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // ❌ 컴파일 에러: resize() 중복 호출
 * const processor = processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 타입 에러!
 *
 * // ✅ 여러 크기 필요시: 별도 인스턴스 사용
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
   * 소스 이미지를 HTMLImageElement로 변환하고 LazyRenderPipeline 초기화
   */
  private async ensureLazyPipeline(): Promise<void> {
    if (this.lazyPipeline) {
      return;
    }

    // 소스를 HTMLImageElement로 변환
    this.sourceImage = await convertToImageElement(this.source, this.options);

    // LazyRenderPipeline 초기화
    this.lazyPipeline = new LazyRenderPipeline(this.sourceImage);

    // pending 연산들 적용
    if (this.pendingResizeConfig) {
      this.lazyPipeline.addResize(this.pendingResizeConfig);
      this.pendingResizeConfig = null;
    }

    // pending ResizeOperation 적용 (Shortcut API용)
    if (this.pendingResizeOperation) {
      this.lazyPipeline._addResizeOperation(this.pendingResizeOperation);
      this.pendingResizeOperation = null;
    }

    // pending blur 옵션들 적용
    for (const blurOption of this.pendingBlurOptions) {
      this.lazyPipeline.addBlur(blurOption);
    }
    this.pendingBlurOptions = [];
  }

  /**
   * 이미지 리사이징
   *
   * @description
   * **중요: 한 번만 호출 가능**
   * - 화질 저하 방지: 여러 번 리사이징하면 벡터(SVG) → 래스터 변환으로 품질 손실
   * - 성능 최적화: 불필요한 중간 Canvas 생성 방지
   * - TypeScript가 컴파일 타임에 중복 호출 방지
   *
   * @param config 리사이징 설정 (ResizeConfig)
   * @param _constraint 타입 레벨 제약 (내부 사용, 무시하세요)
   * @returns AfterResize 상태의 프로세서 (blur, toBlob 등 사용 가능)
   *
   * @throws {ImageProcessError} resize()를 두 번 이상 호출하면 런타임 에러
   *
   * @example
   * ```typescript
   * // ✅ 올바른 사용: resize() 한 번만 호출
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(2)
   *   .toBlob();
   *
   * // ❌ 컴파일 에러: resize() 중복 호출
   * processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 타입 에러!
   *
   * // ✅ 여러 크기 필요시: 각각 별도 인스턴스 생성
   * const small = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
   * const large = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
   * ```
   */
  resize(config: ResizeConfig, _constraint?: EnsureCanResize<TState>): ImageProcessor<AfterResizeCall<TState>> {
    // 1. 다중 resize 호출 방지 (화질 저하 방지)
    if (this.hasResized) {
      throw new ImageProcessError(
        'resize()는 한 번만 호출할 수 있습니다. 이미지 화질 저하를 방지하기 위해 단일 resize() 호출만 사용하세요.',
        'MULTIPLE_RESIZE_NOT_ALLOWED',
        undefined,
        [
          '모든 리사이징 옵션을 하나의 resize() 호출에 포함하세요',
          '여러 크기가 필요한 경우 각각 별도의 processImage() 인스턴스를 생성하세요',
          '예시: processImage(source).resize({ fit: "cover", width: 300, height: 200 }).toBlob()',
        ]
      );
    }

    // 2. 런타임 검증
    validateResizeConfig(config);

    // 3. resize 호출 기록
    this.hasResized = true;

    // 4. LazyRenderPipeline에 추가
    // LazyRenderPipeline은 나중에 ensureLazyPipeline()에서 초기화
    // 여기서는 config만 저장
    this.pendingResizeConfig = config;

    return this as unknown as ImageProcessor<AfterResizeCall<TState>>;
  }

  /**
   * 이미지 블러 효과
   *
   * @description
   * 가우시안 블러를 이미지에 적용합니다.
   * resize() 전후 어디서나 사용 가능하며, 여러 번 호출 가능합니다.
   *
   * @param radius 블러 반지름 (픽셀, 기본: 2)
   * @param options 블러 옵션 (추가 설정)
   * @returns 동일한 상태의 프로세서 (체이닝 가능)
   *
   * @example
   * ```typescript
   * // resize 전 blur 적용
   * await processImage(source)
   *   .blur(2)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .toBlob();
   *
   * // resize 후 blur 적용
   * await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(5)
   *   .toBlob();
   *
   * // 여러 번 blur 적용 가능 (누적)
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

    // LazyRenderPipeline에 추가
    // blur는 여러 번 호출 가능하므로 pending 배열로 관리
    this.pendingBlurOptions = this.pendingBlurOptions || [];
    this.pendingBlurOptions.push(blurOptions);

    return this as ImageProcessor<TState>;
  }

  /**
   * Lazy 리사이즈 연산 추가 (Shortcut API용 내부 메서드)
   *
   * @description ShortcutBuilder가 사용하는 내부 API입니다.
   * 소스 크기가 필요한 연산(scale, toWidth, toHeight)을 pending 상태로 저장합니다.
   * 실제 변환은 최종 출력 시점(toBlob, toCanvas 등)에 수행됩니다.
   *
   * @param operation ResizeOperation (scale, toWidth, toHeight)
   * @internal
   */
  _addResizeOperation(operation: ResizeOperation): void {
    // LazyRenderPipeline 초기화 전: pending 상태로 저장
    // LazyRenderPipeline 초기화 후: 바로 전달
    if (this.lazyPipeline) {
      // 이미 초기화된 경우 바로 전달
      this.lazyPipeline._addResizeOperation(operation);
    } else {
      // 아직 초기화 안된 경우 pending 상태로 저장
      // ensureLazyPipeline()에서 초기화 시 자동 적용됨
      this.pendingResizeOperation = operation;
    }
  }

  /**
   * Shortcut API 접근자
   *
   * @description
   * 간편한 리사이징 메서드를 제공하는 ShortcutBuilder를 반환합니다.
   * 복잡한 ResizeConfig 대신 직관적인 메서드 이름으로 리사이징할 수 있습니다.
   *
   * @returns ShortcutBuilder 인스턴스
   *
   * @example
   * ```typescript
   * // 기본 방식
   * await processImage(src).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();
   *
   * // Shortcut API (더 간결함)
   * await processImage(src).shortcut.coverBox(300, 200).toBlob();
   *
   * // 다양한 shortcut 메서드 사용 예시
   * await processImage(src).shortcut.maxWidth(500).toBlob();                        // 최대 너비 제한
   * await processImage(src).shortcut.containBox(300, 200, { withoutEnlargement: true }).toBlob();  // 확대 방지
   * await processImage(src).shortcut.exactSize(400, 300).toBlob();                  // 정확한 크기
   * await processImage(src).shortcut.scale(1.5).toBlob();                           // 배율 조정
   * ```
   */
  get shortcut(): IShortcutBuilder<TState> {
    return new ShortcutBuilder(this);
  }

  // ==============================================
  // 스마트 포맷 선택 및 최적화 메서드
  // ==============================================

  /**
   * 브라우저 지원에 따른 최적 포맷 선택
   * @private
   */
  private getBestFormat(): OutputFormat {
    // WebP 지원 검사
    if (this.supportsFormat('webp')) {
      return 'webp';
    }

    // 기본값: PNG (무손실, 투명도 지원)
    return 'png';
  }

  /**
   * 포맷별 최적 품질 반환
   * @private
   */
  private getOptimalQuality(format: ImageFormat): number {
    // OPTIMAL_QUALITY_BY_FORMAT 상수에서 최적 품질 값 가져오기
    // gif, svg 등 출력 미지원 포맷은 기본값 사용
    if (format === 'gif' || format === 'svg') {
      return this.options.defaultQuality || 0.8;
    }
    return OPTIMAL_QUALITY_BY_FORMAT[format as OutputFormat] || this.options.defaultQuality || 0.8;
  }

  /**
   * 브라우저의 포맷 지원 여부 확인
   * @private
   */
  private supportsFormat(format: ImageFormat): boolean {
    if (typeof window === 'undefined') return false;

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;

    try {
      const mimeType = `image/${format}`;
      // Canvas에서 toDataURL로 포맷 지원 여부 확인
      const dataUrl = canvas.toDataURL(mimeType, 0.5);
      // 지원하지 않는 포맷은 PNG로 대체됨
      return dataUrl.startsWith(`data:${mimeType}`);
    } catch {
      return false;
    }
  }

  /**
   * 파일명에서 포맷 추출
   * @private
   */
  private getFormatFromFilename(filename: string): OutputFormat | null {
    const ext = filename.toLowerCase().split('.').pop();

    // 지원되는 포맷만 매핑
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
   * Blob으로 변환 (메타데이터 포함)
   *
   * @param options 출력 옵션
   * @returns 처리된 이미지 Blob과 메타데이터
   *
   * @example
   * ```typescript
   * // 기본값 사용 (WebP 지원 시 WebP/품질 0.8, 미지원 시 PNG/품질 0.8)
   * const result = await processor.toBlob()
   *
   * // 명시적 옵션
   * const result = await processor.toBlob({
   *   format: 'webp',
   *   quality: 0.8
   * })
   *
   * // 포맷만 지정 (최적 품질 자동 선택)
   * const result = await processor.toBlob('jpeg') // 품질 0.85 자동 적용
   *
   * // 메타데이터 활용
   * const { blob, width, height, processingTime } = result;
   * console.log(`${width}x${height} 이미지, ${processingTime}ms 소요`);
   * ```
   */

  async toBlob(options?: OutputOptions): Promise<ResultBlob>;
  async toBlob(format: OutputFormat): Promise<ResultBlob>;
  async toBlob(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultBlob> {
    // ✅ 모든 소스가 동일한 파이프라인 사용 (SVG 분기 제거)

    // 문자열인 경우 포맷으로 처리하고 최적 품질 적용
    const options: OutputOptions =
      typeof optionsOrFormat === 'string'
        ? {
            format: optionsOrFormat,
            quality: this.getOptimalQuality(optionsOrFormat),
          }
        : optionsOrFormat;

    // 스마트 기본 포맷 선택: WebP 지원 시 WebP, 아니면 PNG
    const smartFormat = this.getBestFormat();

    const outputOptions: Required<OutputOptions> = {
      format: smartFormat,
      quality: this.getOptimalQuality(smartFormat),
      fallbackFormat: 'png',
      ...options,
    };

    // 사용자가 옵션을 제공했지만 quality가 없는 경우, 포맷에 최적화된 품질 사용
    if (options.format && !options.quality) {
      outputOptions.quality = this.getOptimalQuality(options.format);
    }

    const { canvas, result } = await this.executeProcessing();

    try {
      const blob = await this.canvasToBlob(canvas, outputOptions);

      // 🆕 확장된 결과 객체 반환 (직접 변환 메서드 포함)
      return new BlobResultImpl(
        blob,
        result.width,
        result.height,
        result.processingTime,
        result.originalSize,
        outputOptions.format
      );
    } catch (error) {
      throw new ImageProcessError('Blob 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Data URL로 변환 (메타데이터 포함)
   *
   * @param options 출력 옵션
   * @returns 처리된 이미지 Data URL과 메타데이터
   *
   * @example
   * ```typescript
   * // 기본값 사용 (WebP 지원 시 WebP/품질 0.8, 미지원 시 PNG/품질 1.0)
   * const result = await processor.toDataURL()
   *
   * // 명시적 옵션
   * const result = await processor.toDataURL({
   *   format: 'jpeg',
   *   quality: 0.9
   * });
   *
   * // 포맷만 지정 (최적 품질 자동 선택)
   * const result2 = await processor.toDataURL('webp'); // 품질 0.8 자동 적용
   *
   * // img 태그에 바로 사용 가능
   * imgElement.src = result.dataURL;
   * ```
   */
  async toDataURL(options?: OutputOptions): Promise<ResultDataURL>;
  async toDataURL(format: OutputFormat): Promise<ResultDataURL>;
  async toDataURL(optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultDataURL> {
    // 타입에 따라 적절한 toBlob 호출 방식 선택
    const { blob, ...metadata } =
      typeof optionsOrFormat === 'string'
        ? await this.toBlob(optionsOrFormat) // OutputFormat 타입
        : await this.toBlob(optionsOrFormat); // OutputOptions 타입

    try {
      const dataURL = await this.blobToDataURL(blob);

      // 🆕 확장된 결과 객체 반환 (직접 변환 메서드 포함)
      return new DataURLResultImpl(
        dataURL,
        metadata.width,
        metadata.height,
        metadata.processingTime,
        metadata.originalSize,
        metadata.format
      );
    } catch (error) {
      throw new ImageProcessError('Data URL 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * File 객체로 변환 (메타데이터 포함)
   *
   * @param filename 파일명
   * @param options 출력 옵션 (비어있으맄 파일 확장자로 포맷 자동 감지)
   * @returns 처리된 이미지 File과 메타데이터
   *
   * @example
   * ```typescript
   * // 명시적 옵션
   * const result = await processor.toFile('thumbnail.webp', {
   *   format: 'webp',
   *   quality: 0.8
   * });
   *
   * // 파일명으로 포맷 자동 감지 + 최적 품질
   * const result2 = await processor.toFile('image.jpg'); // JPEG/품질 0.85 자동 적용
   * const result3 = await processor.toFile('thumbnail.webp'); // WebP/품질 0.8 자동 적용
   *
   * // 포맷만 지정 (최적 품질 자동 선택)
   * const result4 = await processor.toFile('image.jpg', 'jpeg'); // 품질 0.85 자동 적용
   *
   * // FormData에 추가하여 업로드
   * const formData = new FormData();
   * formData.append('image', result.file);
   * ```
   */
  async toFile(filename: string, options?: OutputOptions): Promise<ResultFile>;
  async toFile(filename: string, format: OutputFormat): Promise<ResultFile>;
  async toFile(filename: string, optionsOrFormat: OutputOptions | OutputFormat = {}): Promise<ResultFile> {
    // 파일 확장자로 포맷 자동 감지
    const formatFromFilename = this.getFormatFromFilename(filename);

    // 옵션이 비어있으면 파일명에서 포맷 추출
    let finalOptions: OutputOptions;
    if (typeof optionsOrFormat === 'string') {
      // 문자열 포맷 지정
      finalOptions = { format: optionsOrFormat };
    } else if (Object.keys(optionsOrFormat).length === 0 && formatFromFilename) {
      // 빈 객체이고 파일명에서 포맷 감지 가능한 경우
      finalOptions = {
        format: formatFromFilename,
        quality: this.getOptimalQuality(formatFromFilename),
      };
    } else {
      // 제공된 옵션 사용
      finalOptions = optionsOrFormat;
    }

    const { blob, ...metadata } = await this.toBlob(finalOptions);

    try {
      const file = new File([blob], filename, {
        type: blob.type,
        lastModified: Date.now(),
      });

      // 🆕 확장된 결과 객체 반환 (직접 변환 메서드 포함)
      return new FileResultImpl(
        file,
        metadata.width,
        metadata.height,
        metadata.processingTime,
        metadata.originalSize,
        metadata.format
      );
    } catch (error) {
      throw new ImageProcessError('File 객체 생성 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Canvas로 변환 (메타데이터 포함)
   *
   * @returns 처리된 Canvas와 메타데이터를 포함한 결과 객체
   *
   * @example
   * ```typescript
   * const result = await processor.toCanvas();
   * // Canvas 엘리먼트와 메타데이터 모두 사용 가능
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
        undefined // Canvas는 포맷 정보가 없음
      );
    } catch (error) {
      throw new ImageProcessError('Canvas 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * 메타데이터 포함 Canvas 결과
   *
   * @returns Canvas와 메타데이터를 포함한 결과 객체
   *
   * @example
   * ```typescript
   * const result = await processor.toCanvasDetailed();
   * console.log(`${result.width}x${result.height} Canvas, ${result.processingTime}ms 소요`);
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
        undefined // Canvas는 포맷 정보가 없음
      );
    } catch (error) {
      throw new ImageProcessError('Canvas 상세 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * HTMLImageElement 직접 생성
   * Canvas → Blob → ObjectURL → Image 경로로 최적화
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
            reject(new ImageProcessError('Blob 생성 실패', 'CANVAS_TO_BLOB_FAILED'));
            return;
          }

          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();

          img.onload = () => {
            URL.revokeObjectURL(objectUrl); // 즉시 정리
            resolve(img);
          };

          img.onerror = () => {
            URL.revokeObjectURL(objectUrl); // 에러 시에도 정리
            reject(new ImageProcessError('Image 로딩 실패', 'IMAGE_LOAD_FAILED'));
          };

          img.src = objectUrl;
        });
      });
    } catch (error) {
      throw new ImageProcessError('Element 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * ArrayBuffer 직접 변환
   * Canvas → Blob → ArrayBuffer 최적화 경로
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
            reject(new ImageProcessError('Blob 생성 실패', 'CANVAS_TO_BLOB_FAILED'));
            return;
          }

          try {
            const arrayBuffer = await blob.arrayBuffer();
            resolve(arrayBuffer);
          } catch (error) {
            reject(new ImageProcessError('ArrayBuffer 변환 실패', 'BLOB_TO_ARRAYBUFFER_FAILED', error as Error));
          }
        });
      });
    } catch (error) {
      throw new ImageProcessError('ArrayBuffer 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Uint8Array 직접 변환
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
      throw new ImageProcessError('Uint8Array 변환 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Canvas 복사 (안전한 참조가 필요한 경우)
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
   * 파이프라인 처리 실행
   */
  private async executeProcessing() {
    try {
      // LazyRenderPipeline으로 처리
      await this.ensureLazyPipeline();

      if (!this.lazyPipeline) {
        throw new ImageProcessError('LazyRenderPipeline 초기화 실패', 'PROCESSING_FAILED');
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

      throw new ImageProcessError('이미지 처리 중 오류가 발생했습니다', 'CANVAS_CREATION_FAILED', error as Error);
    }
  }

  /**
   * Canvas를 Blob으로 변환
   */
  private async canvasToBlob(canvas: HTMLCanvasElement, options: Required<OutputOptions>): Promise<Blob> {
    const mimeType = this.formatToMimeType(options.format);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // 대체 포맷으로 재시도
            const fallbackMimeType = this.formatToMimeType(options.fallbackFormat);
            canvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  resolve(fallbackBlob);
                } else {
                  reject(new Error('Blob 생성에 실패했습니다'));
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
   * Blob을 Data URL로 변환
   */
  private async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Data URL 변환에 실패했습니다'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 포맷을 MIME 타입으로 변환
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
  // ✅ SVG 전용 처리 경로 제거됨 - 모든 소스가 통합 파이프라인 사용
  // ==============================================
}

/**
 * 이미지 프로세서 팩토리 함수
 *
 * @description
 * 다양한 타입의 이미지 소스로부터 ImageProcessor 인스턴스를 생성합니다.
 * TypeScript 타입 시스템을 활용하여 resize() 중복 호출을 컴파일 타임에 방지합니다.
 *
 * @param source 이미지 소스 (HTMLImageElement, Blob, URL, Data URL, SVG, ArrayBuffer 등)
 * @param options 프로세서 옵션 (crossOrigin, defaultQuality 등)
 * @returns BeforeResize 상태의 ImageProcessor (resize() 호출 가능)
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const result = await processImage(imageElement)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // 다양한 소스 타입 지원
 * processImage(blob)                    // Blob
 * processImage('https://example.com/image.jpg')  // HTTP URL
 * processImage('data:image/svg+xml,...')         // Data URL
 * processImage('<svg>...</svg>')                 // SVG XML
 * processImage(arrayBuffer)                       // ArrayBuffer
 *
 * // 옵션과 함께 사용
 * const processor = processImage(source, {
 *   crossOrigin: 'use-credentials',
 *   defaultQuality: 0.9,
 *   defaultBackground: { r: 255, g: 255, b: 255, alpha: 1 }
 * });
 *
 * // 여러 크기 필요시: 각각 별도 인스턴스 생성
 * const thumbnail = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
 * const fullsize = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
 * ```
 */
export function processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, options);
}
