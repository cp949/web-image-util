/**
 * ensure* 보장 변환 함수.
 *
 * @description 입력을 Blob/Data URL/File로 보장한다.
 * 원본을 그대로 통과시킬 수 있으면 재인코딩을 회피하고, 옵션 변경이 필요할 때만 Canvas 경로를 거친다.
 */

import { convertToImageElement } from '../../core/source-converter';
import type { ImageSource, ResultBlob, ResultDataURL, ResultFile } from '../../types';
import { ImageProcessError } from '../../types';
import { BlobResultImpl, DataURLResultImpl, FileResultImpl } from '../../types/result-implementations';
import { isDataURLString } from '../data-url';
import { canvasToBlob, canvasToDataURL, getBlobDimensions, imageElementToCanvas } from './canvas-bridge';
import { getBlobReencodeOptions, getFinalFilename, isFileSource, shouldReencodeBlob, shouldReuseFile } from './policy';
import type {
  EnsureBlobDetailedOptions,
  EnsureBlobOptions,
  EnsureDataURLDetailedOptions,
  EnsureDataURLOptions,
  EnsureFileDetailedOptions,
  EnsureFileOptions,
} from './types';

/**
 * 입력을 Blob으로 보장한다.
 *
 * @description 이미 Blob이고 출력 옵션 적용이 필요 없으면 원본을 반환한다.
 * 포맷 변경이나 품질 변경이 필요하면 Canvas 경로로 재인코딩한다.
 *
 * @param source 이미지 입력
 * @param options 출력 옵션
 * @returns Blob 객체
 */
export async function ensureBlob(
  source: ImageSource | HTMLCanvasElement,
  options: EnsureBlobOptions = {}
): Promise<Blob> {
  try {
    if (source instanceof HTMLCanvasElement) {
      return await canvasToBlob(source, options);
    }

    if (source instanceof Blob && !shouldReencodeBlob(source, options)) {
      return source;
    }

    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    const outputOptions = source instanceof Blob ? getBlobReencodeOptions(source, options) : options;
    return await canvasToBlob(canvas, outputOptions);
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Blob output', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 입력을 상세 메타데이터가 있는 Blob 결과로 보장한다.
 *
 * @param source 이미지 입력
 * @param options 출력 옵션
 * @returns Blob 결과 객체
 */
export async function ensureBlobDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: EnsureBlobDetailedOptions = {}
): Promise<ResultBlob> {
  const startTime = Date.now();

  try {
    if (source instanceof HTMLCanvasElement) {
      const blob = await canvasToBlob(source, options);
      return new BlobResultImpl(blob, source.width, source.height, Date.now() - startTime);
    }

    if (source instanceof Blob && !shouldReencodeBlob(source, options)) {
      const { width, height } = await getBlobDimensions(source);
      return new BlobResultImpl(source, width, height, Date.now() - startTime);
    }

    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    const outputOptions = source instanceof Blob ? getBlobReencodeOptions(source, options) : options;
    const blob = await canvasToBlob(canvas, outputOptions);

    return new BlobResultImpl(blob, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Blob output', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 입력을 Data URL로 보장한다.
 *
 * @description 이미 Data URL 문자열이면 원본을 그대로 반환한다.
 * 그 외 입력은 Canvas 경로로 인코딩해 출력 옵션을 적용한다.
 *
 * @param source 이미지 입력
 * @param options 출력 옵션
 * @returns Data URL 문자열
 */
export async function ensureDataURL(
  source: ImageSource | HTMLCanvasElement,
  options: EnsureDataURLOptions = {}
): Promise<string> {
  try {
    if (isDataURLString(source)) {
      return source;
    }

    if (source instanceof HTMLCanvasElement) {
      return canvasToDataURL(source, options);
    }

    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    return canvasToDataURL(canvas, options);
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Data URL output', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 입력을 상세 메타데이터가 있는 Data URL 결과로 보장한다.
 *
 * @param source 이미지 입력
 * @param options 출력 옵션
 * @returns Data URL 결과 객체
 */
export async function ensureDataURLDetailed(
  source: ImageSource | HTMLCanvasElement,
  options: EnsureDataURLDetailedOptions = {}
): Promise<ResultDataURL> {
  const startTime = Date.now();

  try {
    if (isDataURLString(source)) {
      const imageElement = await convertToImageElement(source);
      return new DataURLResultImpl(source, imageElement.width, imageElement.height, Date.now() - startTime);
    }

    if (source instanceof HTMLCanvasElement) {
      const dataURL = canvasToDataURL(source, options);
      return new DataURLResultImpl(dataURL, source.width, source.height, Date.now() - startTime);
    }

    const imageElement = await convertToImageElement(source);
    const canvas = await imageElementToCanvas(imageElement);
    const dataURL = canvasToDataURL(canvas, options);

    return new DataURLResultImpl(dataURL, canvas.width, canvas.height, Date.now() - startTime, {
      width: imageElement.width,
      height: imageElement.height,
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Data URL output', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 입력을 지정 파일명의 File로 보장한다.
 *
 * @param source 이미지 입력
 * @param filename 결과 파일명
 * @param options 출력 옵션
 * @returns File 객체
 */
export async function ensureFile(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: EnsureFileOptions = {}
): Promise<File> {
  try {
    if (isFileSource(source) && shouldReuseFile(source, filename, options)) {
      return source;
    }

    const blob = await ensureBlob(source, options);
    const finalFilename = getFinalFilename(filename, options);

    return new File([blob], finalFilename, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring File output', 'CONVERSION_FAILED', error as Error);
  }
}

/**
 * 입력을 상세 메타데이터가 있는 File 결과로 보장한다.
 *
 * @param source 이미지 입력
 * @param filename 결과 파일명
 * @param options 출력 옵션
 * @returns File 결과 객체
 */
export async function ensureFileDetailed(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options: EnsureFileDetailedOptions = {}
): Promise<ResultFile> {
  const startTime = Date.now();

  try {
    if (isFileSource(source) && shouldReuseFile(source, filename, options)) {
      const { width, height } = await getBlobDimensions(source);
      return new FileResultImpl(source, width, height, Date.now() - startTime);
    }

    const blobResult = await ensureBlobDetailed(source, options);
    const finalFilename = getFinalFilename(filename, options);
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
    throw new ImageProcessError('Error occurred while ensuring File output', 'CONVERSION_FAILED', error as Error);
  }
}
