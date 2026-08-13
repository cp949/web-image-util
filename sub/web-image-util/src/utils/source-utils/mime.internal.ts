/**
 * MIME 타입 정규화 헬퍼.
 *
 * Data URL 판정·헤더 파싱은 `utils/data-url` leaf가 담당한다.
 */

/** MIME 타입을 소문자/공백 제거한 정규형으로 변환한다. */
export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

/** 표준 XML, legacy external parsed entity, `*+xml` MIME 타입인지 판정한다. */
export function isXmlMimeType(mimeType: string): boolean {
  return (
    mimeType === 'text/xml' ||
    mimeType === 'application/xml' ||
    mimeType === 'text/xml-external-parsed-entity' ||
    mimeType === 'application/xml-external-parsed-entity' ||
    mimeType.endsWith('+xml')
  );
}
