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

/**
 * byte 초과 finding의 details 스키마.
 *
 * `actualBytes`는 실제 입력 바이트 수이며, 알 수 없는 경로(Content-Length 부재 등)는 null이다.
 */
export type SvgBytesExceededDetails = {
  actualBytes: number | null;
  maxBytes: number;
};

/**
 * byte 초과 사건의 공유 finding을 만든다.
 *
 * 세 진단 API(inspectSvg / inspectSvgSource / inspectSvgSanitization)가 같은 사건을
 * 같은 code·details 스키마로 보고하기 위한 단일 조립 지점이다. message는 호출자
 * 분기 대상이 아니며, 계약은 code와 details다.
 *
 * @param actualBytes 실제 입력 바이트 수. 알 수 없으면 null
 * @param maxBytes 적용된 byte 한도
 */
export function buildSvgBytesExceededFinding(
  actualBytes: number | null,
  maxBytes: number
): { code: 'svg-bytes-exceeded'; message: string; details: SvgBytesExceededDetails } {
  const message =
    actualBytes === null
      ? `SVG input size exceeds the maximum allowed (${maxBytes} bytes).`
      : `SVG input size (${actualBytes} bytes) exceeds the maximum allowed (${maxBytes} bytes).`;
  return { code: 'svg-bytes-exceeded', message, details: { actualBytes, maxBytes } };
}
