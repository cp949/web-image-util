/**
 * SVG 소스 검사 스택의 타입 leaf.
 *
 * inspectSvgSource 공개 타입 9종의 정의 지점이다 — 파일 자체는 공개 경로가
 * 아니며, 공개는 `inspect-svg-source.ts`의 재export를 경유한다.
 */

import type { InspectSvgReport } from '../svg-inspection/types.internal';

/** SVG로 판정할 수 있는 입력 타입. HTMLImageElement / Canvas 등은 비-허용(D2). */
export type InspectSvgSourceInput = string | Blob | File | URL;

/** fetch 모드(D3). 기본 'never'. */
export type InspectSvgSourceFetchMode = 'never' | 'metadata' | 'body';

/**
 * source가 SVG로 판정됐는지 + 본문 도출 가능 여부.
 * - 'svg': MIME/extension/sniff 결과 SVG. 본문 도출 가능한 경우 svg 필드도 채움.
 * - 'not-svg-source': 입력 타입은 허용되지만 SVG가 아님.
 * - 'unknown': SVG 후보가 불명확 (예: text/plain MIME + body 미sniff).
 */
export type InspectSvgSourceKind = 'svg' | 'not-svg-source' | 'unknown';

/** source 단계 finding 코드(단일 출처). RM-001 finding code와 별도 namespace. */
export type InspectSvgSourceFindingCode =
  | 'source-kind-unsupported'
  | 'mime-mismatch'
  | 'extension-mismatch'
  | 'byte-limit-exceeded'
  | 'data-url-decode-failed'
  | 'fetch-disabled-by-option'
  | 'fetch-blocked-policy'
  | 'fetch-protocol-disallowed'
  | 'fetch-aborted'
  | 'fetch-timeout'
  | 'fetch-failed'
  | 'fetch-status-error'
  | 'body-consumed-once';

export interface InspectSvgSourceFinding {
  code: InspectSvgSourceFindingCode;
  /** 영어 자연문. 호출자 분기 대상이 아니며 patch에서도 다듬을 수 있다. */
  message: string;
  /** 호출자 분기용 구조화 컨텍스트. 원본 URL/Data URL 본문/Blob 내용은 담지 않는다. */
  details?: Record<string, unknown>;
}

export interface InspectSvgSourceMeta {
  originalKind: 'string' | 'data-url' | 'url-string' | 'blob' | 'file';
  /** 입력의 MIME 타입(Blob/File / Data URL에서 추출). 알 수 없으면 null. */
  mime: string | null;
  /** URL/파일명에서 추출한 확장자(소문자, '.svg'는 'svg'로). 없으면 null. */
  extension: string | null;
  /**
   * 입력 URL의 마스킹된 표현(D10). origin + path만, query/fragment 제거.
   * File 객체이면 null.
   */
  url: string | null;
  /** 입력 byte 수(추정 가능한 경우). Blob.size / Data URL payload 길이 / Response Content-Length 등. */
  bytes: number | null;
  /** Blob/Response 본문을 1회 소비했는지(D11). */
  consumed: boolean;
}

export interface InspectSvgSourceFetchInfo {
  mode: InspectSvgSourceFetchMode;
  /** 실제 fetch 시도 여부. policy로 차단되면 false. */
  performed: boolean;
  /** HTTP status. fetch 미수행 시 null. */
  status: number | null;
}

export interface InspectSvgSourceReport {
  kind: InspectSvgSourceKind;
  source: InspectSvgSourceMeta;
  /** URL 입력 + fetch 옵션이 작용한 경우에만 객체. 그 외는 null. */
  fetch: InspectSvgSourceFetchInfo | null;
  /** kind === 'svg' + 본문 도출 성공 시에만 RM-001 report. 그 외 null. */
  svg: InspectSvgReport | null;
  /** source/routing 단계 finding. svg 본문 단계 finding은 svg.findings에 있다. */
  findings: InspectSvgSourceFinding[];
  /** 실행 환경(D12). RM-001/RM-005와 동일 규칙. */
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
}

export interface InspectSvgSourceOptions {
  /** fetch 정책(D3). 기본 'never'. */
  fetch?: InspectSvgSourceFetchMode;
  /** fetch 모드에서만 사용되는 abort signal(D9). */
  signal?: AbortSignal;
  /** fetch 모드에서만 사용되는 timeout(ms)(D9). 기본 DEFAULT_FETCH_TIMEOUT_MS = 30_000. */
  timeoutMs?: number;
  /** byte cap 하향 조정(D8). 1 <= byteLimit <= MAX_SVG_BYTES. 기본 MAX_SVG_BYTES. */
  byteLimit?: number;
}
