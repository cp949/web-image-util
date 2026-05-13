/**
 * inspect-svg-source 테스트 공용 헬퍼.
 *
 * - 원본 `inspect-svg-source.test.ts`에서 여러 파일로 분리되며 반복되는 헬퍼만 모은다.
 * - sentinel/fixture는 누출 의도가 fixture 자체로 드러나야 하므로 각 테스트 파일에 둔다.
 */

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
