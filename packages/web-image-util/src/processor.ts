/**
 * 이미지 프로세서 - 체이닝 API의 핵심 클래스
 * Canvas 2D API 기반으로 구현된 브라우저 전용 이미지 처리기
 */

import { createPipeline } from './core/pipeline';
import { convertToImageElement } from './core/source-converter';
import type {
  ResultBlob,
  BlurOptions,
  ResultDataURL,
  ResultFile,
  ResultCanvas,
  ImageFormat,
  ImageSource,
  OutputFormat,
  OutputOptions,
  ProcessorOptions,
  ResizeOptions,
  SmartResizeOptions,
} from './types';
import { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';
import { DataURLResultImpl, BlobResultImpl, FileResultImpl } from './types/result-implementations';

/**
 * 이미지 프로세서 클래스
 *
 * @description 메서드 체이닝을 통한 이미지 처리를 제공합니다.
 * 모든 변환 메서드는 this를 반환하여 체이닝이 가능합니다.
 *
 * @example
 * ```typescript
 * const result = await processImage(source)
 *   .resize(300, 200)
 *   .blur(2)
 *   .toBlob({ format: 'webp', quality: 0.8 });
 * ```
 */
export class ImageProcessor {
  private pipeline = createPipeline();
  private options: ProcessorOptions;

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
   * 이미지 리사이징
   *
   * @param width 대상 너비 (픽셀) - undefined/null 시 비율에 따라 자동 계산
   * @param height 대상 높이 (픽셀) - undefined/null 시 비율에 따라 자동 계산
   * @param options 리사이징 옵션
   * @returns 체이닝을 위한 this
   *
   * @example
   * ```typescript
   * // 기본 사용법
   * processor.resize(300, 200)  // 기본값: cover fit
   * processor.resize(300)       // 너비만 지정, 높이 자동
   * processor.resize({ width: 300 })  // 객체 스타일
   * processor.resize({ height: 200 }) // 높이만 지정
   *
   * // 고급 옵션
   * processor.resize(300, 200, {
   *   fit: 'contain',
   *   position: 'centre',  // 영국식 철자
   *   background: { r: 255, g: 255, b: 255, alpha: 1 },
   *   withoutEnlargement: true
   * })
   * ```
   */
  resize(width?: number | null, height?: number | null, options?: ResizeOptions): this;
  resize(options: ResizeOptions): this;
  resize(width: number): this; // 너비만 지정
  resize(width: number, height: number, options: SmartResizeOptions): this; // 스마트 리사이징
  resize(
    widthOrOptions?: number | null | ResizeOptions | SmartResizeOptions,
    height?: number | null,
    options: ResizeOptions | SmartResizeOptions = {}
  ): this {
    // 오버로드 파라미터 처리
    let finalWidth: number | undefined;
    let finalHeight: number | undefined;
    let finalOptions: ResizeOptions | SmartResizeOptions;

    if (typeof widthOrOptions === 'object' && widthOrOptions !== null) {
      // resize({ width: 300, height: 200, ... }) 형태
      finalOptions = widthOrOptions;
      finalWidth = finalOptions.width;
      finalHeight = finalOptions.height;
    } else {
      // resize(300, 200, { ... }) 형태
      finalWidth = widthOrOptions || undefined;
      finalHeight = height || undefined;
      finalOptions = options;
    }

    // Canvas API는 리사이징 전략을 선택할 수 없으므로 모든 리사이징을 일반 방식으로 처리
    const resizeOptions: ResizeOptions = {
      width: finalWidth,
      height: finalHeight,
      fit: 'cover', // 기본값
      position: 'centre', // 기본값 (영국식 철자)
      background: { r: 0, g: 0, b: 0, alpha: 1 }, // 기본값: 불투명한 검정
      withoutEnlargement: false,
      withoutReduction: false,
      ...finalOptions,
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    return this;
  }

  /**
   * 이미지 블러 효과
   *
   * @param radius 블러 반지름 (기본: 2)
   * @param options 블러 옵션
   * @returns 체이닝을 위한 this
   *
   * @example
   * ```typescript
   * // 기본 블러
   * processor.blur()
   *
   * // 강한 블러
   * processor.blur(10)
   *
   * // 정밀 블러 (고품질)
   * processor.blur(5, { precision: 2 })
   * ```
   */
  blur(radius: number = 2, options: Partial<BlurOptions> = {}): this {
    const blurOptions: BlurOptions = {
      radius,
      ...options,
    };

    this.pipeline.addOperation({
      type: 'blur',
      options: blurOptions,
    });

    return this;
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
   * Canvas로 변환 (기본 - 참조 반환)
   *
   * @returns 처리된 Canvas 요소
   *
   * @example
   * ```typescript
   * const canvas = await processor.toCanvas();
   * // Canvas를 DOM에 추가하거나 직접 조작 가능
   * document.body.appendChild(canvas);
   * ```
   */
  async toCanvas(): Promise<HTMLCanvasElement> {
    try {
      const { canvas } = await this.executeProcessing();
      return canvas;
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
      return {
        canvas,
        width: result.width,
        height: result.height,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
      };
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
      // 소스를 HTMLImageElement로 변환
      const imageElement = await convertToImageElement(this.source, this.options);

      // 파이프라인 실행
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

  // SmartResizeOptions는 이제 ResizeOptions와 동일하므로 구분 불필요

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
}

/**
 * 이미지 프로세서 팩토리 함수
 *
 * @param source 이미지 소스
 * @param options 프로세서 옵션
 * @returns ImageProcessor 인스턴스
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const processor = processImage(imageElement);
 * const processor = processImage(blob);
 * const processor = processImage('https://example.com/image.jpg');
 * const processor = processImage('<svg>...</svg>');
 *
 * // 옵션과 함께
 * const processor = processImage(source, {
 *   crossOrigin: 'use-credentials',
 *   defaultQuality: 0.9
 * });
 * ```
 */
export function processImage(source: ImageSource, options?: ProcessorOptions): ImageProcessor {
  return new ImageProcessor(source, options);
}
