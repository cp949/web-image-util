/**
 * SVG 마크업 공백 정리 모듈.
 *
 * 태그 사이/속성 사이의 불필요한 공백만 축약하고, 속성 값 내부는 건드리지 않는다.
 * 모든 정규식이 마크업 토큰 경계만 노리므로 path 데이터 등 속성 값에 영향을 주지 않는다.
 */

/**
 * SVG 문자열의 마크업 공백을 정리한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 공백이 정리된 SVG 문자열
 */
export function cleanupWhitespace(svgString: string): string {
  return (
    svgString
      // 태그 사이 공백 제거.
      .replace(/>\s+</g, '><')
      // 연속 공백을 동일 종류의 공백 1개로 축약(속성 값 내부 제외).
      .replace(/(\s)\s+/g, '$1')
      // 속성 = 양쪽 공백 제거.
      .replace(/\s*=\s*/g, '=')
      // 속성 사이는 단일 공백으로.
      .replace(/"\s+([a-zA-Z-])/g, '" $1')
      .trim()
  );
}
