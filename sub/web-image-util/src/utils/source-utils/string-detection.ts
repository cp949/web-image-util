/**
 * 문자열 이미지 소스의 타입과 상세 정보를 판정한다.
 *
 * 외부 리소스를 로드하거나 data URL 본문을 디코딩하지 않는다.
 */

import { mimeTypeToImageFormat } from '../format-utils';
import { isInlineSvg } from '../svg-detection';
import { isSvgDataUrl, parseDataUrlMimeType } from './mime';
import { getFormatFromPath } from './path';
import type { ImageStringSourceInfo, ImageStringSourceType } from './types';

/**
 * 문자열 이미지 소스의 경량 타입을 판정한다.
 *
 * 외부 리소스를 로드하거나 Data URL 본문을 디코딩하지 않고 문자열 형태만 확인한다.
 */
export function detectImageStringSourceType(source: string): ImageStringSourceType {
  const trimmed = source.trim();
  const lowerTrimmed = trimmed.toLowerCase();

  if (isInlineSvg(trimmed)) {
    return 'inline-svg';
  }

  if (isSvgDataUrl(trimmed)) {
    return 'svg-data-url';
  }

  if (lowerTrimmed.startsWith('data:')) {
    return 'data-url';
  }

  if (lowerTrimmed.startsWith('http://') || lowerTrimmed.startsWith('https://')) {
    return 'http-url';
  }

  if (trimmed.startsWith('//')) {
    return 'protocol-relative-url';
  }

  if (lowerTrimmed.startsWith('blob:')) {
    return 'blob-url';
  }

  if (getFormatFromPath(trimmed) === 'svg') {
    return 'svg-path';
  }

  return 'path';
}

/**
 * 문자열 이미지 소스의 상세 정보를 동기적으로 판정한다.
 *
 * URL은 fetch하지 않고, Data URL은 헤더만 파싱한다.
 */
export function detectImageStringSourceInfo(source: string): ImageStringSourceInfo {
  const type = detectImageStringSourceType(source);
  const trimmed = source.trim();
  const mimeType = parseDataUrlMimeType(trimmed);
  const isDataUrl = type === 'data-url' || type === 'svg-data-url';
  const isBlobUrl = type === 'blob-url';
  const isUrl = type === 'http-url' || type === 'protocol-relative-url';
  const dataUrlFormat = isDataUrl && mimeType ? mimeTypeToImageFormat(mimeType) : 'unknown';
  const canInferPathFormat = type === 'path' || type === 'svg-path' || isUrl;
  const pathFormat = canInferPathFormat ? getFormatFromPath(trimmed) : 'unknown';
  const format = dataUrlFormat !== 'unknown' ? dataUrlFormat : pathFormat;

  return {
    type,
    family: 'string',
    ...(mimeType ? { mimeType } : {}),
    format,
    isSvg: type === 'inline-svg' || type === 'svg-data-url' || format === 'svg',
    isUrl,
    isDataUrl,
    isBlobUrl,
  };
}
