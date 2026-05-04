/**
 * 입력 소스의 형태를 판별해 변환 경로를 라우팅하는 모듈이다.
 */

import type { ImageSource } from '../../types';
import { ImageProcessError } from '../../types';
import { isInlineSvg } from '../../utils/svg-detection';
import { isDataUrlSvg } from './svg/data-url';
import { isProtocolRelativeUrl, isSvgResourcePath } from './url/policy';

/** 지원하는 이미지 입력 소스 타입이다. */
export type SourceType =
  | 'element'
  | 'canvas'
  | 'blob'
  | 'arrayBuffer'
  | 'uint8Array'
  | 'svg'
  | 'dataurl'
  | 'url'
  | 'bloburl'
  | 'path';

/**
 * 입력값의 실제 형태를 판별해 적절한 변환 경로로 라우팅한다.
 *
 * 문자열 입력은 Data URL, 인라인 SVG, HTTP URL, Blob URL, 파일 경로 순으로 확인하고,
 * 객체 입력은 `instanceof`와 덕 타이핑을 함께 사용해 브라우저 호환성을 확보한다.
 *
 * @param source 분석할 이미지 입력
 * @returns 후속 처리 파이프라인에 사용할 소스 타입
 * @throws {ImageProcessError} 지원하지 않는 입력이면
 */
export function detectSourceType(source: ImageSource): SourceType {
  if (source instanceof HTMLImageElement) {
    return 'element';
  }

  // Detect HTMLCanvasElement
  if (
    source instanceof HTMLCanvasElement ||
    (source &&
      typeof source === 'object' &&
      'getContext' in source &&
      'toDataURL' in source &&
      typeof (source as any).getContext === 'function')
  ) {
    return 'canvas';
  }

  // Detect Blob - use both instanceof and duck typing
  if (
    source instanceof Blob ||
    (source &&
      typeof source === 'object' &&
      'type' in source &&
      'size' in source &&
      ('slice' in source || 'arrayBuffer' in source))
  ) {
    // Detect SVG file
    if (source.type === 'image/svg+xml' || (source as File).name?.endsWith('.svg')) {
      return 'svg';
    }
    return 'blob';
  }

  if (source instanceof ArrayBuffer) {
    return 'arrayBuffer';
  }

  if (source instanceof Uint8Array) {
    return 'uint8Array';
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // Detect Data URL SVG (priority - check before general Data URL)
    if (isDataUrlSvg(trimmed)) {
      return 'svg';
    }

    // Detect inline SVG XML (accurate check)
    if (isInlineSvg(trimmed)) {
      return 'svg';
    }

    // Detect other Data URLs
    if (trimmed.startsWith('data:')) {
      return 'dataurl';
    }

    // Detect HTTP/HTTPS URLs
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // 실제 MIME 판정은 로딩 시점에 수행하고, 여기서는 확장자만 힌트로 사용한다.
      if (isSvgResourcePath(trimmed)) {
        return 'svg';
      }
      return 'url';
    }

    // Detect protocol-relative URLs
    if (isProtocolRelativeUrl(trimmed)) {
      if (isSvgResourcePath(trimmed)) {
        return 'svg';
      }
      return 'url';
    }

    // Detect Blob URL (URL created by createObjectURL)
    if (trimmed.startsWith('blob:')) {
      return 'bloburl';
    }

    // File path - check SVG extension
    if (isSvgResourcePath(trimmed)) {
      return 'svg';
    }

    // Treat the rest as file paths
    return 'path';
  }

  throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
}
