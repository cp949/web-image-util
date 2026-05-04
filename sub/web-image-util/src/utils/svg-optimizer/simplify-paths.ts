/**
 * SVG path 데이터 단순화 모듈.
 *
 * `<... d="...">`의 path 데이터에 한해 다음을 정리한다.
 * - 소수점 자릿수를 `precision`으로 제한
 * - 불필요한 trailing zero 제거(`1.000` → `1`)
 * - 연속 공백 축약, 명령어 주변 공백·콤마 정리
 *
 * path 데이터 외부의 마크업은 건드리지 않는다.
 */

/** SVG path 명령 문자(절대/상대 양쪽). */
const PATH_COMMANDS = 'MmLlHhVvCcSsQqTtAaZz';

/**
 * path 데이터를 단순화한다.
 *
 * @param svgString 원본 SVG 문자열
 * @param precision 소수점 자릿수
 * @returns path 데이터가 단순화된 SVG 문자열
 */
export function simplifyPaths(svgString: string, precision: number): string {
  return svgString.replace(/d="([^"]+)"/g, (_match, pathData: string) => {
    let simplified = pathData;

    // 소수점 자릿수 제한.
    const precisionRegex = new RegExp(`(\\d+\\.\\d{${precision + 1},})`, 'g');
    simplified = simplified.replace(precisionRegex, (numMatch: string) => parseFloat(numMatch).toFixed(precision));

    // 불필요한 trailing zero 제거(1.000 → 1).
    simplified = simplified.replace(/\.0+\b/g, '');

    // 연속 공백을 단일 공백으로.
    simplified = simplified.replace(/\s+/g, ' ');

    // 숫자 사이의 공백을 콤마로 치환.
    simplified = simplified.replace(/(\d)\s+(\d)/g, '$1,$2');

    // 명령어 뒤의 공백 제거.
    simplified = simplified.replace(new RegExp(`([${PATH_COMMANDS}])\\s+`, 'g'), '$1');

    // 명령어 앞의 공백 제거.
    simplified = simplified.replace(new RegExp(`\\s+([${PATH_COMMANDS}])`, 'g'), '$1');

    // 콤마 주변 공백 정리.
    simplified = simplified.replace(/\s*,\s*/g, ',');

    // 양 끝 공백 제거.
    simplified = simplified.trim();

    return `d="${simplified}"`;
  });
}
