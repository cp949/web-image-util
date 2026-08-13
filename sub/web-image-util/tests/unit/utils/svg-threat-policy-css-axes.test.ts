/**
 * CSS 위험 구문 정책 3축 특성화 표.
 *
 * 위협 정책의 위험 구문 정규식이 진단 수집기에 verbatim으로 복사돼 있다.
 * 한쪽은 제거하고 한쪽은 센다. 이 표는 제거 결과와 집계 수의 현재 답을
 * 고정한다. 테이블 1벌로 모으는 이관 중 한 칸이라도 바뀌면 실패한다.
 *
 * 새 동작을 명세하는 테스트가 아니다. 기댓값은 실행 결과를 확인한 뒤 고정했다.
 */
import { describe, expect, it } from 'vitest';
import { collectSvgCssReferenceSignals } from '../../../src/utils/svg-inspection/css-signals.internal';
import { sanitizeCssValue } from '../../../src/utils/svg-threat-policy.internal';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 한 CSS 입력에 대한 3축의 답.
 *
 * - `sanitized`: `sanitizeCssValue(css)` — 집행 엔진의 제거 결과
 * - `styleAttributeCount`: style 속성에 넣었을 때의 진단 집계 수
 * - `styleTagCount`: `<style>` 본문에 넣었을 때의 진단 집계 수
 */
interface CssAxes {
  sanitized: string;
  styleAttributeCount: number;
  styleTagCount: number;
}

const CSS_AXES_CORPUS: Array<[label: string, css: string, expected: CssAxes]> = [
  ['내부 url', 'fill:url(#g)', { sanitized: 'fill:url(#g)', styleAttributeCount: 0, styleTagCount: 0 }],
  [
    'http url',
    'fill:url(http://evil.example.com/a.png)',
    { sanitized: 'fill:none', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  ['상대 경로 url', 'fill:url(a.png)', { sanitized: 'fill:none', styleAttributeCount: 1, styleTagCount: 1 }],
  // CSS url()은 안전 raster data도 보존하지 않는다 — href 축과 다르다
  [
    '안전 raster data url',
    'fill:url(data:image/png;base64,iVBORw0KGgo=)',
    { sanitized: 'fill:none', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    '@import',
    '@import "https://evil.example.com/a.css";color:red',
    { sanitized: 'color:red', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  // expression 제거 패턴이 첫 닫는 괄호에서 끊겨 잔여 ')'가 남는다 — 현행 동작
  ['expression()', 'width:expression(alert(1))', { sanitized: 'width:)', styleAttributeCount: 1, styleTagCount: 1 }],
  [
    'image-set()',
    "background:image-set('https://e.example/a.png' 1x)",
    { sanitized: 'background:', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    '-webkit-image-set()',
    "background:-webkit-image-set('https://e.example/a.png' 1x)",
    { sanitized: 'background:', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    '-moz-binding 외부 url',
    '-moz-binding:url(http://e.example/x);fill:red',
    { sanitized: 'fill:red', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  // -moz-binding은 내부 참조여도 선언 전체를 제거한다
  ['-moz-binding 내부 url', '-moz-binding:url(#internal)', { sanitized: '', styleAttributeCount: 1, styleTagCount: 1 }],
  [
    'CSS escape로 감춘 url',
    'fill:\\75rl(http://evil.example.com/a.png)',
    { sanitized: '', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    'CSS escape로 감춘 @import',
    '\\40import "http://e.example/a.css"',
    { sanitized: '', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    'url() 없는 외부 URL 리터럴',
    'background:"https://e.example/a.png"',
    { sanitized: '', styleAttributeCount: 1, styleTagCount: 1 },
  ],
  [
    'http url 2개',
    'fill:url(http://a.example/1.png);stroke:url(http://b.example/2.png)',
    { sanitized: 'fill:none;stroke:none', styleAttributeCount: 2, styleTagCount: 2 },
  ],
  [
    '@import + expression',
    '@import "http://e.example/a.css";width:expression(alert(1))',
    { sanitized: 'width:)', styleAttributeCount: 2, styleTagCount: 2 },
  ],
  [
    '@import + http url',
    '@import "http://e.example/a.css";fill:url(http://e.example/b.png)',
    { sanitized: 'fill:none', styleAttributeCount: 2, styleTagCount: 2 },
  ],
  [
    '위험 구문 없음',
    'fill:red;stroke:blue',
    { sanitized: 'fill:red;stroke:blue', styleAttributeCount: 0, styleTagCount: 0 },
  ],
];

/** 속성값·텍스트로 삽입하기 위해 XML 특수문자를 이스케이프한다. */
function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function countInStyleAttribute(css: string): number {
  const svg = `<svg xmlns="${SVG_NS}"><rect style="${escapeXmlText(css)}"/></svg>`;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return collectSvgCssReferenceSignals(doc).externalCssCount;
}

function countInStyleTag(css: string): number {
  const svg = `<svg xmlns="${SVG_NS}"><style>${escapeXmlText(css)}</style></svg>`;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return collectSvgCssReferenceSignals(doc).externalCssCount;
}

describe('CSS 위험 구문 정책 3축 특성화 표', () => {
  it.each(CSS_AXES_CORPUS)('%s → 3축의 답이 고정값과 일치한다', (_label, css, expected) => {
    const actual: CssAxes = {
      sanitized: sanitizeCssValue(css),
      styleAttributeCount: countInStyleAttribute(css),
      styleTagCount: countInStyleTag(css),
    };
    expect(actual).toEqual(expected);
  });

  it('고정한 CSS 코퍼스가 17행이다', () => {
    expect(CSS_AXES_CORPUS).toHaveLength(17);
  });
});
