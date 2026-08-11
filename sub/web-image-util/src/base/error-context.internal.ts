/**
 * 에러 문맥 타입 leaf.
 *
 * base/error-helpers(문맥 소비)와 base/error-handler(문맥 수집)가 공유하는
 * 타입의 정의 지점이다 — 배럴로 공개되지 않는 내부 전용 타입이다.
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
