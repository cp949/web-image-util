/**
 * 이미지 소스 변환기 - ImageSource 중심의 타입 안전 변환 시스템
 *
 * @description ImageProcessor와 독립적으로 동작하는 변환 전용 API
 * 다양한 이미지 소스를 Canvas, Blob, DataURL, Element 간 효율적으로 변환
 * 성능 최적화를 위해 이중 디코딩을 방지하고 직접 변환 경로를 제공
 */

import type { ImageSource } from '../types/base';
import { ImageProcessError } from '../types';
import type { ResultMetadata } from '../types';
import { detectSourceType, convertToImageElement } from '../core/source-converter';
import { SVGProcessor } from './svg-processor';

/**
 * 변환 가능한 타겟 타입
 */
export type ConvertibleTarget = 'canvas' | 'blob' | 'dataURL' | 'element' | 'file' | 'arrayBuffer' | 'uint8Array';

/**
 * 변환 옵션
 */
export interface ConversionOptions {
  /** CORS 설정 (URL 로딩 시) */
  crossOrigin?: string;
  /** 출력 이미지 품질 (0.0 - 1.0) */
  quality?: number;
  /** 출력 포맷 (blob, dataURL, file 변환 시) */
  format?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** 파일명 (file 변환 시) */
  filename?: string;
}

/**
 * 변환 결과 타입 매핑
 */
export type ConvertedType<T extends ConvertibleTarget> = T extends 'canvas'
  ? HTMLCanvasElement
  : T extends 'blob'
  ? Blob
  : T extends 'dataURL'
  ? string
  : T extends 'element'
  ? HTMLImageElement
  : T extends 'file'
  ? File
  : T extends 'arrayBuffer'
  ? ArrayBuffer
  : T extends 'uint8Array'
  ? Uint8Array
  : never;

/**
 * ImageSource 변환기 클래스
 *
 * @description 다양한 이미지 소스를 효율적으로 변환하는 API
 * 체이닝 패턴을 사용하여 직관적인 사용법 제공
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const converter = ImageSourceConverter.from(imageBlob);
 * const canvas = await converter.toCanvas();
 * const dataURL = await converter.toDataURL();
 *
 * // 옵션과 함께 사용
 * const file = await converter.toFile({
 *   filename: 'image.png',
 *   format: 'image/png',
 *   quality: 0.9
 * });
 * ```
 */
export class ImageSourceConverter {
  private constructor(
    private readonly source: ImageSource,
    private readonly metadata?: Partial<ResultMetadata> // 🆕 메타데이터 주입
  ) {}

  /**
   * ImageSource로부터 변환기 인스턴스를 생성합니다
   *
   * @param source 변환할 이미지 소스
   * @returns ImageSourceConverter 인스턴스
   */
  static from(source: ImageSource): ImageSourceConverter;
  /**
   * ImageSource와 메타데이터로부터 변환기 인스턴스를 생성합니다 (성능 최적화)
   *
   * @param source 변환할 이미지 소스
   * @param metadata 크기 정보 등의 메타데이터 (성능 최적화용)
   * @returns ImageSourceConverter 인스턴스
   */
  static from(source: ImageSource, metadata: Partial<ResultMetadata>): ImageSourceConverter;
  static from(source: ImageSource, metadata?: Partial<ResultMetadata>): ImageSourceConverter {
    return new ImageSourceConverter(source, metadata);
  }

  /**
   * HTMLCanvasElement로 변환
   *
   * @param options 변환 옵션
   * @returns HTMLCanvasElement
   */
  async toCanvas(options?: ConversionOptions): Promise<HTMLCanvasElement> {
    // 🎯 크기 정보가 있고 DataURL인 경우 직접 변환 (성능 최적화)
    if (this.metadata?.width && this.metadata?.height && typeof this.source === 'string') {
      return await this.createCanvasDirectly(this.source, this.metadata.width, this.metadata.height);
    }

    // 기존 로직 (메타데이터가 없거나 다른 타입인 경우)
    return await this.createCanvasWithImageLoading(options);
  }

  /**
   * 크기 정보를 활용한 직접 Canvas 생성 (최적화)
   * @private
   */
  private async createCanvasDirectly(dataURL: string, width: number, height: number): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // 크기를 미리 설정 (재측정 불필요)
    canvas.width = width;
    canvas.height = height;

    // 이미지 로딩은 한 번만
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new ImageProcessError('이미지 로딩 실패', 'IMAGE_LOAD_FAILED'));
      img.src = dataURL;
    });

    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  /**
   * 기존 이미지 로딩 방식 (타입 감지 후 변환)
   * @private
   */
  private async createCanvasWithImageLoading(options?: ConversionOptions): Promise<HTMLCanvasElement> {
    const sourceType = detectSourceType(this.source);

    switch (sourceType) {
      case 'element':
        return await this.elementToCanvas(this.source as HTMLImageElement);

      case 'canvas':
        // 이미 Canvas인 경우 직접 반환
        return this.source as HTMLCanvasElement;

      case 'blob':
        return await this.blobToCanvas(this.source as Blob);

      case 'arrayBuffer':
        return await this.arrayBufferToCanvas(this.source as ArrayBuffer);

      case 'uint8Array':
        return await this.uint8ArrayToCanvas(this.source as Uint8Array);

      case 'dataurl':
      case 'url':
      case 'path':
        return await this.stringToCanvas(this.source as string, options);

      case 'svg':
        return await this.svgToCanvas(this.source as string, options);

      default:
        throw new ImageProcessError(`지원하지 않는 소스 타입입니다: ${sourceType}`, 'UNSUPPORTED_FORMAT');
    }
  }

  /**
   * Blob으로 변환
   *
   * @param options 변환 옵션
   * @returns Blob
   */
  async toBlob(options?: ConversionOptions): Promise<Blob> {
    // Blob인 경우 직접 반환 (포맷 변환이 필요없는 경우)
    if (this.source instanceof Blob) {
      const format = options?.format;
      if (!format || this.source.type === this.formatToMimeType(format)) {
        return this.source;
      }
    }

    // Canvas로 변환 후 Blob 생성
    const canvas = await this.toCanvas(options);
    return await this.canvasToBlob(canvas, options);
  }

  /**
   * Data URL로 변환
   *
   * @param options 변환 옵션
   * @returns Data URL 문자열
   */
  async toDataURL(options?: ConversionOptions): Promise<string> {
    // 이미 Data URL인 경우 직접 반환 (포맷 변환이 필요없는 경우)
    if (typeof this.source === 'string' && this.source.startsWith('data:')) {
      if (!options?.format && !options?.quality) {
        return this.source;
      }
    }

    // Blob인 경우 FileReader 사용
    if (this.source instanceof Blob && !options?.format && !options?.quality) {
      return await this.blobToDataURL(this.source);
    }

    // Canvas로 변환 후 Data URL 생성
    const canvas = await this.toCanvas(options);
    return this.canvasToDataURL(canvas, options);
  }

  /**
   * HTMLImageElement로 변환
   *
   * @param options 변환 옵션
   * @returns HTMLImageElement
   */
  async toElement(options?: ConversionOptions): Promise<HTMLImageElement> {
    // 이미 HTMLImageElement인 경우 직접 반환
    if (this.source instanceof HTMLImageElement) {
      return this.source;
    }

    // convertToImageElement 함수 활용
    return await convertToImageElement(this.source, options);
  }

  /**
   * File 객체로 변환
   *
   * @param options 변환 옵션 (filename 필수)
   * @returns File 객체
   */
  async toFile(options: ConversionOptions & { filename: string }): Promise<File> {
    // filename 검증
    if (!options || !('filename' in options)) {
      throw new ImageProcessError('File 변환에는 filename 옵션이 필요합니다', 'INVALID_SOURCE');
    }

    const blob = await this.toBlob(options);

    // 파일명 확장자 자동 수정
    let finalFilename = options.filename;
    if (options.format) {
      finalFilename = this.adjustFileExtension(options.filename, options.format);
    } else {
      // format이 없는 경우 blob.type에서 확장자 추출
      finalFilename = this.adjustFileExtension(options.filename, blob.type);
    }

    return new File([blob], finalFilename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  }

  /**
   * ArrayBuffer로 변환
   *
   * @param options 변환 옵션
   * @returns ArrayBuffer
   */
  async toArrayBuffer(options?: ConversionOptions): Promise<ArrayBuffer> {
    const blob = await this.toBlob(options);
    return await blob.arrayBuffer();
  }

  /**
   * Uint8Array로 변환
   *
   * @param options 변환 옵션
   * @returns Uint8Array
   */
  async toUint8Array(options?: ConversionOptions): Promise<Uint8Array> {
    const arrayBuffer = await this.toArrayBuffer(options);
    return new Uint8Array(arrayBuffer);
  }

  /**
   * 소스 타입을 확인합니다
   *
   * @returns 소스 타입
   */
  getSourceType() {
    return detectSourceType(this.source);
  }

  /**
   * 원본 소스를 반환합니다
   *
   * @returns 원본 ImageSource
   */
  getSource(): ImageSource {
    return this.source;
  }

  // === Private 헬퍼 메서드들 ===

  /**
   * HTMLImageElement를 Canvas로 변환
   */
  private async elementToCanvas(element: HTMLImageElement): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new ImageProcessError('Canvas 2D context를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
    }

    canvas.width = element.naturalWidth || element.width;
    canvas.height = element.naturalHeight || element.height;

    ctx.drawImage(element, 0, 0);
    return canvas;
  }

  /**
   * Blob을 Canvas로 변환
   */
  private async blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
    const element = await convertToImageElement(blob);
    return await this.elementToCanvas(element);
  }

  /**
   * ArrayBuffer를 Canvas로 변환
   */
  private async arrayBufferToCanvas(arrayBuffer: ArrayBuffer): Promise<HTMLCanvasElement> {
    const element = await convertToImageElement(arrayBuffer);
    return await this.elementToCanvas(element);
  }

  /**
   * Uint8Array를 Canvas로 변환
   */
  private async uint8ArrayToCanvas(uint8Array: Uint8Array): Promise<HTMLCanvasElement> {
    const element = await convertToImageElement(uint8Array);
    return await this.elementToCanvas(element);
  }

  /**
   * 문자열 소스를 Canvas로 변환
   */
  private async stringToCanvas(source: string, options?: ConversionOptions): Promise<HTMLCanvasElement> {
    const element = await convertToImageElement(source, options);
    return await this.elementToCanvas(element);
  }

  /**
   * SVG 문자열을 Canvas로 변환 (SVGProcessor 활용)
   */
  private async svgToCanvas(svgString: string, options?: ConversionOptions): Promise<HTMLCanvasElement> {
    const element = await SVGProcessor.processSVGString(svgString, {
      crossOrigin: options?.crossOrigin,
      normalize: true
    });
    return await this.elementToCanvas(element);
  }

  /**
   * Canvas를 Blob으로 변환
   */
  private async canvasToBlob(canvas: HTMLCanvasElement, options?: ConversionOptions): Promise<Blob> {
    const mimeType = this.formatToMimeType(options?.format || 'png');
    const quality = options?.quality ?? 0.8;

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new ImageProcessError('Canvas to Blob 변환에 실패했습니다', 'CONVERSION_FAILED'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Canvas를 Data URL로 변환
   */
  private canvasToDataURL(canvas: HTMLCanvasElement, options?: ConversionOptions): string {
    const mimeType = this.formatToMimeType(options?.format || 'png');
    const quality = options?.quality ?? 0.8;
    return canvas.toDataURL(mimeType, quality);
  }

  /**
   * Blob을 Data URL로 변환
   */
  private async blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new ImageProcessError('Blob to Data URL 변환에 실패했습니다', 'CONVERSION_FAILED'));
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

  /**
   * 파일명 확장자 조정
   */
  private adjustFileExtension(filename: string, format: string): string {
    // 빈 filename 처리
    if (!filename) {
      filename = '';
    }

    const lastDotIndex = filename.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

    // MIME 타입에서 확장자 추출
    let extension: string;
    if (format.startsWith('image/')) {
      // MIME 타입에서 서브타입 추출 (예: image/png -> png)
      extension = format.substring(6); // 'image/' 제거

      // JPEG는 jpg로 통일
      if (extension === 'jpeg') {
        extension = 'jpg';
      }
    } else {
      // 이미 확장자 형태라면 그대로 사용
      extension = format === 'jpeg' ? 'jpg' : format;
    }

    return `${nameWithoutExt}.${extension}`;
  }

  /**
   * ArrayBuffer에서 MIME 타입을 자동 감지합니다
   *
   * @param buffer ArrayBuffer 데이터
   * @returns 감지된 MIME 타입
   */
  private detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);

    // PNG 시그니처: 89 50 4E 47 0D 0A 1A 0A
    if (bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
      return 'image/png';
    }

    // JPEG 시그니처: FF D8 FF
    if (bytes.length >= 3 &&
        bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }

    // WebP 시그니처: RIFF ... WEBP (파일 헤더 확인)
    if (bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      // WEBP 시그니처 확인 (8-11 바이트)
      if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return 'image/webp';
      }
    }

    // GIF 시그니처: GIF87a 또는 GIF89a
    if (bytes.length >= 6) {
      const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
      if (gifSignature === 'GIF') {
        const version = String.fromCharCode(...bytes.slice(3, 6));
        if (version === '87a' || version === '89a') {
          return 'image/gif';
        }
      }
    }

    // BMP 시그니처: BM
    if (bytes.length >= 2 &&
        bytes[0] === 0x42 && bytes[1] === 0x4D) {
      return 'image/bmp';
    }

    // TIFF 시그니처: II* (little-endian) 또는 MM* (big-endian)
    if (bytes.length >= 4) {
      if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
          (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)) {
        return 'image/tiff';
      }
    }

    // ICO 시그니처: 00 00 01 00
    if (bytes.length >= 4 &&
        bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
      return 'image/x-icon';
    }

    // 기본값으로 PNG 반환
    return 'image/png';
  }

  /**
   * ArrayBuffer를 Blob으로 변환 (MIME 타입 자동 감지)
   *
   * @param buffer ArrayBuffer 데이터
   * @returns Blob 객체
   */
  private arrayBufferToBlob(buffer: ArrayBuffer): Blob {
    const mimeType = this.detectMimeTypeFromBuffer(buffer);
    return new Blob([buffer], { type: mimeType });
  }
}

/**
 * 범용 변환 함수 (함수형 API)
 *
 * @description Class 기반 API의 대안으로 제공되는 함수형 변환 API
 * @param source 변환할 이미지 소스
 * @param target 변환 타겟 타입
 * @param options 변환 옵션
 * @returns 변환된 객체
 */
export async function convertTo<T extends ConvertibleTarget>(
  source: ImageSource,
  target: T,
  options?: ConversionOptions
): Promise<ConvertedType<T>> {
  const converter = ImageSourceConverter.from(source);

  switch (target) {
    case 'canvas':
      return converter.toCanvas(options) as Promise<ConvertedType<T>>;
    case 'blob':
      return converter.toBlob(options) as Promise<ConvertedType<T>>;
    case 'dataURL':
      return converter.toDataURL(options) as Promise<ConvertedType<T>>;
    case 'element':
      return converter.toElement(options) as Promise<ConvertedType<T>>;
    case 'arrayBuffer':
      return converter.toArrayBuffer(options) as Promise<ConvertedType<T>>;
    case 'uint8Array':
      return converter.toUint8Array(options) as Promise<ConvertedType<T>>;
    case 'file':
      if (!options?.filename) {
        throw new ImageProcessError('File 변환에는 filename 옵션이 필요합니다', 'INVALID_SOURCE');
      }
      return converter.toFile(options as ConversionOptions & { filename: string }) as Promise<ConvertedType<T>>;
    default:
      throw new ImageProcessError(`지원하지 않는 변환 타겟입니다: ${target}`, 'UNSUPPORTED_FORMAT');
  }
}

/**
 * 빌더 패턴 API를 위한 변환 빌더 클래스
 *
 * @description 체이닝 문법을 통해 직관적인 변환 API 제공
 * from(source).to.canvas() 형태의 사용법 지원
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const canvas = await from(blob).to.canvas();
 * const dataURL = await from(element).to.dataURL({ quality: 0.9 });
 *
 * // 파일 변환
 * const file = await from(canvas).to.file('image.webp', { format: 'webp' });
 * ```
 */
export class ConversionBuilder {
  constructor(
    private readonly source: ImageSource,
    private readonly metadata?: Partial<ResultMetadata>
  ) {}

  /**
   * 변환 타겟별 메서드들
   * readonly 속성으로 안전성 보장
   */
  readonly to = {
    /**
     * HTMLImageElement로 변환
     */
    element: (options?: ConversionOptions) => this.convert('element', options),

    /**
     * HTMLCanvasElement로 변환
     */
    canvas: (options?: ConversionOptions) => this.convert('canvas', options),

    /**
     * Blob으로 변환
     */
    blob: (options?: ConversionOptions) => this.convert('blob', options),

    /**
     * Data URL 문자열로 변환
     */
    dataURL: (options?: ConversionOptions) => this.convert('dataURL', options),

    /**
     * ArrayBuffer로 변환
     */
    arrayBuffer: (options?: ConversionOptions) => this.convert('arrayBuffer', options),

    /**
     * Uint8Array로 변환
     */
    uint8Array: (options?: ConversionOptions) => this.convert('uint8Array', options),

    /**
     * File 객체로 변환
     * @param filename 파일명 (필수)
     * @param options 추가 변환 옵션
     */
    file: (filename: string, options?: ConversionOptions) =>
      this.convert('file', { ...options, filename })
  };

  /**
   * 내부 변환 메서드
   * 메타데이터가 있으면 성능 최적화된 변환 사용
   */
  private async convert(target: ConvertibleTarget, options?: ConversionOptions) {
    // 메타데이터가 있으면 ImageSourceConverter에 전달하여 성능 최적화
    if (this.metadata) {
      const converter = ImageSourceConverter.from(this.source, this.metadata);

      switch (target) {
        case 'canvas':
          return converter.toCanvas(options);
        case 'blob':
          return converter.toBlob(options);
        case 'dataURL':
          return converter.toDataURL(options);
        case 'element':
          return converter.toElement(options);
        case 'arrayBuffer':
          return converter.toArrayBuffer(options);
        case 'uint8Array':
          return converter.toUint8Array(options);
        case 'file':
          if (!options?.filename) {
            throw new ImageProcessError('File 변환에는 filename 옵션이 필요합니다', 'INVALID_SOURCE');
          }
          return converter.toFile(options as ConversionOptions & { filename: string });
        default:
          throw new ImageProcessError(`지원하지 않는 변환 타겟입니다: ${target}`, 'UNSUPPORTED_FORMAT');
      }
    }

    // 메타데이터가 없으면 기본 convertTo 함수 사용
    return convertTo(this.source, target as any, options);
  }
}

/**
 * 빌더 패턴 API 엔트리 포인트
 *
 * @param source 변환할 이미지 소스
 * @returns ConversionBuilder 인스턴스
 *
 * @example
 * ```typescript
 * // 다양한 소스 타입 지원
 * const canvas1 = await from(blob).to.canvas();
 * const canvas2 = await from(element).to.canvas();
 * const canvas3 = await from(dataURL).to.canvas();
 * const canvas4 = await from(arrayBuffer).to.canvas();
 *
 * // 옵션과 함께 사용
 * const file = await from(canvas).to.file('output.png', {
 *   format: 'image/png',
 *   quality: 0.9
 * });
 * ```
 */
export function from(source: ImageSource): ConversionBuilder;
/**
 * 메타데이터 주입을 지원하는 빌더 패턴 API
 *
 * @param source 변환할 이미지 소스
 * @param metadata 크기 정보 등의 메타데이터 (성능 최적화용)
 * @returns ConversionBuilder 인스턴스
 *
 * @example
 * ```typescript
 * // 성능 최적화된 사용법
 * const result = await processImage(source).resize(300, 200).toDataURL();
 * const canvas = await from(result.dataURL, result).to.canvas();
 * // 메타데이터로 크기 정보를 미리 알고 있어 빠른 변환 가능
 * ```
 */
export function from(source: ImageSource, metadata: Partial<ResultMetadata>): ConversionBuilder;
export function from(source: ImageSource, metadata?: Partial<ResultMetadata>): ConversionBuilder {
  // 메타데이터 주입 지원 - ConversionBuilder에 메타데이터 전달
  return new ConversionBuilder(source, metadata);
}