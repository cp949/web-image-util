/**
 * 문자열·Blob 이미지 소스에서 소비자 정책과 무관한 기초 사실을 추출한다.
 *
 * 내부 라우팅과 공개 진단은 이 module의 결과를 각자의 결과 타입으로 투영한다.
 */

import type { ImageFormat } from '../../types';
import { isDataURLString, isSvgDataURL, parseDataURLMimeType } from '../data-url';
import { mimeTypeToImageFormat } from '../format-utils';
import { DEFAULT_SVG_SNIFF_BYTES, isInlineSvg, sniffSvgFromBlob } from '../svg-detection';
import { isXmlMimeType, normalizeMimeType } from './mime.internal';
import { getFormatFromFileName, getFormatFromPath } from './path.internal';
import { canReadBlobText } from './type-guards.internal';

// 정본은 svg-detection.ts가 소유한다 — 실제로 스니핑을 수행하는 sniffSvgFromBlob이
// 자기 기본 파라미터로 이 값을 쓰므로, 상수도 같은 곳에 있어야 리터럴이 다시 갈리지 않는다.
export { DEFAULT_SVG_SNIFF_BYTES };

/** 문자열 입력의 전송 형태와 포맷 힌트다. */
export interface StringSourceFacts {
  transport: 'inline' | 'data-url' | 'http' | 'protocol-relative' | 'blob-url' | 'path';
  formatHint: ImageFormat | 'unknown';
  mimeType?: string;
}

/** Blob 메타데이터에서 얻은 독립적인 MIME·파일명 포맷 증거다. */
export interface BlobSourceFacts {
  normalizedMimeType: string;
  mimeFormat: ImageFormat | 'unknown';
  fileNameFormat: ImageFormat | 'unknown';
}

/** 외부 읽기 없이 문자열 이미지 소스의 기초 사실을 판정한다. */
export function classifyStringSource(source: string): StringSourceFacts {
  const trimmed = source.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (isInlineSvg(trimmed)) {
    return { transport: 'inline', formatHint: 'svg' };
  }

  if (isSvgDataURL(trimmed)) {
    return { transport: 'data-url', formatHint: 'svg', mimeType: parseDataURLMimeType(trimmed) ?? undefined };
  }

  if (isDataURLString(trimmed)) {
    const mimeType = parseDataURLMimeType(trimmed) ?? undefined;
    return {
      transport: 'data-url',
      formatHint: mimeType ? mimeTypeToImageFormat(mimeType) : 'unknown',
      ...(mimeType ? { mimeType } : {}),
    };
  }

  if (lowerTrimmed.startsWith('http://') || lowerTrimmed.startsWith('https://')) {
    return { transport: 'http', formatHint: getFormatFromPath(trimmed) };
  }

  if (trimmed.startsWith('//')) {
    return { transport: 'protocol-relative', formatHint: getFormatFromPath(trimmed) };
  }

  if (lowerTrimmed.startsWith('blob:')) {
    return { transport: 'blob-url', formatHint: 'unknown' };
  }

  return { transport: 'path', formatHint: getFormatFromPath(trimmed) };
}

/** 본문을 읽지 않고 Blob의 MIME과 File.name 포맷을 각각 판정한다. */
export function inspectBlobMetadata(blob: Blob): BlobSourceFacts {
  const normalizedMimeType = normalizeMimeType(blob.type);
  const fileName = (blob as File).name;

  return {
    normalizedMimeType,
    mimeFormat: normalizedMimeType ? mimeTypeToImageFormat(normalizedMimeType) : 'unknown',
    fileNameFormat: typeof fileName === 'string' ? getFormatFromFileName(fileName) : 'unknown',
  };
}

/** MIME 정책상 가치가 있는 Blob만 앞부분을 읽어 SVG 루트를 확인한다. */
export async function sniffBlobSvgIfCandidate(
  blob: Blob,
  facts: BlobSourceFacts,
  sniffBytes = DEFAULT_SVG_SNIFF_BYTES
): Promise<boolean> {
  if (!canReadBlobText(blob)) {
    return false;
  }

  const mimeType = facts.normalizedMimeType;
  const shouldSniff =
    mimeType === '' || mimeType === 'application/octet-stream' || mimeType === 'text/plain' || isXmlMimeType(mimeType);

  return shouldSniff ? sniffSvgFromBlob(blob, sniffBytes) : false;
}
