export type SvgInspectionEnvironment = 'browser' | 'happy-dom' | 'node' | 'unknown';

/**
 * SVG 검사 API가 실행 중인 환경을 감지한다.
 * happy-dom은 window/document를 함께 제공하므로 browser보다 먼저 판정한다.
 */
export function detectSvgInspectionEnvironment(): SvgInspectionEnvironment {
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
