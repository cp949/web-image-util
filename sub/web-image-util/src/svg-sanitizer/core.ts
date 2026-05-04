/**
 * strict SVG sanitizer 오케스트레이션.
 *
 * 입력 검증 → 전처리 → DOMPurify 정제 → 후처리(강제 정책 + metadata + 노드 카운트)
 * 흐름을 단일 함수로 묶는다. nested SVG 재귀를 위해 자기 자신을 callback으로
 * 하위 모듈(`reference-policy`, `enforce-dom-policy`, `postprocess`)에 주입한다.
 */

import { ImageProcessError } from '../errors';
import { buildFinalConfig, sanitizeUserConfig } from './config';
import { getDomPurify } from './dompurify-instance';
import { assertSafeIntegerLimit, assertWithinMaxBytes } from './limits';
import { postProcessSanitized } from './postprocess';
import { preprocessSvgInput } from './preprocess';
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_NODE_COUNT,
  type SanitizeSvgStrictDetailedResult,
  type StrictSvgSanitizerOptions,
} from './types';
import { collectInputPolicyWarnings } from './warnings';

/**
 * 공통 정제 로직: 전처리 → DOMPurify 정제 → 노드 개수 검증.
 *
 * `sanitizeSvgStrict`와 `sanitizeSvgStrictDetailed`가 공유하는 핵심 구현이다.
 * 자기 자신을 nested sanitize 콜백으로 하위 모듈에 전달해 `data:image/svg+xml`
 * 참조의 재귀 정제를 처리한다.
 *
 * @param svg 입력 SVG 문자열
 * @param options sanitizer 옵션
 * @param recursionDepth 현재 재귀 깊이 (외부 호출은 0)
 * @returns 정제된 SVG와 경고 목록
 */
export function sanitizeSvgStrictCore(
  svg: string,
  options: StrictSvgSanitizerOptions | undefined,
  recursionDepth = 0
): SanitizeSvgStrictDetailedResult {
  // 1. 입력 타입 검증
  if (typeof svg !== 'string') {
    throw new ImageProcessError('sanitizeSvgStrict expects a string input', 'SVG_INPUT_INVALID', {
      details: { actualType: typeof svg },
    });
  }

  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxNodeCount = options?.maxNodeCount ?? DEFAULT_MAX_NODE_COUNT;
  const removeMetadata = options?.removeMetadata ?? false;

  assertSafeIntegerLimit('maxBytes', maxBytes, 1);
  assertSafeIntegerLimit('maxNodeCount', maxNodeCount, 0);

  // 2. 입력 바이트 크기 검증
  assertWithinMaxBytes(svg, maxBytes);

  const warnings: string[] = [];

  // 3. 전처리 (DOCTYPE/ENTITY/BOM/XML 선언/주석 제거)
  //    `<metadata>` 제거는 정규식으로 안전하게 처리할 수 없어
  //    후처리(postProcessSanitized) 단계에서 DOM 기반으로 다룬다.
  const preprocessed = preprocessSvgInput(svg, warnings);
  collectInputPolicyWarnings(preprocessed, warnings);

  // 4. 사용자 DOMPurify 설정에서 보안 키 제거
  const safeUserConfig = sanitizeUserConfig(options?.domPurifyConfig, warnings);

  // 5. 최종 DOMPurify 설정 빌드 (라이브러리 강제 정책 우선)
  const finalConfig = buildFinalConfig(safeUserConfig);

  // 6. DOMPurify 정제 — RETURN_TRUSTED_TYPE: false 이므로 string 반환이 보장된다.
  //    DOMPurify.sanitize의 반환 타입은 설정에 따라 string | TrustedHTML 등으로
  //    유니온이지만, 위 finalConfig가 RETURN_TRUSTED_TYPE=false 를 강제하므로
  //    런타임 값은 항상 string이다. 타입 단언은 그 사실을 반영한다.
  const sanitized = getDomPurify().sanitize(preprocessed, finalConfig) as string;

  // 7. 후처리 — DOMParser로 한 번 파싱해서 metadata 제거, parsererror 처리, 노드 개수 카운트를 일괄 수행
  const { svg: finalSvg, nodeCount } = postProcessSanitized(
    sanitized,
    removeMetadata,
    warnings,
    options,
    recursionDepth,
    sanitizeSvgStrictCore
  );
  if (nodeCount > maxNodeCount) {
    throw new ImageProcessError(
      `Sanitized SVG node count (${nodeCount}) exceeds the configured maximum (${maxNodeCount})`,
      'SVG_NODE_COUNT_EXCEEDED',
      { details: { actualCount: nodeCount, maxCount: maxNodeCount } }
    );
  }

  return {
    svg: finalSvg,
    warnings,
  };
}
