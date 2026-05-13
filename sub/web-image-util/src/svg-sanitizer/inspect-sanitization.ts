/**
 * SVG sanitizer 정책 영향 진단 API.
 *
 * 입력 SVG 문자열 한 개와 정책 한 개를 받아 부수효과 없이 진단해
 * `InspectSvgSanitizationReport`를 반환한다. 네트워크 fetch, Canvas 렌더링,
 * DOMPurify의 top-level import를 수행하지 않는다. strict 경로만 `await import('./core')`로
 * DOMPurify에 동적 접근한다.
 *
 * 본 모듈은 TASK-01 시점에 외부로 노출되지 않는다. `svg-sanitizer/index.ts` 추가와
 * contract 픽스처 갱신은 TASK-04에서 한 번에 수행한다.
 */

import { MAX_SVG_BYTES } from '../core/source-converter/options';
import { ImageProcessError } from '../errors';

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
  environment: 'browser' | 'happy-dom' | 'node' | 'unknown';
  policy: SvgSanitizerPolicy;
  impact: InspectSvgSanitizationImpact;
}

export interface InspectSvgSanitizationOptions {
  /** 진단할 sanitizer 정책. 기본값: 'lightweight'. */
  policy?: SvgSanitizerPolicy;
}

/**
 * 현재 실행 환경을 감지한다.
 *
 * inspectSvg의 `detectInspectEnvironment`와 동일한 평가 순서지만, `utils ↔ svg-sanitizer`
 * 서브패스 간 의존성 추가를 피하기 위해 본 모듈에 인라인으로 둔다.
 *
 * 1. globalThis.happyDOM 이 존재하면 'happy-dom'
 * 2. window / document / DOMParser 모두 존재하면 'browser'
 * 3. process.versions.node 이 존재하면 'node'
 * 4. 그 외 'unknown'
 */
function detectSanitizationEnvironment(): 'browser' | 'happy-dom' | 'node' | 'unknown' {
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

/** byte 초과 시 정책별로 반환할 fallback impact를 만든다. */
function buildBytesExceededImpact(policy: SvgSanitizerPolicy): InspectSvgSanitizationImpact {
  if (policy === 'skip') {
    return { kind: 'skip', status: 'not-applied', potentialStages: [] };
  }

  const failure: InspectSvgSanitizationFailure = {
    code: 'svg-bytes-exceeded',
    message: 'SVG input size exceeds the configured byte limit.',
  };

  if (policy === 'strict') {
    return {
      kind: 'strict',
      status: 'failed',
      outputBytes: null,
      outputNodeCount: null,
      stages: [],
      failure,
    };
  }

  return {
    kind: 'lightweight',
    status: 'failed',
    outputBytes: null,
    stages: [],
    failure,
  };
}

/** 정상 입력에 대해 정책별 placeholder impact를 만든다. 다음 TASK에서 stages 수집을 채운다. */
function buildPlaceholderImpact(policy: SvgSanitizerPolicy, bytes: number): InspectSvgSanitizationImpact {
  if (policy === 'skip') {
    return { kind: 'skip', status: 'not-applied', potentialStages: [] };
  }

  if (policy === 'strict') {
    return {
      kind: 'strict',
      status: 'ok',
      outputBytes: bytes,
      outputNodeCount: 0,
      stages: [],
      failure: null,
    };
  }

  return {
    kind: 'lightweight',
    status: 'ok',
    outputBytes: bytes,
    stages: [],
    failure: null,
  };
}

/**
 * SVG 문자열에 sanitizer 정책을 적용했을 때 어떤 stage가 발동(또는 발동할)했는지 진단한다.
 *
 * 네트워크, Canvas 렌더링, DOMPurify top-level import를 수행하지 않는다.
 * strict 정책은 동적 import로만 DOMPurify에 접근한다.
 * 비문자열 입력과 잘못된 policy 값에만 throw하며, 그 외 모든 케이스(byte 초과, 파싱 실패,
 * strict 내부 실패)는 보고서로 답한다.
 *
 * @throws {ImageProcessError} code=`SVG_INPUT_INVALID`, details=`{ actualType }` — input is not a string.
 * @throws {ImageProcessError} code=`INVALID_SOURCE`, details=`{ policy }` — options.policy is not one of the supported values.
 */
export async function inspectSvgSanitization(
  svgString: string,
  options?: InspectSvgSanitizationOptions
): Promise<InspectSvgSanitizationReport> {
  // 비문자열 입력 검증 (D10)
  if (typeof svgString !== 'string') {
    const actualType = svgString === null ? 'null' : typeof svgString;
    throw new ImageProcessError(
      `inspectSvgSanitization expects a string input, but received ${actualType}.`,
      'SVG_INPUT_INVALID',
      { details: { actualType } }
    );
  }

  // 옵션 정책 검증. undefined는 기본값 'lightweight'.
  const policyOption = options?.policy;
  if (
    policyOption !== undefined &&
    policyOption !== 'lightweight' &&
    policyOption !== 'strict' &&
    policyOption !== 'skip'
  ) {
    throw new ImageProcessError(`Unsupported SVG sanitizer policy: ${String(policyOption)}.`, 'INVALID_SOURCE', {
      details: { policy: policyOption },
    });
  }

  const policy: SvgSanitizerPolicy = policyOption ?? 'lightweight';

  // UTF-8 바이트 측정 + 환경 감지
  const bytes = new TextEncoder().encode(svgString).length;
  const environment = detectSanitizationEnvironment();

  // byte 초과 → 정책별 fallback
  if (bytes > MAX_SVG_BYTES) {
    const report: InspectSvgSanitizationReport = {
      bytes,
      byteLimit: MAX_SVG_BYTES,
      environment,
      policy,
      impact: buildBytesExceededImpact(policy),
    };
    return report;
  }

  // 정상 경로 — 본 TASK에서는 정책별 placeholder만 반환한다. stages 수집은 다음 TASK에서 채운다.
  const report: InspectSvgSanitizationReport = {
    bytes,
    byteLimit: MAX_SVG_BYTES,
    environment,
    policy,
    impact: buildPlaceholderImpact(policy, bytes),
  };
  return report;
}
