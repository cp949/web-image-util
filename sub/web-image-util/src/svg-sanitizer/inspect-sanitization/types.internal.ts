/**
 * SVG sanitizer 정책 영향 진단 스택의 타입 leaf.
 *
 * inspectSvgSanitization 공개 타입 11종의 정의 지점이다 — 파일 자체는 공개
 * 경로가 아니며, 공개는 `inspect-sanitization.ts`의 재export를 경유한다.
 */

import type { RuntimeEnvironment } from '../../utils/environment.internal';

/** sanitizer 정책. processImage()의 `svgSanitizer` 옵션과 동일한 3개 값을 받는다. */
export type SvgSanitizerPolicy = 'lightweight' | 'strict' | 'skip';

/** 정책 발동(또는 발동했을) 사건을 식별하는 코드. inspectSvg finding 코드와 1:1 의미 호응. */
export type InspectSvgSanitizationStageCode =
  | 'script-removed'
  | 'foreign-object-removed'
  | 'event-handler-removed'
  | 'external-href-removed'
  | 'external-css-removed'
  | 'doctype-removed'
  | 'entity-removed'
  | 'data-image-preserved'
  | 'data-image-blocked'
  | 'nested-svg-resanitized';

/** strict 실행 실패 또는 byte 초과 사유. lightweight/strict failure 필드와 진단 함수 throw에 사용. */
export type InspectSvgSanitizationFailureCode =
  | 'svg-input-invalid'
  | 'svg-bytes-exceeded'
  | 'svg-node-count-exceeded'
  | 'svg-dompurify-init-failed'
  | 'svg-strict-internal-error';

export interface InspectSvgSanitizationStage {
  code: InspectSvgSanitizationStageCode;
  /** 정책 발동(또는 발동했을) 횟수. count > 0 일 때만 stage가 배열에 포함된다. */
  count: number;
  /**
   * count > 0 일 때 1~3개 짧은 식별자. tagName(소문자) / attrName / 'style-tag' / 'doctype' /
   * 'entity' / MIME 문자열 중 하나. 원본 URL/속성값/SVG 원문은 담지 않는다. 각 항목 최대 32자.
   */
  samples: string[];
}

export interface InspectSvgSanitizationFailure {
  code: InspectSvgSanitizationFailureCode;
  /** 영어 자연문. 호출자 분기 대상이 아니며 patch에서도 자유롭게 다듬을 수 있다. */
  message: string;
}

export interface InspectSvgSanitizationLightweightImpact {
  kind: 'lightweight';
  status: 'ok' | 'failed';
  /** sanitize 완료 후 UTF-8 byte 수. failed이면 null. */
  outputBytes: number | null;
  stages: InspectSvgSanitizationStage[];
  failure: InspectSvgSanitizationFailure | null;
}

export interface InspectSvgSanitizationStrictImpact {
  kind: 'strict';
  status: 'ok' | 'failed';
  outputBytes: number | null;
  outputNodeCount: number | null;
  stages: InspectSvgSanitizationStage[];
  failure: InspectSvgSanitizationFailure | null;
}

export interface InspectSvgSanitizationSkipImpact {
  kind: 'skip';
  /** sanitizer가 실행되지 않았음을 타입으로 못박는다. */
  status: 'not-applied';
  /** lightweight가 적용됐다면 발동했을 정책 stage 카운트. 실제 정제는 수행하지 않는다. */
  potentialStages: InspectSvgSanitizationStage[];
}

export type InspectSvgSanitizationImpact =
  | InspectSvgSanitizationLightweightImpact
  | InspectSvgSanitizationStrictImpact
  | InspectSvgSanitizationSkipImpact;

export interface InspectSvgSanitizationReport {
  /** strict의 failure가 있어도 보고서 객체 자체는 항상 반환된다. impact.kind / impact.status로 분기. */
  bytes: number;
  byteLimit: number;
  environment: RuntimeEnvironment;
  policy: SvgSanitizerPolicy;
  impact: InspectSvgSanitizationImpact;
}

export interface InspectSvgSanitizationOptions {
  /** 진단할 sanitizer 정책. 기본값: 'lightweight'. */
  policy?: SvgSanitizerPolicy;
}
