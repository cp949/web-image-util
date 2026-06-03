/**
 * 사용자 DOMPurify 설정과 라이브러리 강제 설정을 머지해 최종 sanitize 설정을 만드는 모듈.
 *
 * 라이브러리 강제 설정은 사용자 설정 위에 항상 우선 적용되어 strict 정책이 깨지지
 * 않도록 한다. 사용자 설정 중 보안 핵심 키는 `sanitizeUserConfig`가 먼저 제거하고,
 * `FORBID_TAGS`/`FORBID_ATTR`만 union 머지된다.
 */

import type { Config } from 'dompurify';
import { FORBIDDEN_OVERRIDE_KEYS } from './types';

/**
 * 사용자 domPurifyConfig에서 보안 핵심 키를 제거하고 덮어쓰기 시도를 warnings에 기록한다.
 *
 * @param userConfig 사용자가 전달한 DOMPurify 설정 (없으면 빈 객체로 처리)
 * @param warnings 경고 누적 배열
 * @returns 보안 키가 제거된 안전한 사용자 설정 사본
 */
export function sanitizeUserConfig(userConfig: Config | undefined, warnings: string[]): Config {
  if (!userConfig) {
    return {};
  }

  const safeUserConfig: Config = { ...userConfig };
  for (const key of FORBIDDEN_OVERRIDE_KEYS) {
    if (key in safeUserConfig) {
      warnings.push(`보안 정책 키 "${key}" 덮어쓰기 시도가 무시되었습니다. 라이브러리 기본값이 강제됩니다.`);
      delete safeUserConfig[key];
    }
  }

  return safeUserConfig;
}

/**
 * 사용자 설정과 라이브러리 강제 설정을 병합해 최종 DOMPurify 설정을 생성한다.
 *
 * 강제 설정은 사용자 설정 위에 덮어써져 항상 우선 적용된다.
 * FORBID_TAGS와 FORBID_ATTR는 사용자 값과 라이브러리 강제 값을 병합한다.
 *
 * @param userConfig 사용자 설정 (보안 키가 이미 제거된 상태)
 * @returns 최종 DOMPurify 설정
 */
export function buildFinalConfig(userConfig: Config): Config {
  // 라이브러리가 강제하는 보안 핵심 설정
  const forcedTags = ['script', 'foreignObject'];
  const forcedAttrs = ['on*'];
  const userForbidTags = Array.isArray(userConfig.FORBID_TAGS) ? userConfig.FORBID_TAGS : [];
  const userForbidAttrs = Array.isArray(userConfig.FORBID_ATTR) ? userConfig.FORBID_ATTR : [];
  const mergedForbidTags = Array.from(new Set([...userForbidTags, ...forcedTags]));
  const mergedForbidAttrs = Array.from(new Set([...userForbidAttrs, ...forcedAttrs]));

  return {
    ...userConfig,
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    IN_PLACE: false,
    KEEP_CONTENT: false,
    FORBID_TAGS: mergedForbidTags,
    FORBID_ATTR: mergedForbidAttrs,
    SAFE_FOR_XML: true,
    WHOLE_DOCUMENT: false,
  };
}
