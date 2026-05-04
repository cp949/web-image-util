/**
 * MIME 타입과 data URL 헤더 파싱 헬퍼.
 *
 * 본문(payload)을 디코딩하지 않고 헤더 문자열만 다룬다.
 */

/** 소스가 `data:image/svg+xml` 계열 data URL인지 판정한다. */
export function isSvgDataUrl(source: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(source);
}

/**
 * data URL의 첫 MIME 타입 토큰을 추출해 정규화된 형태로 반환한다.
 *
 * 헤더의 파라미터(`;charset=...` 등)와 base64 마커는 제외한다.
 */
export function parseDataUrlMimeType(source: string): string | undefined {
  if (!source.toLowerCase().startsWith('data:')) {
    return undefined;
  }

  const commaIndex = source.indexOf(',');
  const header = source.slice(5, commaIndex >= 0 ? commaIndex : undefined);
  const mimeType = normalizeMimeType(header.split(';', 1)[0] ?? '');

  return mimeType || undefined;
}

/** MIME 타입을 소문자/공백 제거한 정규형으로 변환한다. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

/** XML 계열 MIME 타입(`text/xml`, `application/xml`, `*+xml`)인지 판정한다. */
export function isXmlMimeType(mimeType: string): boolean {
  return mimeType === 'text/xml' || mimeType === 'application/xml' || mimeType.endsWith('+xml');
}
