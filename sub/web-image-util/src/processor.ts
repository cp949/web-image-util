/**
 * 이미지 프로세서 - 체이닝 API의 핵심 클래스
 * Canvas 2D API 기반으로 구현된 브라우저 전용 이미지 처리기
 */

import { createPipeline } from './core/pipeline';
import { convertToImageElement, detectSourceType } from './core/source-converter';
import { LazyRenderPipeline } from './core/lazy-render-pipeline';
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
import type { ResizeConfig } from './types/resize-config';
import { validateResizeConfig } from './types/resize-config';
import { BlobResultImpl, CanvasResultImpl, DataURLResultImpl, FileResultImpl } from './types/result-implementations';
import type {
  TypedImageProcessor,
  InitialProcessor,
  ResizedProcessor,
  BeforeResize,
  AfterResize,
} from './types/typed-processor';
import type { ProcessorState, EnsureCanResize, AfterResizeCall } from './types/processor-state';

/**
 * 이미지 프로세서 클래스 (타입-안전한 구현)
 *
 * @description 메서드 체이닝을 통한 이미지 처리를 제공합니다.
 * TypeScript 타입 시스템을 통해 resize() 중복 호출을 컴파일 타임에 방지합니다.
 *
 * @template TState 현재 프로세서 상태 (BeforeResize | AfterResize)
 *
 * @example
 * ```typescript
 * // ✅ 올바른 사용법
 * const result = await processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob({ format: 'webp', quality: 0.8 });
 *
 * // ❌ 컴파일 에러: resize() 중복 호출
 * const processor = processImage(source)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 타입 에러!
 * ```
 */
export class ImageProcessor<TState extends ProcessorState = BeforeResize> implements TypedImageProcessor<TState> {
  private pipeline = createPipeline();
  private lazyPipeline: LazyRenderPipeline | null = null;
  private sourceImage: HTMLImageElement | null = null;
  private options: ProcessorOptions;
  private hasResized = false;
  private useLazyRender = true; // 새로운 LazyRenderPipeline 사용
  private pendingResizeConfig: ResizeConfig | null = null;
  private pendingBlurOptions: BlurOptions[] = [];

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
    if (this.lazyPipeline || !this.useLazyRender) {
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

    // pending blur 옵션들 적용
    for (const blurOption of this.pendingBlurOptions) {
      this.lazyPipeline.addBlur(blurOption);
    }
    this.pendingBlurOptions = [];
  }

  /**
   * 이미지 리사이징 (타입-안전한 구현)
   *
   * @description resize() 메서드는 한 번만 호출할 수 있습니다.
   * TypeScript 타입 시스템을 통해 중복 호출을 컴파일 타임에 방지합니다.
   *
   * @param config 리사이징 설정
   * @param _constraint 타입 레벨 제약 (내부 사용)
   * @returns resize() 호출 후 상태의 프로세서 인스턴스
   *
   * @example
   * ```typescript
   * // ✅ 올바른 사용법: resize() 한 번만 호출
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
   * // ✅ 여러 크기가 필요한 경우: 별도 인스턴스 사용
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

    // 4. LazyRenderPipeline 또는 기존 파이프라인에 추가
    if (this.useLazyRender) {
      // LazyRenderPipeline은 나중에 ensureLazyPipeline()에서 초기화
      // 여기서는 config만 저장
      this.pendingResizeConfig = config;
    } else {
      // 기존 파이프라인 사용 (fallback)
      this.pipeline.addOperation({
        type: 'resize',
        config: config,
      });
    }

    return this as unknown as ImageProcessor<AfterResizeCall<TState>>;
  }

  /**
   * 이미지 블러 효과 (타입-안전한 구현)
   *
   * @description blur() 메서드는 resize() 여부와 관계없이 사용 가능합니다.
   * 상태를 유지하면서 체이닝을 지원합니다.
   *
   * @param radius 블러 반지름 (기본: 2)
   * @param options 블러 옵션
   * @returns 동일한 상태의 프로세서 인스턴스
   *
   * @example
   * ```typescript
   * // resize() 전에 blur 적용
   * const result1 = await processImage(source)
   *   .blur(2)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .toBlob();
   *
   * // resize() 후에 blur 적용
   * const result2 = await processImage(source)
   *   .resize({ fit: 'cover', width: 300, height: 200 })
   *   .blur(5)
   *   .toBlob();
   * ```
   */
  blur(radius: number = 2, options: Partial<BlurOptions> = {}): ImageProcessor<TState> {
    const blurOptions: BlurOptions = {
      radius,
      ...options,
    };

    // LazyRenderPipeline 또는 기존 파이프라인에 추가
    if (this.useLazyRender) {
      // blur는 여러 번 호출 가능하므로 pending 배열로 관리 필요
      this.pendingBlurOptions = this.pendingBlurOptions || [];
      this.pendingBlurOptions.push(blurOptions);
    } else {
      this.pipeline.addOperation({
        type: 'blur',
        options: blurOptions,
      });
    }

    return this as ImageProcessor<TState>;
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

    // 파이프라인에 출력 포맷 설정
    this.pipeline.setOutputFormat(outputOptions.format);

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
        result.format
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
        result.format
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
      // 🚀 LazyRenderPipeline 사용 (SVG 화질 개선)
      if (this.useLazyRender) {
        await this.ensureLazyPipeline();

        if (this.lazyPipeline) {
          // LazyRenderPipeline으로 처리
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
        }
      }

      // 폴백: 기존 파이프라인 사용
      const sourceType = detectSourceType(this.source);
      const imageElement = await convertToImageElement(this.source, this.options);

      // SVG이고 단순 리사이징만 하는 경우 파이프라인 우회 검토
      if (sourceType === 'svg' && this.shouldBypassPipelineForSvg(imageElement)) {
        return this.createDirectCanvasResult(imageElement);
      }

      // 기존 파이프라인 실행
      const result = await this.pipeline.execute(imageElement);

      return result;
    } catch (error) {
      if (error instanceof ImageProcessError) {
        throw error;
      }

      throw new ImageProcessError('이미지 처리 중 오류가 발생했습니다', 'CANVAS_CREATION_FAILED', error as Error);
    }
  }

  /**
   * SVG에 대해 파이프라인을 우회할지 결정
   * 이미 최적 크기로 렌더링된 SVG는 불필요한 리사이징을 방지
   */
  private shouldBypassPipelineForSvg(imageElement: HTMLImageElement): boolean {
    const operations = this.pipeline.getOperations();

    // 연산이 없거나 리사이징만 있는 경우
    if (operations.length === 0) {
      return true;
    }

    if (operations.length === 1 && operations[0].type === 'resize') {
      const resizeOp = operations[0];
      const width = resizeOp.config.width;
      const height = resizeOp.config.height;

      // 목표 크기와 실제 크기가 일치하거나 매우 유사한 경우 (5% 이내 오차 허용)
      if (width && height) {
        const widthMatch = Math.abs(imageElement.naturalWidth - width) / width < 0.05;
        const heightMatch = Math.abs(imageElement.naturalHeight - height) / height < 0.05;

        if (widthMatch && heightMatch) {
          console.log('🚀 SVG 파이프라인 우회: 크기가 이미 최적 상태', {
            target: `${width}x${height}`,
            actual: `${imageElement.naturalWidth}x${imageElement.naturalHeight}`,
            bypass: true,
          });
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 파이프라인을 우회하여 직접 Canvas 결과 생성
   */
  private async createDirectCanvasResult(imageElement: HTMLImageElement): Promise<{
    canvas: HTMLCanvasElement;
    result: any;
  }> {
    const startTime = performance.now();

    // 고품질 Canvas 생성
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageProcessError('Canvas 2D 컨텍스트를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
    }

    // 🚀 최고 품질 설정으로 SVG 그리기
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageElement, 0, 0);

    const processingTime = performance.now() - startTime;

    const result = {
      width: canvas.width,
      height: canvas.height,
      processingTime,
      originalSize: {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
      },
      format: this.pipeline['outputFormat'], // private 멤버 접근
    };

    console.log('✅ SVG 직접 렌더링 완료:', {
      size: `${canvas.width}x${canvas.height}`,
      processingTime: `${processingTime.toFixed(2)}ms`,
      quality: 'high (pipeline bypassed)',
    });

    return { canvas, result };
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
 * 타입-안전한 이미지 프로세서 팩토리 함수
 *
 * @param source 이미지 소스
 * @param options 프로세서 옵션
 * @returns resize() 호출 전 상태의 ImageProcessor 인스턴스
 *
 * @example
 * ```typescript
 * // ✅ 올바른 사용법: resize() 한 번만 호출
 * const result = await processImage(imageElement)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .blur(2)
 *   .toBlob();
 *
 * // ❌ 컴파일 에러: resize() 중복 호출
 * const processor = processImage(blob)
 *   .resize({ fit: 'cover', width: 300, height: 200 })
 *   .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 타입 에러!
 *
 * // ✅ 여러 크기 필요시: 별도 인스턴스 사용
 * const thumbnail = await processImage(source).resize({ fit: 'cover', width: 150, height: 150 }).toBlob();
 * const fullsize = await processImage(source).resize({ fit: 'cover', width: 800, height: 600 }).toBlob();
 *
 * // ✅ 옵션과 함께 사용
 * const processor = processImage(source, {
 *   crossOrigin: 'use-credentials',
 *   defaultQuality: 0.9
 * });
 * ```
 */
export function processImage(source: ImageSource, options?: ProcessorOptions): InitialProcessor {
  return new ImageProcessor<BeforeResize>(source, options);
}
