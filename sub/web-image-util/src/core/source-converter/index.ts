/**
 * source-converter 서브모듈의 진입점이다.
 *
 * 다양한 입력 소스를 단일 HTMLImageElement로 정규화하는 오케스트레이션을 담당하며,
 * 실제 변환 로직은 형태별 로더 모듈에 위임한다.
 */

import type { ImageSource, ProcessorOptions } from '../../types';
import { ImageProcessError } from '../../types';
import { decodeExistingImage } from '../../utils/image-decode.internal';
import { detectSourceTypeAsync, type SourceType } from './detect.internal';
import { convertBlobToElement, detectMimeTypeFromBuffer } from './loaders/blob.internal';
import { convertCanvasToElement } from './loaders/canvas.internal';
import { convertStringToElement } from './loaders/string.internal';
import { DEFAULT_MAX_SOURCE_BYTES, type InternalSourceConverterOptions } from './options.internal';

/**
 * 모든 ImageSource 입력을 HTMLImageElement로 정규화한다.
 *
 * 비동기 판정 모듈이 확정한 소스 타입에 따라 형태별 로더로 위임한다.
 *
 * @param source 변환할 이미지 입력
 * @param options CORS와 SVG 처리 정책을 포함한 변환 옵션
 * @returns 로드가 끝난 HTMLImageElement
 * @throws {ImageProcessError} 지원하지 않는 입력이거나 변환에 실패한 경우
 */
export async function convertToImageElement(
  source: ImageSource,
  options?: ProcessorOptions
): Promise<HTMLImageElement> {
  // 공개 시그니처는 ProcessorOptions를 유지하고, 내부 전달 시 한 번만 좁혀 사용한다.
  const internalOptions = options as InternalSourceConverterOptions | undefined;
  try {
    const sourceType = await detectSourceTypeAsync(source, internalOptions?.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES);

    if (sourceType === 'element') {
      // 로드 완료 판정과 핸들러 해제는 디코드 모듈이 소유한다.
      return decodeExistingImage(source as HTMLImageElement, {
        errorCode: 'SOURCE_LOAD_FAILED',
        message: 'Failed to load HTMLImageElement',
      });
    }

    if (sourceType === 'canvas') {
      return convertCanvasToElement(source as HTMLCanvasElement);
    }

    if (sourceType === 'blob' || sourceType === 'svg-blob') {
      return convertBlobToElement(source as Blob, sourceType, internalOptions);
    }

    if (sourceType === 'arrayBuffer') {
      const buffer = source as ArrayBuffer;
      const mimeType = detectMimeTypeFromBuffer(buffer);
      const blob = new Blob([buffer], { type: mimeType });
      return convertDetectedBlobToElement(blob, internalOptions);
    }

    if (sourceType === 'uint8Array') {
      // view가 가리키는 바이트 구간만 독립 ArrayBuffer로 복사한다.
      const bytes = source as Uint8Array;
      const arrayBuffer =
        bytes.buffer instanceof ArrayBuffer
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : bytes.slice().buffer;
      const mimeType = detectMimeTypeFromBuffer(arrayBuffer);
      const blob = new Blob([arrayBuffer], { type: mimeType });
      return convertDetectedBlobToElement(blob, internalOptions);
    }

    if (typeof source === 'string') {
      return convertStringToElement(source, sourceType, internalOptions);
    }

    throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
  } catch (error) {
    if (error instanceof ImageProcessError) {
      throw error;
    }

    throw new ImageProcessError('Unknown error occurred during source conversion', 'SOURCE_LOAD_FAILED', {
      cause: error,
    });
  }
}

/** MIME 판정으로 만든 내부 Blob을 최종 판정한 뒤 해당 로더로 전달한다. */
async function convertDetectedBlobToElement(
  blob: Blob,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  const maxSourceBytes = options?.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const sourceType = await detectSourceTypeAsync(blob, maxSourceBytes);
  return convertBlobToElement(blob, sourceType as Extract<SourceType, 'blob' | 'svg-blob'>, options);
}

/**
 * Get size information of image source
 *
 * @description Extract actual size information from various image sources.
 * @param source Image source to get size information from
 * @returns Width and height information of the image
 */
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
