/**
 * 이미지 프로세서 - 체이닝 API의 핵심 클래스
 * Sharp 라이브러리의 패턴을 참고하여 설계됨
 */

import { createPipeline } from './core/pipeline';
import { convertToImageElement } from './core/source-converter';
import type {
  AtMostOptions,
  BlobResult,
  BlurOptions,
  DataURLResult,
  FileResult,
  ImageFormat,
  ImageSource,
  OutputOptions,
  ProcessorOptions,
  ResizeOptions,
} from './types';
import { ImageProcessError, OPTIMAL_QUALITY_BY_FORMAT } from './types';

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
   * @param width 대상 너비 (픽셀)
   * @param height 대상 높이 (픽셀)
   * @param options 리사이징 옵션
   * @returns 체이닝을 위한 this
   *
   * @example
   * ```typescript
   * // 기본 사용법 (cover fit)
   * processor.resize(300, 200)
   *
   * // 전체 이미지 보존 (pad fit)
   * processor.resize(300, 200, { fit: 'pad' })
   *
   * // 비율 유지하며 너비만 지정
   * processor.resize(300)
   *
   * // 고급 옵션
   * processor.resize(300, 200, {
   *   fit: 'cover',
   *   position: 'top',
   *   background: '#ffffff'
   * })
   * ```
   */
  resize(width?: number, height?: number, options: ResizeOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      height,
      fit: 'cover', // Sharp와 동일한 기본값
      position: 'center',
      background: this.options.defaultBackground,
      withoutEnlargement: false,
      withoutReduction: false,
      ...options,
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
      precision: 1,
      minAmplitude: 0.2,
      ...options,
    };

    this.pipeline.addOperation({
      type: 'blur',
      options: blurOptions,
    });

    return this;
  }

  /**
   * 최대 사각형 크기 제한 리사이징 (trim 적용)
   *
   * @param width 최대 너비 (픽셀)
   * @param height 최대 높이 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지를 지정한 사각형 크기를 넘지 않도록 리사이징합니다.
   * 결과 이미지 크기는 실제 스케일링된 이미지 크기와 동일합니다.
   * (여백 없음, 자동 trim 적용)
   *
   * @example
   * ```typescript
   * // 300x200을 넘지 않게 리사이징 (비율 유지)
   * processor.atMostRect(300, 200)
   *
   * // 100x100 정사각형 이미지 → 200x200으로 스케일링됨 (결과: 200x200)
   * processor.atMostRect(300, 200) // 작은 스케일(2배) 선택
   * ```
   */
  atMostRect(width: number, height: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      height,
      fit: 'atMost', // 최대 크기로 제한하며 확대하지 않음
      position: 'center',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: options.withoutEnlargement !== false, // 기본 true
      withoutReduction: false,
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    // trim 효과를 위한 crop 연산 추가
    this.pipeline.addOperation({
      type: 'trim',
      options: {},
    });

    return this;
  }

  /**
   * 최대 너비 제한 리사이징 (비율 유지)
   *
   * @param width 최대 너비 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 너비를 지정한 크기를 넘지 않도록 리사이징하며, 비율을 유지합니다.
   *
   * @example
   * ```typescript
   * // 너비가 300을 넘지 않게 (높이는 비율에 따라 자동 계산)
   * processor.atMostWidth(300)
   * ```
   */
  atMostWidth(width: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      height: undefined, // 비율 유지를 위해 높이는 미지정
      fit: 'atMost',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: options.withoutEnlargement !== false,
      withoutReduction: false,
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    this.pipeline.addOperation({
      type: 'trim',
      options: {},
    });

    return this;
  }

  /**
   * 최대 높이 제한 리사이징 (비율 유지)
   *
   * @param height 최대 높이 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 높이를 지정한 크기를 넘지 않도록 리사이징하며, 비율을 유지합니다.
   *
   * @example
   * ```typescript
   * // 높이가 200을 넘지 않게 (너비는 비율에 따라 자동 계산)
   * processor.atMostHeight(200)
   * ```
   */
  atMostHeight(height: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width: undefined, // 비율 유지를 위해 너비는 미지정
      height,
      fit: 'atMost',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: options.withoutEnlargement !== false,
      withoutReduction: false,
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    this.pipeline.addOperation({
      type: 'trim',
      options: {},
    });

    return this;
  }

  /**
   * 최소 너비 보장 리사이징 (비율 유지, 확대만)
   *
   * @param width 최소 너비 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지가 지정한 너비보다 작을 때만 확대합니다.
   * 원본이 더 크면 그대로 유지됩니다.
   * 높이는 비율에 따라 자동으로 계산됩니다.
   *
   * @example
   * ```typescript
   * // 최소 300px 너비 보장
   * processor.atLeastWidth(300)
   *
   * // 200x100 이미지 → 300x150 (확대)
   * // 500x250 이미지 → 500x250 (그대로)
   * ```
   */
  atLeastWidth(width: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      fit: 'atLeast',
      position: 'center',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: false,
      withoutReduction: options.withoutEnlargement !== false, // 기본 true (축소 방지)
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    return this;
  }

  /**
   * 최소 높이 보장 리사이징 (비율 유지, 확대만)
   *
   * @param height 최소 높이 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지가 지정한 높이보다 작을 때만 확대합니다.
   * 원본이 더 크면 그대로 유지됩니다.
   * 너비는 비율에 따라 자동으로 계산됩니다.
   *
   * @example
   * ```typescript
   * // 최소 200px 높이 보장
   * processor.atLeastHeight(200)
   *
   * // 300x100 이미지 → 600x200 (확대)
   * // 400x300 이미지 → 400x300 (그대로)
   * ```
   */
  atLeastHeight(height: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      height,
      fit: 'atLeast',
      position: 'center',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: false,
      withoutReduction: options.withoutEnlargement !== false, // 기본 true (축소 방지)
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    return this;
  }

  /**
   * 최소 사각형 크기 보장 리사이징 (비율 유지, 확대만)
   *
   * @param width 최소 너비 (픽셀)
   * @param height 최소 높이 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지가 지정한 사각형보다 작을 때만 확대합니다.
   * 원본이 더 크면 그대로 유지되며, 필요시 잘림이 발생합니다.
   * atLeast fit을 사용하여 최소 크기를 보장합니다.
   *
   * @example
   * ```typescript
   * // 최소 300x200 크기 보장
   * processor.atLeastRect(300, 200)
   *
   * // 200x100 이미지 → 400x200 (확대, 비율 유지)
   * // 500x300 이미지 → 500x300 (그대로)
   * ```
   */
  atLeastRect(width: number, height: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      height,
      fit: 'atLeast',
      position: 'center',
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: false,
      withoutReduction: options.withoutEnlargement !== false, // 기본 true (축소 방지)
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    return this;
  }

  /**
   * 강제 너비 설정 (확대/축소 모두 수행)
   *
   * @param width 강제할 너비 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지를 지정한 너비로 강제 설정합니다.
   * 원본이 작으면 확대하고, 크면 축소합니다.
   * 높이는 비율에 따라 자동으로 계산됩니다.
   * SVG의 경우 확대해도 화질 저하가 없어 자주 사용됩니다.
   *
   * @example
   * ```typescript
   * // 너비를 300으로 강제 설정 (높이는 비율에 따라 자동)
   * processor.forceWidth(300)
   *
   * // 50x50 이미지 → 300x300 (6배 확대)
   * // 800x400 이미지 → 300x150 (축소)
   * ```
   */
  forceWidth(width: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width,
      height: undefined, // 비율 유지를 위해 높이는 미지정
      fit: 'stretch', // 비율을 무시하고 정확한 크기로 맞춤
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: false, // 확대 허용
      withoutReduction: false, // 축소 허용
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    // trim 적용하여 실제 크기 결과 반환
    this.pipeline.addOperation({
      type: 'trim',
      options: {},
    });

    return this;
  }

  /**
   * 강제 높이 설정 (확대/축소 모두 수행)
   *
   * @param height 강제할 높이 (픽셀)
   * @param options 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 이미지를 지정한 높이로 강제 설정합니다.
   * 원본이 작으면 확대하고, 크면 축소합니다.
   * 너비는 비율에 따라 자동으로 계산됩니다.
   * SVG의 경우 확대해도 화질 저하가 없어 자주 사용됩니다.
   *
   * @example
   * ```typescript
   * // 높이를 200으로 강제 설정 (너비는 비율에 따라 자동)
   * processor.forceHeight(200)
   *
   * // 100x50 이미지 → 400x200 (4배 확대)
   * // 600x800 이미지 → 150x200 (축소)
   * ```
   */
  forceHeight(height: number, options: AtMostOptions = {}): this {
    const resizeOptions: ResizeOptions = {
      width: undefined, // 비율 유지를 위해 너비는 미지정
      height,
      fit: 'stretch', // 비율을 무시하고 정확한 크기로 맞춤
      background: options.background || this.options.defaultBackground,
      withoutEnlargement: false, // 확대 허용
      withoutReduction: false, // 축소 허용
    };

    this.pipeline.addOperation({
      type: 'resize',
      options: resizeOptions,
    });

    // trim 적용하여 실제 크기 결과 반환
    this.pipeline.addOperation({
      type: 'trim',
      options: {},
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
  private getBestFormat(): ImageFormat {
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
    // 기존에 정의된 OPTIMAL_QUALITY_BY_FORMAT 사용
    return OPTIMAL_QUALITY_BY_FORMAT[format] || (this.options.defaultQuality || 0.8);
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
  private getFormatFromFilename(filename: string): ImageFormat | null {
    const ext = filename.toLowerCase().split('.').pop();

    // 지원되는 포맷만 매핑
    const formatMap: Record<string, ImageFormat> = {
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'webp': 'webp',
      'avif': 'avif'
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

  async toBlob(options?: OutputOptions): Promise<BlobResult>;
  async toBlob(format: ImageFormat): Promise<BlobResult>;
  async toBlob(optionsOrFormat: OutputOptions | ImageFormat = {}): Promise<BlobResult> {
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

      return {
        blob,
        width: result.width,
        height: result.height,
        processingTime: result.processingTime,
        originalSize: result.originalSize,
      };
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
  async toDataURL(options?: OutputOptions): Promise<DataURLResult>;
  async toDataURL(format: ImageFormat): Promise<DataURLResult>;
  async toDataURL(optionsOrFormat: OutputOptions | ImageFormat = {}): Promise<DataURLResult> {
    // 타입에 따라 적절한 toBlob 호출 방식 선택
    const { blob, ...metadata } =
      typeof optionsOrFormat === 'string'
        ? await this.toBlob(optionsOrFormat) // ImageFormat 타입
        : await this.toBlob(optionsOrFormat); // OutputOptions 타입

    try {
      const dataURL = await this.blobToDataURL(blob);

      return {
        dataURL,
        ...metadata,
      };
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
  async toFile(filename: string, options?: OutputOptions): Promise<FileResult>;
  async toFile(filename: string, format: ImageFormat): Promise<FileResult>;
  async toFile(filename: string, optionsOrFormat: OutputOptions | ImageFormat = {}): Promise<FileResult> {
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
        quality: this.getOptimalQuality(formatFromFilename)
      };
    } else {
      // 기존 옵션 사용
      finalOptions = optionsOrFormat;
    }

    const { blob, ...metadata } = await this.toBlob(finalOptions);

    try {
      const file = new File([blob], filename, {
        type: blob.type,
        lastModified: Date.now(),
      });

      return {
        file,
        ...metadata,
      };
    } catch (error) {
      throw new ImageProcessError('File 객체 생성 중 오류가 발생했습니다', 'OUTPUT_FAILED', error as Error);
    }
  }

  /**
   * Canvas로 변환
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

  // ============================================
  // 편의 함수들 (Fit 옵션별 단축 메서드)
  // ============================================

  /**
   * Cover 리사이징 편의 함수
   *
   * @param width 너비 (픽셀)
   * @param height 높이 (픽셀)
   * @param options 추가 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 전체 영역을 채우며 필요시 잘림이 발생하는 리사이징입니다.
   * CSS object-fit: cover와 동일한 동작을 합니다.
   *
   * @example
   * ```typescript
   * // 300x200으로 cover 리사이징
   * processor.resizeCover(300, 200)
   *
   * // 위치 조정
   * processor.resizeCover(300, 200, { position: 'top' })
   * ```
   */
  resizeCover(width: number, height: number, options: Partial<ResizeOptions> = {}): this {
    return this.resize(width, height, {
      fit: 'cover',
      ...options,
    });
  }

  /**
   * Pad 리사이징 편의 함수
   *
   * @param width 너비 (픽셀)
   * @param height 높이 (픽셀)
   * @param options 추가 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 전체 이미지가 영역에 들어가도록 하며 여백으로 채웁니다.
   * 비율을 유지하며 확대/축소를 모두 수행합니다.
   *
   * @example
   * ```typescript
   * // 300x200으로 pad 리사이징
   * processor.resizePad(300, 200)
   *
   * // 배경색 지정
   * processor.resizePad(300, 200, { background: '#ffffff' })
   * ```
   */
  resizePad(width: number, height: number, options: Partial<ResizeOptions> = {}): this {
    return this.resize(width, height, {
      fit: 'pad',
      ...options,
    });
  }

  /**
   * Stretch 리사이징 편의 함수
   *
   * @param width 너비 (픽셀)
   * @param height 높이 (픽셀)
   * @param options 추가 옵션
   * @returns 체이닝을 위한 this
   *
   * @description
   * 비율을 무시하고 정확히 지정한 크기로 맞춥니다.
   * 이미지가 늘어나거나 압축될 수 있습니다.
   *
   * @example
   * ```typescript
   * // 300x200으로 강제 맞춤 (비율 무시)
   * processor.stretch(300, 200)
   * ```
   */
  stretch(width: number, height: number, options: Partial<ResizeOptions> = {}): this {
    return this.resize(width, height, {
      fit: 'stretch',
      ...options,
    });
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
