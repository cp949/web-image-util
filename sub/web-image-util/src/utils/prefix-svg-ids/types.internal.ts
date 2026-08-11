/**
 * SVG id prefix 스택의 타입 leaf.
 *
 * prefixSvgIds 공개 타입 5종의 정의 지점이다 — 파일 자체는 공개 경로가
 * 아니며, 공개는 `prefix-svg-ids.ts`의 재export를 경유한다.
 */

/** rewrite를 보류한 사유. 같은 호출에서 여러 사유가 중복 누적될 수 있다. */
export type SvgIdPrefixDeoptReason =
  | 'byte-limit-exceeded'
  | 'parse-failed'
  | 'domparser-unavailable'
  | 'style-tag-present'
  | 'style-attribute-present';

/** rewrite를 부분적으로 생략한 사유. 정상 경로에서만 등장한다(deopt 경로에서는 빈 배열). */
export type SvgIdPrefixWarningCode =
  | 'id-rewrite-skipped-idempotent'
  | 'id-rewrite-skipped-collision'
  | 'reference-skipped-dangling'
  | 'reference-skipped-external';

export interface SvgIdPrefixWarning {
  code: SvgIdPrefixWarningCode;
  /** 발생 횟수. count > 0 일 때만 warnings 배열에 포함된다. */
  count: number;
}

export interface SvgIdPrefixReport {
  /** style/parse 실패/byte 초과로 rewrite를 보류했는지. true면 svg는 입력 원본 그대로. */
  deoptimized: boolean;
  /** deoptimized=true일 때 사유 배열. false일 때 빈 배열. */
  deoptReasons: SvgIdPrefixDeoptReason[];
  /** 입력 UTF-8 byte 수. */
  bytes: number;
  /** byte 한도(`MAX_SVG_BYTES`). */
  byteLimit: number;
  /** 실행 환경 표시. inspectSvg의 environment와 동일 규칙. */
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  /** prefix 접두를 실제로 붙인 id 개수(idempotent/collision 생략 제외). */
  prefixedIdCount: number;
  /** rewrite한 fragment reference 개수(dangling/external 생략 제외). */
  rewrittenReferenceCount: number;
  /** structured warning 목록. 각 code는 최대 1개. */
  warnings: SvgIdPrefixWarning[];
}

export interface SvgIdPrefixResult {
  /** 정상 경로: prefix가 적용된 svg. deopt 경로: 입력 원본 svg. */
  svg: string;
  report: SvgIdPrefixReport;
}
