/**
 * ensure* 보장 변환 함수.
 *
 * @description 입력을 Blob/Data URL/File로 보장한다.
 * 원본을 그대로 통과시킬 수 있으면 재인코딩을 회피하고, 옵션 변경이 필요할 때만 Canvas 경로를 거친다.
 */

import { convertToImageElement } from '../../core/source-converter/index';
import type { ImageSource, ResultBlob, ResultDataURL, ResultFile } from '../../types';
import { ImageProcessError } from '../../types';
import { BlobResultImpl, DataURLResultImpl, FileResultImpl } from '../../types/result-implementations.internal';
import { isDataURLString } from '../data-url';
import { canvasToBlob, canvasToDataURL, getBlobDimensions, withImageElementCanvas } from './canvas-bridge.internal';
import {
  getBlobReencodeOptions,
  getFinalFilename,
  isFileSource,
  shouldReencodeBlob,
  shouldReuseFile,
} from './policy.internal';
import type {
  EnsureBlobDetailedOptions,
  EnsureBlobOptions,
  EnsureDataURLDetailedOptions,
  EnsureDataURLOptions,
  EnsureFileDetailedOptions,
  EnsureFileOptions,
} from './types';

/**
 * `resolveBlob()`의 반환 형태.
 *
 * @description `reused`는 원본 Blob을 재인코딩 없이 그대로 통과시킨 경우다 — 이 경로는
 * 원래 치수 조회조차 하지 않으므로 `blob`만 담는다. 호출자가 치수가 필요하면
 * (`ensureBlobDetailed`) 그때 가서 직접 `getBlobDimensions()`를 부른다 — plain `ensureBlob()`의
 * "재인코딩 없는 fast path에서는 추가 디코드도 없다"는 성질을 core 공유 후에도 잃지 않기 위함이다.
 */
type ResolvedBlob =
  | { kind: 'reused'; blob: Blob }
  | { kind: 'encoded'; blob: Blob; width: number; height: number; original?: { width: number; height: number } };

/**
 * `ensureBlob`/`ensureBlobDetailed`가 공유하는 3분기 판정 core.
 *
 * @description Canvas 소스 / 재인코딩 불필요한 Blob / 그 외(Canvas 경로 재인코딩) 3분기를
 * 한 곳에서만 판정한다. 치수·원본 크기 계산이 필요 없는 분기(재사용 Blob)는 계산을 하지 않고
 * `reused`로 표시만 해, plain 경로의 성능 특성을 그대로 보존한다.
 */
async function resolveBlob(source: ImageSource | HTMLCanvasElement, options: EnsureBlobOptions): Promise<ResolvedBlob> {
  if (source instanceof HTMLCanvasElement) {
    const blob = await canvasToBlob(source, options);
    return { kind: 'encoded', blob, width: source.width, height: source.height };
  }

  if (source instanceof Blob && !shouldReencodeBlob(source, options)) {
    return { kind: 'reused', blob: source };
  }

  const imageElement = await convertToImageElement(source);
  const outputOptions = source instanceof Blob ? getBlobReencodeOptions(source, options) : options;
  const encoded = await withImageElementCanvas(imageElement, async (canvas) => ({
    blob: await canvasToBlob(canvas, outputOptions),
    width: canvas.width,
    height: canvas.height,
  }));

  return {
    kind: 'encoded',
    blob: encoded.blob,
    width: encoded.width,
    height: encoded.height,
    original: { width: imageElement.width, height: imageElement.height },
  };
}

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
    const resolved = await resolveBlob(source, options);
    return resolved.blob;
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Blob output', 'CONVERSION_FAILED', { cause: error });
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
    const resolved = await resolveBlob(source, options);

    if (resolved.kind === 'reused') {
      const { width, height } = await getBlobDimensions(resolved.blob);
      return new BlobResultImpl(resolved.blob, width, height, Date.now() - startTime);
    }

    return new BlobResultImpl(
      resolved.blob,
      resolved.width,
      resolved.height,
      Date.now() - startTime,
      resolved.original
    );
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Blob output', 'CONVERSION_FAILED', { cause: error });
  }
}

/**
 * `resolveDataURL()`의 반환 형태. `resolveBlob()`과 같은 이유로 `reused`/`encoded`를 나눈다 —
 * 이미 Data URL 문자열인 입력은 원래 치수 조회를 위한 `convertToImageElement()` 디코드 없이
 * 그대로 통과했으므로, plain `ensureDataURL()`의 fast path에서는 그 디코드가 여전히 없어야 한다.
 */
type ResolvedDataURL =
  | { kind: 'reused'; dataURL: string }
  | { kind: 'encoded'; dataURL: string; width: number; height: number; original?: { width: number; height: number } };

/**
 * `ensureDataURL`/`ensureDataURLDetailed`가 공유하는 3분기 판정 core.
 */
async function resolveDataURL(
  source: ImageSource | HTMLCanvasElement,
  options: EnsureDataURLOptions
): Promise<ResolvedDataURL> {
  if (isDataURLString(source)) {
    return { kind: 'reused', dataURL: source };
  }

  if (source instanceof HTMLCanvasElement) {
    const dataURL = canvasToDataURL(source, options);
    return { kind: 'encoded', dataURL, width: source.width, height: source.height };
  }

  const imageElement = await convertToImageElement(source);
  const encoded = await withImageElementCanvas(imageElement, (canvas) => ({
    dataURL: canvasToDataURL(canvas, options),
    width: canvas.width,
    height: canvas.height,
  }));

  return {
    kind: 'encoded',
    dataURL: encoded.dataURL,
    width: encoded.width,
    height: encoded.height,
    original: { width: imageElement.width, height: imageElement.height },
  };
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
    const resolved = await resolveDataURL(source, options);
    return resolved.dataURL;
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Data URL output', 'CONVERSION_FAILED', { cause: error });
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
    const resolved = await resolveDataURL(source, options);

    if (resolved.kind === 'reused') {
      const imageElement = await convertToImageElement(resolved.dataURL);
      return new DataURLResultImpl(resolved.dataURL, imageElement.width, imageElement.height, Date.now() - startTime);
    }

    return new DataURLResultImpl(
      resolved.dataURL,
      resolved.width,
      resolved.height,
      Date.now() - startTime,
      resolved.original
    );
  } catch (error) {
    throw new ImageProcessError('Error occurred while ensuring Data URL output', 'CONVERSION_FAILED', { cause: error });
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
    throw new ImageProcessError('Error occurred while ensuring File output', 'CONVERSION_FAILED', { cause: error });
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
    throw new ImageProcessError('Error occurred while ensuring File output', 'CONVERSION_FAILED', { cause: error });
  }
}
