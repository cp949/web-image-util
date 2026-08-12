/**
 * SVG 처리 계약 leaf.
 *
 * core(source-converter)와 주변부 진단 API(inspectSvg / inspectSvgSource /
 * inspectSvgSanitization), prefix-svg-ids가 공유하는 SVG 입력 계약의 단일
 * 정의 지점이다. 다른 내부 모듈을 import하지 않는 최하단 leaf로 유지한다.
 */

/**
 * SVG sanitizer 적용 정책.
 *
 * - lightweight: 기본값. 빠른 렌더링 보호용 경량 guard를 적용한다.
 * - strict: SVG로 판정된 입력에만 DOMPurify 기반 strict sanitizer를 적용한다.
 * - skip: 호출처가 이미 정제한 SVG라고 보고 sanitizer와 SVG 보안 assert를 건너뛴다.
 */
export type SvgSanitizerMode = 'lightweight' | 'strict' | 'skip';

/**
 * SVG 입력 최대 허용 바이트 수 (10MiB).
 * 실제 SVG 파일은 대부분 수백KB 이하이며,
 * 이 상한선은 정상 사용을 막지 않으면서 비정상적인 메모리 소모를 초기에 차단한다.
 */
export const MAX_SVG_BYTES = 10 * 1024 * 1024;
