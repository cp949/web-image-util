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

/**
 * File.name의 마지막 확장자를 ImageFormat으로 매핑한다.
 *
 * @description 파일명은 URL이 아니므로 `http:photo.png` 같은 합법적인 이름을 스킴으로
 * 해석하지 않는다. `#`와 `?`도 파일명에 쓸 수 있는 문자라서 먼저 이름 전체를 그대로 본다.
 * 다만 URL에서 파생된 이름(`photo.png?v=1`)이 File.name으로 들어오는 경우가 있어,
 * 전체 이름에서 확장자를 못 찾으면 쿼리·해시를 걷어내고 한 번 더 시도한다.
 *
 * SVG는 `formatFromBytes`에 시그니처가 없어 이름 판정이 최종 답이 된다. 여기서 놓치면
 * 바이트 폴백이 복구하지 못한다.
 */
export function getFormatFromFileName(name: string): ImageFormat | 'unknown' {
  const literal = getFormatFromExtension(name);
  if (literal !== 'unknown') {
    return literal;
  }

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
