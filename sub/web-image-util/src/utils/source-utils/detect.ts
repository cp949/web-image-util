/**
 * 문자열/엘리먼트/Blob/Binary 모든 소스 종류에 대한 통합 판정.
 *
 * 동기 판정은 메타데이터까지만 보고, 비동기 판정은 필요 시 Blob 앞부분을 읽어 SVG 여부를 보강한다.
 */

import type { ImageFormat, ImageSource } from '../../types';
import {
  DEFAULT_SVG_SNIFF_BYTES,
  getBlobMetadataFormat,
  isSvgBlobByMetadata,
  shouldSniffBlobForSvg,
  sniffSvgFromBlob,
} from './blob-sniff';
import { normalizeMimeType } from './mime';
import { detectImageStringSourceInfo, detectImageStringSourceType } from './string-detection';
import { isBlobSource, isCanvasElementSource, isImageElementSource } from './type-guards';
import type { DetectImageSourceInfoOptions, ImageSourceInfo, ImageSourceType, ImageStringSourceType } from './types';

/**
 * 이미지 소스의 경량 타입을 판정한다.
 *
 * Blob 본문, 원격 URL, 파일 경로를 읽지 않는 동기 판정 함수다.
 */
export function detectImageSourceType(source: ImageSource): ImageSourceType {
  if (typeof source === 'string') {
    return detectImageStringSourceType(source);
  }

  if (isImageElementSource(source)) {
    return 'element';
  }

  if (isCanvasElementSource(source)) {
    return 'canvas';
  }

  if (isBlobSource(source)) {
    return isSvgBlobByMetadata(source) ? 'svg-blob' : 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'array-buffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8-array';
  }

  return 'blob';
}

/**
 * 이미지 소스의 상세 정보를 판정한다.
 *
 * 원격 URL은 로드하지 않는다. Blob은 옵션이 허용할 때 앞부분만 읽어 SVG 여부를 보강한다.
 */
export async function detectImageSourceInfo(
  source: ImageSource,
  options: DetectImageSourceInfoOptions = {}
): Promise<ImageSourceInfo> {
  if (typeof source === 'string') {
    return detectImageStringSourceInfo(source);
  }

  if (isImageElementSource(source)) {
    return createNonStringSourceInfo('element', 'element', undefined, 'unknown', false);
  }

  if (isCanvasElementSource(source)) {
    return createNonStringSourceInfo('canvas', 'canvas', undefined, 'unknown', false);
  }

  if (isBlobSource(source)) {
    const mimeType = normalizeMimeType(source.type);
    const metadataFormat = getBlobMetadataFormat(source, mimeType);
    const shouldSniff = options.sniffSvgBlob ?? true;
    const sniffedSvg =
      shouldSniff && metadataFormat !== 'svg' && shouldSniffBlobForSvg(source, mimeType)
        ? await sniffSvgFromBlob(source, options.svgSniffBytes ?? DEFAULT_SVG_SNIFF_BYTES)
        : false;
    const isSvg = metadataFormat === 'svg' || sniffedSvg;
    const format = isSvg ? 'svg' : metadataFormat;

    return createNonStringSourceInfo(isSvg ? 'svg-blob' : 'blob', 'blob', mimeType || undefined, format, isSvg);
  }

  if (source instanceof ArrayBuffer) {
    return createNonStringSourceInfo('array-buffer', 'binary', undefined, 'unknown', false);
  }

  if (source instanceof Uint8Array) {
    return createNonStringSourceInfo('uint8-array', 'binary', undefined, 'unknown', false);
  }

  return createNonStringSourceInfo('blob', 'blob', undefined, 'unknown', false);
}

function createNonStringSourceInfo(
  type: Exclude<ImageSourceType, ImageStringSourceType>,
  family: 'element' | 'canvas' | 'blob' | 'binary',
  mimeType: string | undefined,
  format: ImageFormat | 'unknown',
  isSvg: boolean
): ImageSourceInfo {
  return {
    type,
    family,
    ...(mimeType ? { mimeType } : {}),
    format,
    isSvg,
    isUrl: false,
    isDataUrl: false,
    isBlobUrl: false,
  };
}
