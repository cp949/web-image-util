/**
 * SVG 호환성 보정 유틸리티의 회귀 동작을 검증한다.
 * 공개 API(enhanceBrowserCompatibility)와 내부 헬퍼(toMsg, isValidBBox, isBrowser,
 * heuristicBBoxFromString, heuristicBBox, padBBox)를 직접 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceBrowserCompatibility } from '../../../src/utils/svg-compatibility';
import { heuristicBBox, heuristicBBoxFromString, padBBox } from '../../../src/utils/svg-compatibility/bbox/heuristic';
import { isBrowser, isValidBBox } from '../../../src/utils/svg-compatibility/bbox/live';
import {
  extractSizeHints,
  getStyleLength,
  parseCssLength,
  sanitizeNum,
} from '../../../src/utils/svg-compatibility/dimensions';
import { toMsg } from '../../../src/utils/svg-compatibility/internal';

describe('SVG 호환성 보정', () => {
  it('xlink:href만 있는 참조를 href로 현대화하고 legacy 속성을 제거한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon"/></svg>';

    const result = enhanceBrowserCompatibility(svg, {
      addNamespaces: false,
      fixDimensions: false,
      addPreserveAspectRatio: false,
    });

    expect(result.enhancedSvg).toContain('href="#icon"');
    expect(result.enhancedSvg).not.toContain('xlink:href=');
    expect(result.report.modernizedSyntax).toBe(1);
  });

  it('href가 이미 있으면 href 값을 보존하고 xlink:href만 제거한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#modern" xlink:href="#legacy"/></svg>';

    const result = enhanceBrowserCompatibility(svg, {
      addNamespaces: false,
      fixDimensions: false,
      addPreserveAspectRatio: false,
    });

    expect(result.enhancedSvg).toContain('href="#modern"');
    expect(result.enhancedSvg).not.toContain('href="#legacy"');
    expect(result.enhancedSvg).not.toContain('xlink:href=');
    expect(result.report.modernizedSyntax).toBe(1);
  });
});

describe('내부 헬퍼 — toMsg', () => {
  it('Error 인스턴스는 message 속성 값을 반환한다', () => {
    expect(toMsg(new Error('오류 메시지'))).toBe('오류 메시지');
  });

  it('문자열 입력은 그대로 반환한다', () => {
    expect(toMsg('문자열 오류')).toBe('문자열 오류');
  });

  it('일반 객체는 String() 변환 결과를 반환한다', () => {
    expect(toMsg({ code: 42 })).toBe('[object Object]');
  });

  it('숫자 입력은 숫자 문자열로 변환한다', () => {
    expect(toMsg(404)).toBe('404');
  });
});

describe('내부 헬퍼 — isValidBBox', () => {
  it('유한 좌표와 양수 크기는 true를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: 0, width: 100, height: 50 })).toBe(true);
  });

  it('좌표가 음수여도 유한하면 true를 반환한다', () => {
    expect(isValidBBox({ minX: -50, minY: -30, width: 100, height: 50 })).toBe(true);
  });

  it('minX가 NaN이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: Number.NaN, minY: 0, width: 100, height: 50 })).toBe(false);
  });

  it('minY가 Infinity이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: Infinity, width: 100, height: 50 })).toBe(false);
  });

  it('width가 0이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: 0, width: 0, height: 50 })).toBe(false);
  });

  it('width가 음수이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: 0, width: -1, height: 50 })).toBe(false);
  });

  it('height가 0이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: 0, width: 100, height: 0 })).toBe(false);
  });

  it('height가 음수이면 false를 반환한다', () => {
    expect(isValidBBox({ minX: 0, minY: 0, width: 100, height: -1 })).toBe(false);
  });
});

describe('내부 헬퍼 — isBrowser', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('jsdom 환경에서 window와 document가 모두 있으면 true를 반환한다', () => {
    expect(isBrowser()).toBe(true);
  });

  it('window가 undefined이면 false를 반환한다', () => {
    // 환경 의존 분기를 vi.stubGlobal로 시뮬레이션한다
    vi.stubGlobal('window', undefined);
    expect(isBrowser()).toBe(false);
  });

  it('document가 undefined이면 false를 반환한다', () => {
    // window는 존재하고 document만 제거해 && 두 번째 피연산자의 false 측을 겨냥한다
    vi.stubGlobal('document', undefined);
    expect(isBrowser()).toBe(false);
  });
});

describe('내부 헬퍼 — heuristicBBoxFromString', () => {
  it('circle만 포함하면 원의 경계 BBox를 반환한다', () => {
    // cx=50, cy=50, r=40 → [10..90, 10..90]
    const svg = '<svg><circle cx="50" cy="50" r="40"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 10, minY: 10, width: 80, height: 80 });
  });

  it('rect만 포함하면 사각형 경계 BBox를 반환한다', () => {
    const svg = '<svg><rect x="10" y="20" width="100" height="50"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
  });

  it('circle과 rect가 모두 있으면 합산 BBox를 반환한다', () => {
    // circle: cx=200, cy=200, r=50 → [150..250, 150..250]
    // rect: x=0, y=0, w=100, h=100 → [0..100, 0..100]
    // 합산: minX=0, minY=0, maxX=250, maxY=250
    const svg = '<svg><circle cx="200" cy="200" r="50"/><rect x="0" y="0" width="100" height="100"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 0, minY: 0, width: 250, height: 250 });
  });

  it('인식 가능한 도형이 없으면 null을 반환한다', () => {
    const svg = '<svg><path d="M10 10 L90 90"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('빈 문자열은 null을 반환한다', () => {
    expect(heuristicBBoxFromString('')).toBeNull();
  });

  it('반지름이 0인 circle은 null을 반환한다', () => {
    // r > 0 가드 거짓 분기: r=0 이면 BBox 기여 없이 null
    const svg = '<svg><circle cx="50" cy="50" r="0"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('폭이 0인 rect는 null을 반환한다', () => {
    // w > 0 && h > 0 가드의 첫째 피연산자 거짓 분기
    const svg = '<svg><rect x="10" y="10" width="0" height="50"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('높이가 0인 rect는 null을 반환한다', () => {
    // w > 0 && h > 0 가드의 둘째 피연산자 거짓 분기
    const svg = '<svg><rect x="10" y="10" width="50" height="0"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });
});

describe('내부 헬퍼 — heuristicBBox', () => {
  /** jsdom DOMParser로 SVG 내부 마크업을 파싱해 루트 요소를 반환한다. */
  const parseSvg = (inner: string): Element => {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
      'image/svg+xml'
    );
    return doc.documentElement;
  };

  it('rect 요소에서 BBox를 계산한다', () => {
    const root = parseSvg('<rect x="10" y="20" width="100" height="50"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
  });

  it('circle 요소에서 BBox를 계산한다', () => {
    // cx=50, cy=50, r=40 → [10..90, 10..90]
    const root = parseSvg('<circle cx="50" cy="50" r="40"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 10, width: 80, height: 80 });
  });

  it('ellipse 요소에서 BBox를 계산한다', () => {
    // cx=100, cy=60, rx=80, ry=40 → [20..180, 20..100]
    const root = parseSvg('<ellipse cx="100" cy="60" rx="80" ry="40"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 20, minY: 20, width: 160, height: 80 });
  });

  it('line 요소에서 BBox를 계산한다', () => {
    const root = parseSvg('<line x1="10" y1="20" x2="90" y2="80"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 20, width: 80, height: 60 });
  });

  it('polyline 요소에서 BBox를 계산한다', () => {
    // points: (10,10) (90,80) (50,5) → minX=10, minY=5, maxX=90, maxY=80
    const root = parseSvg('<polyline points="10,10 90,80 50,5"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 5, width: 80, height: 75 });
  });

  it('polygon 요소에서 BBox를 계산한다', () => {
    // points: (0,0) (100,0) (50,80) → minX=0, minY=0, maxX=100, maxY=80
    const root = parseSvg('<polygon points="0,0 100,0 50,80"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 0, minY: 0, width: 100, height: 80 });
  });

  it('인식 가능한 도형이 없으면 null을 반환한다', () => {
    const root = parseSvg('<path d="M10 10 L90 90"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('폭이 0인 rect는 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<rect x="0" y="0" width="0" height="50"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('반지름이 0인 circle은 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<circle cx="50" cy="50" r="0"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('rx가 0인 ellipse는 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<ellipse cx="50" cy="50" rx="0" ry="40"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('points 속성이 비어 있는 polyline은 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<polyline points=""/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('points 속성이 비어 있는 polygon은 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<polygon points=""/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('높이가 0인 rect는 BBox 계산에서 무시한다', () => {
    // w > 0 && h > 0 가드의 둘째 피연산자 거짓 분기: h=0 이면 무시
    const root = parseSvg('<rect x="0" y="0" width="100" height="0"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('ry가 0인 ellipse는 BBox 계산에서 무시한다', () => {
    // rx > 0 && ry > 0 가드의 둘째 피연산자 거짓 분기: ry=0 이면 무시
    const root = parseSvg('<ellipse cx="50" cy="50" rx="40" ry="0"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('x 좌표가 NaN인 points 항목은 건너뛰고 도형이 없으면 null을 반환한다', () => {
    // Number.isFinite(x) 거짓 분기: 비숫자 x 좌표는 무시된다
    const root = parseSvg('<polyline points="a,b"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('y 좌표가 NaN인 points 항목은 건너뛰고 도형이 없으면 null을 반환한다', () => {
    // Number.isFinite(y) 거짓 분기: x는 유한하지만 y가 비숫자인 좌표는 무시된다
    const root = parseSvg('<polyline points="10,a"/>');
    expect(heuristicBBox(root)).toBeNull();
  });
});

describe('내부 헬퍼 — padBBox', () => {
  const base = { minX: 10, minY: 20, width: 100, height: 50 };

  it('양수 비율을 주면 사방에 패딩이 반영된 BBox를 반환한다', () => {
    // dx = 100 * 0.1 = 10, dy = 50 * 0.1 = 5
    const result = padBBox(base, 0.1);
    expect(result).toEqual({ minX: 0, minY: 15, width: 120, height: 60 });
  });

  it('5% 패딩은 크기를 10% 증가시킨다', () => {
    // dx = 100 * 0.05 = 5, dy = 50 * 0.05 = 2.5
    const result = padBBox(base, 0.05);
    expect(result).toEqual({ minX: 5, minY: 17.5, width: 110, height: 55 });
  });

  it('pct가 0이면 원본 BBox 참조를 그대로 반환한다', () => {
    expect(padBBox(base, 0)).toBe(base);
  });

  it('pct가 음수이면 원본 BBox 참조를 그대로 반환한다', () => {
    expect(padBBox(base, -0.1)).toBe(base);
  });
});

const SVG_NS = 'http://www.w3.org/2000/svg';

/** width/height/style 속성을 지정한 SVG 루트 요소를 만든다. */
function createSvgRoot(attrs: Record<string, string>): SVGSVGElement {
  const root = document.createElementNS(SVG_NS, 'svg');
  for (const [name, value] of Object.entries(attrs)) {
    root.setAttribute(name, value);
  }
  return root;
}

describe('치수 헬퍼 — parseCssLength', () => {
  it('빈 값/null/undefined는 value·unit 모두 null이다', () => {
    expect(parseCssLength(undefined)).toEqual({ value: null, unit: null });
    expect(parseCssLength(null)).toEqual({ value: null, unit: null });
    expect(parseCssLength('')).toEqual({ value: null, unit: null });
  });

  it('단위 없는 숫자는 user unit(unit=null)으로 본다', () => {
    expect(parseCssLength('100')).toEqual({ value: 100, unit: null });
  });

  it('단위가 붙은 값은 소문자 단위로 분리한다', () => {
    expect(parseCssLength('100PX')).toEqual({ value: 100, unit: 'px' });
    expect(parseCssLength('50%')).toEqual({ value: 50, unit: '%' });
  });

  it('음수·소수·지수 표기를 모두 받아들인다', () => {
    expect(parseCssLength('-1.5e-3')).toEqual({ value: -0.0015, unit: null });
  });

  it('형식에 맞지 않는 문자열은 null을 반환한다', () => {
    expect(parseCssLength('abc')).toEqual({ value: null, unit: null });
    expect(parseCssLength('10 20')).toEqual({ value: null, unit: null });
  });

  it('유한값이 아닌 결과(예: 1e999)는 null로 보정한다', () => {
    expect(parseCssLength('1e999')).toEqual({ value: null, unit: null });
  });
});

describe('치수 헬퍼 — getStyleLength', () => {
  it('style 속성이 없으면 null을 반환한다', () => {
    const root = createSvgRoot({});
    expect(getStyleLength(root, 'width')).toBeNull();
  });

  it('style에서 해당 프로퍼티 값을 잘라 반환한다', () => {
    const root = createSvgRoot({ style: 'width: 120px; height: 60px' });
    expect(getStyleLength(root, 'width')).toBe('120px');
    expect(getStyleLength(root, 'height')).toBe('60px');
  });

  it('style에 해당 프로퍼티가 없으면 null을 반환한다', () => {
    const root = createSvgRoot({ style: 'fill: red' });
    expect(getStyleLength(root, 'width')).toBeNull();
  });
});

describe('치수 헬퍼 — extractSizeHints', () => {
  it('width/height attribute를 우선 사용한다', () => {
    const root = createSvgRoot({ width: '200', height: '100' });
    expect(extractSizeHints(root)).toEqual({ wAttr: '200', hAttr: '100' });
  });

  it('attribute가 없으면 style 길이로 폴백한다', () => {
    const root = createSvgRoot({ style: 'width: 80px; height: 40px' });
    expect(extractSizeHints(root)).toEqual({ wAttr: '80px', hAttr: '40px' });
  });

  it('attribute와 style이 모두 없으면 undefined를 반환한다', () => {
    const root = createSvgRoot({});
    expect(extractSizeHints(root)).toEqual({ wAttr: undefined, hAttr: undefined });
  });
});

describe('치수 헬퍼 — sanitizeNum', () => {
  it('유한값은 소수점 6자리로 정리한다', () => {
    expect(sanitizeNum(1.23456789)).toBe(1.234568);
    expect(sanitizeNum(10)).toBe(10);
  });

  it('유한값이 아니면 0으로 보정한다', () => {
    expect(sanitizeNum(Number.POSITIVE_INFINITY)).toBe(0);
    expect(sanitizeNum(Number.NaN)).toBe(0);
  });
});
