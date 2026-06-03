/**
 * 현재 실행 환경을 감지한다. inspectSvg / prefixSvgIds와 동일 규칙을 인라인으로 둔다(D12).
 * 평가 순서: happyDOM → browser → node → unknown.
 */
export function detectInspectSourceEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
  if ((globalThis as unknown as Record<string, unknown>).happyDOM != null) {
    return 'happy-dom';
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof DOMParser !== 'undefined') {
    return 'browser';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  return 'unknown';
}
