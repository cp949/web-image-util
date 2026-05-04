/**
 * Blob 메타데이터 기반 포맷 추정과 SVG sniffing.
 *
 * MIME과 파일명만으로 결정 가능한 경우는 메타데이터 단계에서 종결하고,
 * 모호할 때만 본문 앞부분을 읽어 SVG 여부를 확인한다.
 */

import type { ImageFormat } from '../../types';
import { mimeTypeToImageFormat } from '../format-utils';
import { isInlineSvg } from '../svg-detection';
import { isXmlMimeType, normalizeMimeType } from './mime';
import { getFormatFromPath } from './path';
import { canReadBlobText } from './type-guards';

/** SVG sniffing에 읽을 기본 바이트 수. */
export const DEFAULT_SVG_SNIFF_BYTES = 4096;

/** Blob의 MIME과 파일명에서 ImageFormat을 추정한다. */
export function getBlobMetadataFormat(blob: Blob, mimeType: string): ImageFormat | 'unknown' {
  const mimeFormat = mimeType ? mimeTypeToImageFormat(mimeType) : 'unknown';

  if (mimeFormat !== 'unknown') {
    return mimeFormat;
  }

  return typeof (blob as File).name === 'string' ? getFormatFromPath((blob as File).name) : 'unknown';
}

/** Blob 메타데이터만으로 SVG임이 확정되는지 판정한다. */
export function isSvgBlobByMetadata(blob: Blob): boolean {
  return getBlobMetadataFormat(blob, normalizeMimeType(blob.type)) === 'svg';
}

/** Blob 본문을 읽어 SVG 여부를 추가 검사할 가치가 있는지 결정한다. */
export function shouldSniffBlobForSvg(blob: Blob, mimeType: string): boolean {
  if (!canReadBlobText(blob)) {
    return false;
  }

  return (
    mimeType === '' || mimeType === 'application/octet-stream' || mimeType === 'text/plain' || isXmlMimeType(mimeType)
  );
}

/** Blob 앞부분을 텍스트로 읽어 인라인 SVG 시그니처가 있는지 검사한다. */
export async function sniffSvgFromBlob(blob: Blob, bytes: number): Promise<boolean> {
  try {
    return isInlineSvg(await blob.slice(0, Math.max(0, bytes)).text());
  } catch {
    return false;
  }
}
