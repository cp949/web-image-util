/**
 * prefix-svg-ids 테스트 공용 헬퍼.
 *
 * - 원본 `prefix-svg-ids.test.ts`에서 여러 파일로 분리되며 반복되는 헬퍼만 모은다.
 * - 누출 방지 sentinel/`dangerousSvg`처럼 보안 의도가 fixture 자체에 드러나는 값은
 *   각 테스트 파일 안에 두고 여기에 넣지 않는다.
 */

/** 결과 svg를 DOMParser로 재파싱해 id 목록을 반환한다. */
export function extractIds(svgString: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const all = doc.getElementsByTagName('*');
  const ids: string[] = [];
  for (let i = 0; i < all.length; i++) {
    const id = all[i].getAttribute('id');
    if (id !== null && id !== '') ids.push(id);
  }
  return ids;
}

/** report 객체의 모든 string 값을 재귀 순회해 수집한다. */
export function collectReportStrings(obj: unknown, results: string[] = []): string[] {
  if (typeof obj === 'string') {
    results.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      collectReportStrings(item, results);
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      collectReportStrings(value, results);
    }
  }
  return results;
}
