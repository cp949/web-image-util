/**
 * 경로/URL 문자열에서 이미지 포맷을 추정하는 헬퍼.
 *
 * 원격 fetch 없이 확장자만 본다. URL이 파싱 불가하면 쿼리/해시 제거 후 직접 추출한다.
 */

import type { ImageFormat } from '../../types';

/** 확장자 → ImageFormat 매핑. */
const IMAGE_FORMAT_BY_EXTENSION: Record<string, ImageFormat> = {
  avif: 'avif',
  gif: 'gif',
  jpeg: 'jpeg',
  jpg: 'jpg',
  png: 'png',
  svg: 'svg',
  webp: 'webp',
};

/** 경로 또는 URL 문자열의 마지막 확장자를 ImageFormat으로 매핑한다. */
export function getFormatFromPath(source: string): ImageFormat | 'unknown' {
  return getFormatFromExtension(getPathnameWithoutSuffix(source));
}

/** File.name의 마지막 확장자를 ImageFormat으로 매핑한다. */
export function getFormatFromFileName(name: string): ImageFormat | 'unknown' {
  // 파일명은 URL이 아니므로 `http:photo.png` 같은 합법적인 이름을 스킴으로 해석하지 않는다.
  return getFormatFromExtension(name.split('#', 1)[0]?.split('?', 1)[0] ?? name);
}

/** 정규화된 경로 또는 파일명의 확장자를 공통 포맷 테이블에서 찾는다. */
function getFormatFromExtension(source: string): ImageFormat | 'unknown' {
  const extension = source.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

  return extension ? (IMAGE_FORMAT_BY_EXTENSION[extension] ?? 'unknown') : 'unknown';
}

/** 쿼리/해시를 제외한 pathname을 반환한다. URL 파싱이 실패하면 원본을 정리해 반환한다. */
export function getPathnameWithoutSuffix(source: string): string {
  try {
    const url = source.startsWith('//') ? new URL(source, 'https://example.local') : new URL(source);
    return url.pathname;
  } catch {
    return source.split('#', 1)[0]?.split('?', 1)[0] ?? source;
  }
}
