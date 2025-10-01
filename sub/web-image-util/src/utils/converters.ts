/**
 * 이미지 변환 유틸리티 함수들
 *
 * @description 단순하고 직관적인 이미지 변환 함수들을 제공
 */

import { convertToImageElement } from '../core/source-converter';
import type { ResultBlob, ResultDataURL, ResultFile, ImageSource, OutputOptions } from '../types';
import { ImageProcessError } from '../types';
import { DataURLResultImpl, BlobResultImpl, FileResultImpl } from '../types/result-implementations';

/**
 * 기본 Blob 변환 옵션
 */
export interface BlobOptions extends OutputOptions {
  // includeMetadata 옵션 제거 - 별도 함수로 분리
}

/**
 * 상세 정보 포함 Blob 변환 옵션
 */
export interface BlobDetailedOptions extends OutputOptions {
  // 상세 정보는 항상 포함됨
}

/**
 * 기본 DataURL 변환 옵션
 */
export interface DataURLOptions extends OutputOptions {
  // includeMetadata 옵션 제거 - 별도 함수로 분리
}

/**
 * 상세 정보 포함 DataURL 변환 옵션
 */
export interface DataURLDetailedOptions extends OutputOptions {
  // 상세 정보는 항상 포함됨
}

/**
 * 기본 File 변환 옵션
 */
export interface FileOptions extends OutputOptions {
  /** 파일 확장자 자동 수정 여부 (기본: true) */
  autoExtension?: boolean;
}

/**
 * 상세 정보 포함 File 변환 옵션
 */
export interface FileDetailedOptions extends OutputOptions {
  /** 파일 확장자 자동 수정 여부 (기본: true) */
  autoExtension?: boolean;
}

/**
 * 다양한 이미지 소스를 Blob으로 변환 (간단한 결과)
 *
 * @description 이미지를 Blob으로 변환하여 반환합니다.
 * 메타데이터가 필요한 경우 `toBlobDetailed()` 함수를 사용하세요.
 *
 * @param source 이미지 소스 (HTMLImageElement, HTMLCanvasElement, Blob, 또는 문자열)
 * @param options 변환 옵션
 * @returns Blob 객체
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const blob = await toBlob(imageElement);
 *
 * // 포맷과 품질 지정
 * const blob = await toBlob(canvasElement, {
 *   format: 'webp',
 *   quality: 0.8
 * });
 *
 * // Blob을 다시 Blob으로 (포맷 변환)
 * const webpBlob = await toBlob(jpegBlob, { format: 'webp' });
 * ```
 */
export async function toBlob(source: ImageSource | HTMLCanvasElement, options: BlobOptions = {}): Promise<Blob> {
  try {
    // Canvas인 경우 직접 변환
    if (source instanceof HTMLCanvasElement) {
      return await canvasToBlob(source, options);
    }

    // Blob인 경우 포맷 변환이 필요한지 확인
    if (source instanceof Blob) {
      // 동일한 포맷이고 품질 변경이 없으면 그대로 반환
      if (
        !options.format ||
        source.type === `image/${options.format}` ||
        source.type === formatToMimeType(options.format)
      ) {
        return source;
      }
    }

    // HTMLImageElement로 변환 후 Canvas를 통해 Blob 생성
    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    return await canvasToBlob(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Blob 변환 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 다양한 이미지 소스를 Blob으로 변환 (상세 정보 포함)
 *
 * @description 이미지를 Blob으로 변환하고 메타데이터를 포함하여 반환합니다.
 *
 * @param source 이미지 소스 (HTMLImageElement, HTMLCanvasElement, Blob, 또는 문자열)
 * @param options 변환 옵션
 * @returns BlobResult 객체 (Blob과 메타데이터 포함)
 *
 * @example
 * ```typescript
 * // 상세 정보 포함
 * const result = await toBlobDetailed(imageElement);
 * // 크기와 처리 시간 확인 가능
 * // result.width, result.height, result.processingTime
 *
 * // 포맷과 품질 지정
 * const result = await toBlobDetailed(canvasElement, {
 *   format: 'webp',
 *   quality: 0.8
 * });
 * ```
 */
export async function toBlobDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: BlobDetailedOptions = {}
): Promise<ResultBlob> {
  const startTime = Date.now();

  try {
    // Canvas인 경우 직접 변환
    if (source instanceof HTMLCanvasElement) {
      const blob = await canvasToBlob(source, options);
      return new BlobResultImpl(blob, source.width, source.height, Date.now() - startTime);
    }

    // Blob인 경우
    if (source instanceof Blob) {
      // 포맷 변환이 필요한지 확인
      if (
        !options.format ||
        source.type === `image/${options.format}` ||
        source.type === formatToMimeType(options.format)
      ) {
        const { width, height } = await getBlobDimensions(source);
        return new BlobResultImpl(source, width, height, Date.now() - startTime);
      }
    }

    // HTMLImageElement로 변환 후 Canvas를 통해 Blob 생성
    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    const blob = await canvasToBlob(canvas, options);

    return new BlobResultImpl(blob, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Blob 변환 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 다양한 이미지 소스를 Data URL로 변환
 *
 * @description 이미지를 Base64 인코딩된 Data URL로 변환
 * HTML img 태그의 src에 직접 사용 가능
 * 메타데이터가 필요한 경우 `toDataURLDetailed()` 함수를 사용하세요.
 *
 * @param source 이미지 소스
 * @param options 변환 옵션
 * @returns Data URL 문자열
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const dataURL = await toDataURL(imageElement);
 * imgTag.src = dataURL;
 *
 * // 고품질 JPEG로 변환
 * const dataURL = await toDataURL(blob, {
 *   format: 'jpeg',
 *   quality: 0.95
 * });
 * ```
 */
export async function toDataURL(
  source: ImageSource | HTMLCanvasElement,
  options: DataURLOptions = {}
): Promise<string> {
  try {
    // Canvas인 경우 직접 변환
    if (source instanceof HTMLCanvasElement) {
      return canvasToDataURL(source, options);
    }

    // Blob인 경우
    if (source instanceof Blob) {
      return await blobToDataURL(source);
    }

    // HTMLImageElement인 경우 Canvas를 거쳐서 변환 (포맷/품질 옵션 적용)
    const imageElement = await convertToImageElement(source);

    // 옵션이 없으면 직접 변환 (더 빠름)
    if (!options.format && !options.quality) {
      // 이미 Data URL인 경우 그대로 반환
      if (typeof source === 'string' && source.startsWith('data:')) {
        return source;
      }
    }

    // Canvas를 통한 변환
    const canvas = await imageElementToCanvas(imageElement);
    return canvasToDataURL(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Data URL 변환 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 다양한 이미지 소스를 Data URL로 변환 (상세 정보 포함)
 *
 * @description 이미지를 Base64 인코딩된 Data URL로 변환하고 메타데이터를 포함하여 반환합니다.
 *
 * @param source 이미지 소스
 * @param options 변환 옵션
 * @returns DataURLResult 객체 (Data URL과 메타데이터 포함)
 *
 * @example
 * ```typescript
 * // 상세 정보 포함
 * const result = await toDataURLDetailed(imageElement);
 * // Data URL 길이와 크기 확인 가능
 * // result.dataURL.length, result.width, result.height
 *
 * // 고품질 JPEG로 변환
 * const result = await toDataURLDetailed(blob, {
 *   format: 'jpeg',
 *   quality: 0.95
 * });
 * ```
 */
export async function toDataURLDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: DataURLDetailedOptions = {}
): Promise<ResultDataURL> {
  const startTime = Date.now();

  try {
    // Canvas인 경우 직접 변환
    if (source instanceof HTMLCanvasElement) {
      const dataURL = canvasToDataURL(source, options);
      return new DataURLResultImpl(dataURL, source.width, source.height, Date.now() - startTime);
    }

    // Blob인 경우
    if (source instanceof Blob) {
      const dataURL = await blobToDataURL(source);
      const { width, height } = await getBlobDimensions(source);
      return new DataURLResultImpl(dataURL, width, height, Date.now() - startTime);
    }

    // HTMLImageElement인 경우 Canvas를 거쳐서 변환 (포맷/품질 옵션 적용)
    const imageElement = await convertToImageElement(source);

    // 옵션이 없으면 직접 변환 (더 빠름)
    if (!options.format && !options.quality) {
      // 이미 Data URL인 경우 그대로 반환
      if (typeof source === 'string' && source.startsWith('data:')) {
        return new DataURLResultImpl(source, imageElement.width, imageElement.height, Date.now() - startTime);
      }
    }

    // Canvas를 통한 변환
    const canvas = await imageElementToCanvas(imageElement);
    const dataURL = canvasToDataURL(canvas, options);

    return new DataURLResultImpl(dataURL, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Data URL 변환 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 다양한 이미지 소스를 File 객체로 변환
 *
 * @description FormData에 추가하여 서버로 업로드할 수 있는 File 객체 생성
 * 파일명의 확장자는 지정된 포맷에 맞게 자동으로 조정됨
 * 메타데이터가 필요한 경우 `toFileDetailed()` 함수를 사용하세요.
 *
 * @param source 이미지 소스
 * @param filename 파일명
 * @param options 변환 옵션
 * @returns File 객체
 *
 * @example
 * ```typescript
 * // 기본 사용법
 * const file = await toFile(imageElement, 'photo.jpg');
 *
 * // WebP로 변환하여 파일 생성
 * const file = await toFile(blob, 'image.webp', {
 *   format: 'webp',
 *   quality: 0.8
 * });
 *
 * // 확장자 자동 수정
 * const file = await toFile(source, 'image.png', {
 *   format: 'jpeg', // 파일명이 자동으로 'image.jpeg'로 변경됨
 *   autoExtension: true
 * });
 *
 * // FormData에 추가하여 업로드
 * const formData = new FormData();
 * formData.append('image', file);
 * await fetch('/upload', { method: 'POST', body: formData });
 * ```
 */
export async function toFile(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: FileOptions = {}
): Promise<File> {
  try {
    // Blob 생성
    const blob = await toBlob(source, options);

    // 파일명 확장자 자동 수정
    let finalFilename = filename;
    if (options.autoExtension !== false && options.format) {
      finalFilename = adjustFileExtension(filename, options.format);
    }

    // File 객체 생성
    return new File([blob], finalFilename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    throw new ImageProcessError('File 객체 생성 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 다양한 이미지 소스를 File 객체로 변환 (상세 정보 포함)
 *
 * @description FormData에 추가하여 서버로 업로드할 수 있는 File 객체 생성하고 메타데이터를 포함하여 반환합니다.
 * 파일명의 확장자는 지정된 포맷에 맞게 자동으로 조정됩니다.
 *
 * @param source 이미지 소스
 * @param filename 파일명
 * @param options 변환 옵션
 * @returns FileResult 객체 (File과 메타데이터 포함)
 *
 * @example
 * ```typescript
 * // 상세 정보 포함
 * const result = await toFileDetailed(imageElement, 'photo.jpg');
 * // 파일 크기와 이미지 크기 확인 가능
 * // result.file.size, result.width, result.height
 *
 * // WebP로 변환하여 파일 생성
 * const result = await toFileDetailed(blob, 'image.webp', {
 *   format: 'webp',
 *   quality: 0.8
 * });
 * ```
 */
export async function toFileDetailed(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: FileDetailedOptions = {}
): Promise<ResultFile> {
  const startTime = Date.now();

  try {
    // Blob 생성 (상세 정보 포함)
    const blobResult = await toBlobDetailed(source, options);

    // 파일명 확장자 자동 수정
    let finalFilename = filename;
    if (options.autoExtension !== false && options.format) {
      finalFilename = adjustFileExtension(filename, options.format);
    }

    // File 객체 생성
    const file = new File([blobResult.blob], finalFilename, {
      type: blobResult.blob.type,
      lastModified: Date.now(),
    });

    return new FileResultImpl(
      file,
      blobResult.width,
      blobResult.height,
      Date.now() - startTime,
      blobResult.originalSize
    );
  } catch (error) {
    throw new ImageProcessError('File 객체 생성 중 오류가 발생했습니다', 'CONVERSION_FAILED', error as Error);
  }
}

// === 내부 유틸리티 함수들 ===

/**
 * Canvas를 Blob으로 변환
 */
async function canvasToBlob(canvas: HTMLCanvasElement, options: OutputOptions): Promise<Blob> {
  const mimeType = formatToMimeType(options.format || 'png');
  const quality = options.quality || 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // 대체 포맷으로 재시도
          const fallbackMimeType = formatToMimeType(options.fallbackFormat || 'png');
          canvas.toBlob(
            (fallbackBlob) => {
              if (fallbackBlob) {
                resolve(fallbackBlob);
              } else {
                reject(new Error('Canvas to Blob 변환 실패'));
              }
            },
            fallbackMimeType,
            quality
          );
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
function canvasToDataURL(canvas: HTMLCanvasElement, options: OutputOptions): string {
  const mimeType = formatToMimeType(options.format || 'png');
  const quality = options.quality || 0.8;

  return canvas.toDataURL(mimeType, quality);
}

/**
 * Blob을 Data URL로 변환
 */
async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob to Data URL 변환 실패'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 이미지 소스를 HTMLImageElement로 변환
 *
 * @param source 이미지 소스 (HTMLImageElement, Blob, URL, Data URL, SVG XML, ArrayBuffer 등)
 * @returns HTMLImageElement Promise
 *
 * @example
 * ```typescript
 * import { toElement } from '@cp949/web-image-util/utils';
 *
 * const element = await toElement(blob);
 * const element2 = await toElement('https://example.com/image.jpg');
 * const element3 = await toElement('<svg>...</svg>');
 * ```
 */
export async function toElement(source: ImageSource): Promise<HTMLImageElement> {
  return convertToImageElement(source);
}

/**
 * HTMLImageElement를 Canvas로 변환
 */
async function imageElementToCanvas(imageElement: HTMLImageElement): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new ImageProcessError('Canvas 2D context를 생성할 수 없습니다', 'CANVAS_CREATION_FAILED');
  }

  canvas.width = imageElement.width;
  canvas.height = imageElement.height;

  ctx.drawImage(imageElement, 0, 0);

  return canvas;
}

/**
 * Blob의 크기 정보 얻기
 */
async function getBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Blob 크기 정보를 읽을 수 없습니다'));
    };

    img.src = url;
  });
}

/**
 * 포맷을 MIME 타입으로 변환
 */
function formatToMimeType(format: string): string {
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
function adjustFileExtension(filename: string, format: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

  // JPEG는 jpg로 통일
  const extension = format === 'jpeg' ? 'jpg' : format;

  return `${nameWithoutExt}.${extension}`;
}
