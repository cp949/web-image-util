/**
 * 입력 소스의 형태를 판별해 변환 경로를 라우팅하는 모듈이다.
 *
 * 문자열 입력의 판정은 이 모듈이 단독으로 소유한다. 반환 union이 SVG 하위 유형까지 구분하므로
 * 문자열 로더는 같은 술어(`isSvgDataURL`, `isInlineSvg`, `isSvgResourcePath` 등)를
 * 다시 호출하지 않고 판정 결과만 보고 분기한다.
 *
 * Blob 입력은 아직 여기까지 오지 않았다 — `loaders/blob.internal.ts`가 `'svg-blob'` 판정을
 * 쓰지 않고 MIME/파일명/본문 스니핑을 자체적으로 다시 수행한다.
 */

import type { ImageSource } from '../../types';
import { ImageProcessError } from '../../types';
import { isDataURLString, isSvgDataURL } from '../../utils/data-url';
import { isInlineSvg } from '../../utils/svg-detection';
import { isProtocolRelativeUrl, isSvgResourcePath } from './url/policy.internal';

/**
 * 문자열 입력의 판정 결과다.
 *
 * SVG는 형태마다 처리 경로(즉시 렌더 / Data URL 복원 / fetch 검증)가 달라서
 * 단일 `'svg'`로 뭉치지 않고 하위 유형까지 구분한다.
 */
export type StringSourceType =
  /** 인라인 SVG XML 문자열 */
  | 'svg-inline'
  /** `image/svg+xml` Data URL */
  | 'svg-datauri'
  /** http(s) 또는 protocol-relative URL이 가리키는 `.svg` 리소스 */
  | 'svg-url'
  /** 스킴 없는 경로가 가리키는 `.svg` 리소스 */
  | 'svg-path'
  /** SVG가 아닌 Data URL */
  | 'dataurl'
  /** SVG가 아닌 http(s) 또는 protocol-relative URL */
  | 'url'
  /** `URL.createObjectURL`로 만든 Blob URL */
  | 'bloburl'
  /** 그 외 파일 경로 */
  | 'path';

/** 지원하는 이미지 입력 소스 타입이다. */
export type SourceType = 'element' | 'canvas' | 'blob' | 'svg-blob' | 'arrayBuffer' | 'uint8Array' | StringSourceType;

/**
 * SVG 전용 처리 경로로 보내야 하는 판정 결과인지 확인한다.
 *
 * @param type 판정 결과
 * @returns SVG 계열이면 true
 */
export function isSvgSourceType(type: SourceType): boolean {
  return (
    type === 'svg-inline' || type === 'svg-datauri' || type === 'svg-url' || type === 'svg-path' || type === 'svg-blob'
  );
}

/**
 * 문자열 입력의 형태를 판별한다.
 *
 * SVG Data URL, 인라인 SVG, 일반 Data URL, HTTP URL, protocol-relative URL,
 * Blob URL, 파일 경로 순으로 확인한다. 원격 리소스를 읽지 않는 동기 판정이다.
 *
 * @param source 분석할 문자열 입력
 * @returns 문자열 소스 타입
 */
export function detectStringSourceType(source: string): StringSourceType {
  const trimmed = source.trim();

  // 일반 Data URL보다 SVG Data URL을 먼저 판정한다.
  if (isSvgDataURL(trimmed)) {
    return 'svg-datauri';
  }

  // 인라인 SVG XML 본문인지 확인한다.
  if (isInlineSvg(trimmed)) {
    return 'svg-inline';
  }

  // SVG가 아닌 Data URL을 판정한다.
  if (isDataURLString(trimmed)) {
    return 'dataurl';
  }

  // HTTP/HTTPS URL을 판정한다.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // 실제 MIME 판정은 로딩 시점에 수행하고, 여기서는 확장자만 힌트로 사용한다.
    return isSvgResourcePath(trimmed) ? 'svg-url' : 'url';
  }

  // protocol-relative URL을 판정한다.
  if (isProtocolRelativeUrl(trimmed)) {
    return isSvgResourcePath(trimmed) ? 'svg-url' : 'url';
  }

  // createObjectURL로 만든 Blob URL을 판정한다.
  if (trimmed.startsWith('blob:')) {
    return 'bloburl';
  }

  // 파일 경로의 SVG 확장자를 확인한다.
  if (isSvgResourcePath(trimmed)) {
    return 'svg-path';
  }

  // 나머지 문자열은 일반 파일 경로로 처리한다.
  return 'path';
}

/**
 * 입력값의 실제 형태를 판별해 적절한 변환 경로로 라우팅한다.
 *
 * 문자열 입력은 {@link detectStringSourceType}에 위임하고,
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
      return 'svg-blob';
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
    return detectStringSourceType(source);
  }

  throw new ImageProcessError(`Unsupported source type: ${typeof source}`, 'INVALID_SOURCE');
}
