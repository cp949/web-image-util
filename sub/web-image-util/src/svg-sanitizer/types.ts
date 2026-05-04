/**
 * strict SVG sanitizer 공개 타입과 라이브러리 강제 정책 상수.
 *
 * 이 모듈은 부수효과가 없으며 다른 sanitizer 서브모듈이 공통으로 import하는
 * 단일 출처(single source of truth)다. 외부 표면(`StrictSvgSanitizerOptions`,
 * `SanitizeSvgStrictDetailedResult`)은 패키지 진입점(`index.ts`)에서 그대로
 * re-export 된다.
 */

import type { Config } from 'dompurify';

/**
 * strict SVG sanitizer 옵션
 */
export interface StrictSvgSanitizerOptions {
  /** 최대 SVG 입력 바이트 크기 (UTF-8 기준). 기본값: 10_485_760 (10MiB) */
  maxBytes?: number;
  /** 최대 노드 개수. 기본값: 10_000 */
  maxNodeCount?: number;
  /** <metadata> 요소 제거 여부. 기본값: false */
  removeMetadata?: boolean;
  /**
   * DOMPurify에 추가로 전달할 설정. 기본 strict 정책 위에 사용자 옵션을 머지한다.
   * 보안 핵심 옵션(USE_PROFILES, RETURN_*, IN_PLACE, KEEP_CONTENT 등)은 라이브러리가 강제하므로
   * 사용자가 덮어쓰면 무시되며 warnings에 그 사실이 기록된다.
   *
   * 머지 정책 비대칭 주의:
   * `FORBID_TAGS`와 `FORBID_ATTR`는 사용자 값과 라이브러리 강제 값이 union 머지된다.
   * 태그/속성/URI 허용 범위를 넓힐 수 있는 옵션은 strict 정책 보호를 위해 무시된다.
   */
  domPurifyConfig?: Config;
}

/**
 * sanitizeSvgStrictDetailed() 반환 타입
 */
export interface SanitizeSvgStrictDetailedResult {
  /** 정제된 SVG 문자열 */
  svg: string;
  /** 정제 과정에서 발생한 경고 목록 */
  warnings: string[];
}

/** 기본 최대 입력 바이트 크기 (10MiB) */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

/** 기본 최대 노드 개수 */
export const DEFAULT_MAX_NODE_COUNT = 10_000;

/**
 * 사용자가 덮어쓸 수 없는 보안 핵심 설정 키 목록.
 *
 * 이 키들은 사용자 domPurifyConfig에서 제공되더라도 라이브러리 기본값으로 강제되며,
 * 덮어쓰기 시도 사실은 warnings에 기록된다.
 */
export const FORBIDDEN_OVERRIDE_KEYS = [
  'ADD_ATTR',
  'ADD_DATA_URI_TAGS',
  'ADD_TAGS',
  'ADD_URI_SAFE_ATTR',
  'ALLOW_UNKNOWN_PROTOCOLS',
  'ALLOWED_ATTR',
  'ALLOWED_TAGS',
  'ALLOWED_URI_REGEXP',
  'CUSTOM_ELEMENT_HANDLING',
  'USE_PROFILES',
  'SAFE_FOR_TEMPLATES',
  'SAFE_FOR_XML',
  'WHOLE_DOCUMENT',
  'RETURN_DOM',
  'RETURN_DOM_FRAGMENT',
  'RETURN_TRUSTED_TYPE',
  'IN_PLACE',
  'KEEP_CONTENT',
] as const satisfies readonly (keyof Config)[];

/**
 * nested `data:image/svg+xml`을 재귀 정제할 때 호출되는 callback 시그니처.
 *
 * `reference-policy` → `enforce-dom-policy` → `postprocess` 체인이 `core`의
 * `sanitizeSvgStrictCore`를 직접 import 하면 순환 의존이 생기므로, core가 자기
 * 자신을 callback으로 주입한다.
 */
export type NestedSanitize = (
  svg: string,
  options: StrictSvgSanitizerOptions | undefined,
  depth: number
) => SanitizeSvgStrictDetailedResult;
