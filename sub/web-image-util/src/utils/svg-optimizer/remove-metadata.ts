/**
 * SVG 메타데이터 제거 모듈.
 *
 * XML 주석/DOCTYPE/처리 명령, 편집기(Sodipodi/Inkscape) 네임스페이스와 요소,
 * 렌더링과 무관한 속성을 정규식 기반으로 제거한다. DOM 파싱 없이 동작하므로
 * 파서가 없는 환경에서도 안전하다.
 */

/** 정리 대상이 되는 불필요한 네임스페이스 속성 패턴. */
const UNNECESSARY_NAMESPACE_PATTERNS: RegExp[] = [
  /xmlns:dc="[^"]*"/g,
  /xmlns:cc="[^"]*"/g,
  /xmlns:rdf="[^"]*"/g,
  /xmlns:svg="[^"]*"/g,
  /xmlns:sodipodi="[^"]*"/g,
  /xmlns:inkscape="[^"]*"/g,
];

/** 메타데이터/편집기 전용 요소 패턴. */
const METADATA_ELEMENT_PATTERNS: RegExp[] = [
  /<metadata[\s\S]*?<\/metadata>/gi,
  /<title[\s\S]*?<\/title>/gi,
  /<desc[\s\S]*?<\/desc>/gi,
  /<sodipodi:[^>]*>/gi,
  /<inkscape:[^>]*>/gi,
];

/** 렌더링과 무관한 속성 패턴. */
const UNNECESSARY_ATTRIBUTE_PATTERNS: RegExp[] = [
  /xml:space="[^"]*"/g,
  /data-[^=]*="[^"]*"/g,
  // 렌더링에 불필요한 ID 속성 제거.
  /id="[^"]*"/g,
  // 빈 style 속성.
  /style=""/g,
  // 빈 transform 속성.
  /transform=""/g,
];

/**
 * SVG 문자열에서 메타데이터와 부가 속성을 제거한다.
 *
 * @param svgString 원본 SVG 문자열
 * @returns 메타데이터가 제거된 SVG 문자열
 */
export function removeMetadata(svgString: string): string {
  let cleaned = svgString;

  // XML 주석 제거.
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // DOCTYPE 선언 제거.
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

  // XML 처리 명령(<?xml ... ?>) 제거.
  cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');

  // 기본 svg/xlink 외 불필요한 네임스페이스 제거.
  for (const regex of UNNECESSARY_NAMESPACE_PATTERNS) {
    cleaned = cleaned.replace(regex, '');
  }

  // 메타데이터/편집기 전용 요소 제거.
  for (const regex of METADATA_ELEMENT_PATTERNS) {
    cleaned = cleaned.replace(regex, '');
  }

  // 렌더링에 불필요한 속성 제거.
  for (const regex of UNNECESSARY_ATTRIBUTE_PATTERNS) {
    cleaned = cleaned.replace(regex, '');
  }

  return cleaned;
}
