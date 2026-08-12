/**
 * SVG 진단 · 변형 도구 서브패스
 *
 * @description
 * 루트 엔트리(`@cp949/web-image-util`)가 소유하지 않는 SVG 전용 도구만 노출한다.
 * 변환(`ensureBlob` 등) · 포맷(`formatToMimeType` 등) · 이미지 정보 조회 ·
 * 소스 판정 · 브라우저 기능 감지는 루트 엔트리에서 가져온다.
 *
 * **노출 범위:**
 * - `inspectSvg` — SVG 문자열 진단 리포트
 * - `inspectSvgSource` — SVG 후보 입력의 source 종류 진단
 * - `prefixSvgIds` — SVG `id`와 fragment 참조 prefix
 * - `SvgOptimizer` — SVG 벡터 최적화
 *
 * @example
 * ```typescript
 * import { inspectSvg, prefixSvgIds } from '@cp949/web-image-util/utils';
 * import { ensureBlob } from '@cp949/web-image-util';
 *
 * const report = inspectSvg(svgString);
 * const { svg } = prefixSvgIds(svgString, 'icon-a');
 * const blob = await ensureBlob(imageElement);
 * ```
 */

/**
 * SVG 진단 리포트
 *
 * @description 문자열 SVG 한 개를 부수효과 없이 진단해 finding/recommendation 리포트를 반환한다.
 */
export {
  type InspectSvgDimensions,
  type InspectSvgFinding,
  type InspectSvgFindingCode,
  type InspectSvgReport,
  inspectSvg,
} from './inspect-svg';
/**
 * SVG 입력 source 진단
 *
 * @description SVG 후보 입력(string/Blob/File/URL)의 source 종류를 진단한다.
 * 기본 동작에서 네트워크 fetch를 수행하지 않는다.
 */
export {
  type InspectSvgSourceFetchInfo,
  type InspectSvgSourceFetchMode,
  type InspectSvgSourceFinding,
  type InspectSvgSourceFindingCode,
  type InspectSvgSourceInput,
  type InspectSvgSourceKind,
  type InspectSvgSourceMeta,
  type InspectSvgSourceOptions,
  type InspectSvgSourceReport,
  inspectSvgSource,
} from './inspect-svg-source';
/**
 * SVG ID prefix 유틸리티
 *
 * @description SVG 문자열 내 모든 id 속성에 prefix를 붙이고 같은 문서 안의
 * fragment 참조(href/xlink:href/src)도 함께 rewrite한다
 */
export {
  prefixSvgIds,
  type SvgIdPrefixDeoptReason,
  type SvgIdPrefixReport,
  type SvgIdPrefixResult,
  type SvgIdPrefixWarning,
  type SvgIdPrefixWarningCode,
} from './prefix-svg-ids';
/**
 * SVG vector optimization system
 *
 * @description Advanced optimization tools that reduce SVG file size
 * and improve rendering performance
 */
export { type OptimizationResult, type SvgOptimizationOptions, SvgOptimizer } from './svg-optimizer/index';
