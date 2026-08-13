/**
 * strict sanitizer의 URI 경고 축 특성화 테스트.
 *
 * 공개 warning 출력이 참조 판정 이관 전후에 유지되는지 reason 9종과
 * strict 모드 분기 입력으로 고정한다.
 */

import { describe, expect, it } from 'vitest';

import { collectInputPolicyWarnings } from '../../../src/svg-sanitizer/warnings.internal';
import { classifyUriRef, type UriRefReason } from '../../../src/utils/svg-threat-policy.internal';

const EXTERNAL_URI_WARNING = '외부 URI 참조 속성이 제거되었습니다.';
const CANONICAL_SVG_DATA = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')}`;
const NESTED_SVG_DATA = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')}`;

interface WarningAxisCase {
  label: string;
  value: string;
  reason: UriRefReason;
  warned: boolean;
}

const WARNING_AXIS_CASES: WarningAxisCase[] = [
  { label: '내부 fragment', value: '#frag', reason: 'internal-fragment', warned: false },
  { label: '빈 문자열', value: '', reason: 'empty', warned: true },
  { label: '문자참조 공백', value: '&#32;', reason: 'normalized-empty', warned: true },
  { label: '문자참조 fragment', value: '&#35;frag', reason: 'external', warned: true },
  { label: '큰따옴표 fragment', value: '"#frag"', reason: 'boundary-quote', warned: true },
  { label: '안전 raster data', value: 'data:image/png;base64,iVBORw0KGgo=', reason: 'safe-raster-data', warned: false },
  { label: 'canonical svg data', value: CANONICAL_SVG_DATA, reason: 'canonical-svg-data', warned: false },
  { label: 'nested svg data', value: NESTED_SVG_DATA, reason: 'nested-svg-data', warned: false },
  { label: '비허용 MIME data', value: 'data:text/html,x', reason: 'unsafe-data', warned: true },
  { label: '외부 URL', value: 'https://evil.example/a.png', reason: 'external', warned: true },
];

/** XML 속성에 원본 참조 문자열을 손실 없이 삽입한다. */
function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** 입력 단계의 공개 URI 경고가 누적되는지 확인한다. */
function hasExternalUriWarning(value: string): boolean {
  const warnings: string[] = [];
  collectInputPolicyWarnings(
    `<svg xmlns="http://www.w3.org/2000/svg"><image href="${escapeAttributeValue(value)}"/></svg>`,
    warnings
  );
  return warnings.includes(EXTERNAL_URI_WARNING);
}

describe('strict sanitizer URI 경고 축 특성화 표', () => {
  it.each(WARNING_AXIS_CASES)('$label의 reason과 공개 경고 출력을 유지한다', ({ value, reason, warned }) => {
    expect(classifyUriRef(value, 'strict').reason).toBe(reason);
    expect(hasExternalUriWarning(value)).toBe(warned);
  });
});
