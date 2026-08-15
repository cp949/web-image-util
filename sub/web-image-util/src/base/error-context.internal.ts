/**
 * 에러 문맥 타입 leaf.
 *
 * base/error-helpers의 createImageError()가 개발 모드 메시지에 붙이는
 * 문맥 정보 타입이다 — 배럴로 공개되지 않는 내부 전용 타입이다.
 */

/**
 * Error context information
 */
export interface ErrorContext {
  /** Source type being processed */
  sourceType?: string;
  /** Format attempted */
  format?: string;
  /** Image size information */
  dimensions?: { width: number; height: number };
  /** Browser information */
  userAgent?: string;
  /** Timestamp */
  timestamp?: number;
  /** Additional debug information */
  debug?: Record<string, unknown>;
}
