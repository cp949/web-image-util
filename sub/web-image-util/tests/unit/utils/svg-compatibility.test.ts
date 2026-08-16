/**
 * SVG 호환성 보정 유틸리티의 회귀 동작을 검증한다.
 * 공개 API(enhanceBrowserCompatibility)와 파이프라인 전용 facade
 * (enhanceSvgForBrowserWithDimensions), 내부 헬퍼(toMsg, isValidBBox, isBrowser,
 * heuristicBBoxFromString, heuristicBBox, padBBox, applyViewBoxPolicy)를 직접 검증한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceBrowserCompatibility } from '../../../src/utils/svg-compatibility';
import {
  heuristicBBox,
  heuristicBBoxFromString,
  padBBox,
} from '../../../src/utils/svg-compatibility/bbox/heuristic.internal';
import { isBrowser, isValidBBox } from '../../../src/utils/svg-compatibility/bbox/live.internal';
import {
  extractSizeHints,
  getStyleLength,
  sanitizeNum,
} from '../../../src/utils/svg-compatibility/dimensions.internal';
import { enhanceSvgForBrowser, enhanceSvgForBrowserWithDimensions } from '../../../src/utils/svg-compatibility/enhance';
import { toMsg } from '../../../src/utils/svg-compatibility/message.internal';
import {
  DEFAULT_OPTIONS,
  SVG_RENDERING_OPTIONS,
  type SvgCompatibilityReport,
} from '../../../src/utils/svg-compatibility/options';
import { applyViewBoxPolicy } from '../../../src/utils/svg-compatibility/viewbox-policy.internal';
import { extractSvgDimensions } from '../../../src/utils/svg-dimensions';

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

  it('퍼센트 단위 도형만 있으면 콘텐츠 BBox 대신 defaultSize로 폴백한다', () => {
    // %는 뷰포트 기준 상대값이라 user unit으로 읽으면 좌표계가 어긋난다
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10%" y="10%" width="80%" height="80%" fill="red"/></svg>';

    const result = enhanceBrowserCompatibility(svg, { mode: 'fit-content' });

    expect(result.enhancedSvg).toContain('viewBox="0 0 512 512"');
    expect(result.report.warnings.some((w) => w.includes('Content bbox unavailable'))).toBe(true);
  });

  it('단위 없는 도형은 콘텐츠 BBox로 viewBox를 계산한다', () => {
    // 위 퍼센트 케이스의 대조군: 기존 동작이 유지되는지 확인한다
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80" fill="red"/></svg>';

    const result = enhanceBrowserCompatibility(svg, { mode: 'fit-content' });

    expect(result.enhancedSvg).toContain('viewBox="10 10 80 80"');
  });
});

describe('enhanceSvgForBrowserWithDimensions()', () => {
  it('viewBox가 이미 있으면 dimensions가 extractSvgDimensions()와 같다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"><rect width="10" height="10"/></svg>';

    const { dimensions } = enhanceSvgForBrowserWithDimensions(svg);

    expect(dimensions).toEqual(extractSvgDimensions(svg));
  });

  it('viewBox가 없고 콘텐츠 BBox로 계산되면 dimensions가 extractSvgDimensions()와 같다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80"/></svg>';

    const { dimensions } = enhanceSvgForBrowserWithDimensions(svg);

    expect(dimensions).toEqual(extractSvgDimensions(svg));
    expect(dimensions.width).toBe(80);
    expect(dimensions.height).toBe(80);
  });

  it('viewBox와 콘텐츠 단서가 모두 없으면 dimensions가 defaultSize로 폴백하고 extractSvgDimensions()와 같다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

    const { dimensions } = enhanceSvgForBrowserWithDimensions(svg);

    expect(dimensions).toEqual(extractSvgDimensions(svg));
    expect(dimensions.width).toBe(512);
    expect(dimensions.height).toBe(512);
  });

  it('enhancedSvg는 enhanceSvgForBrowser()를 따로 호출했을 때와 같은 문자열을 반환한다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80"/></svg>';

    const { enhancedSvg } = enhanceSvgForBrowserWithDimensions(svg);

    expect(enhancedSvg).toBe(enhanceSvgForBrowser(svg));
  });

  it('viewBox 속성은 있지만 값이 깨진 경우 extractSvgDimensions()로 폴백해 같은 결과를 낸다', () => {
    // hasAttribute('viewBox')는 true지만 parseViewBoxValues는 실패하는 경계 —
    // applyViewBoxPolicy()가 null을 반환해 extractSvgDimensions() 폴백을 강제로 태운다.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300"></svg>';

    const { dimensions } = enhanceSvgForBrowserWithDimensions(svg);

    expect(dimensions).toEqual(extractSvgDimensions(svg));
    expect(dimensions.width).toBe(512);
    expect(dimensions.height).toBe(512);
  });

  it('파싱된 루트가 <svg>가 아니면(중첩 svg 포함) extractSvgDimensions()로 폴백해 동일한 결과를 낸다', () => {
    // parseAndClassifySvg()는 documentElement 태그만 보고 root를 판정하므로 루트가 div면
    // 'other'로 분류되어 core가 dimensions를 null로 남긴다. 반면 extractSvgDimensions()는
    // querySelector('svg')로 문서 전체에서 중첩된 <svg>를 찾아낸다 — 두 함수가 측정 대상
    // 요소 자체가 달라지는 유일한 분기이며, dimensions: null 폴백이 이 차이를 흡수한다.
    const svg =
      '<div xmlns="http://www.w3.org/1999/xhtml"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"></svg></div>';

    const { dimensions } = enhanceSvgForBrowserWithDimensions(svg);

    expect(dimensions).toEqual(extractSvgDimensions(svg));
    expect(dimensions.width).toBe(40);
    expect(dimensions.height).toBe(20);
  });

  it('파싱 실패 입력은 extractSvgDimensions()와 동일하게 에러를 던진다', () => {
    const notSvg = '<html><body></body></html>';

    expect(() => enhanceSvgForBrowserWithDimensions(notSvg)).toThrow('Invalid SVG');
    expect(() => extractSvgDimensions(notSvg)).toThrow('Invalid SVG');
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

  it('퍼센트 단위 rect는 무시하고 null을 반환한다', () => {
    // %는 뷰포트 기준 상대값이라 이 시점에 환산 기준이 없다
    const svg = '<svg><rect x="10%" y="10%" width="80%" height="80%"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('퍼센트 단위 circle은 무시하고 null을 반환한다', () => {
    const svg = '<svg><circle cx="50%" cy="50%" r="40%"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('px 단위 도형은 user unit과 동일하게 계산한다', () => {
    const svg = '<svg><rect x="10px" y="20px" width="100px" height="50px"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
  });

  it('퍼센트 도형과 단위 없는 도형이 섞이면 단위 없는 도형만 계산한다', () => {
    const svg =
      '<svg><rect x="0%" y="0%" width="100%" height="100%"/><rect x="10" y="20" width="100" height="50"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
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

  it('퍼센트 단위 rect는 BBox 계산에서 무시한다', () => {
    // %는 뷰포트 기준 상대값이라 이 시점에 환산 기준이 없다
    const root = parseSvg('<rect x="10%" y="10%" width="80%" height="80%"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('퍼센트 단위 circle은 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<circle cx="50%" cy="50%" r="40%"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('퍼센트 단위 ellipse는 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<ellipse cx="50%" cy="50%" rx="40%" ry="30%"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('퍼센트 단위 line은 BBox 계산에서 무시한다', () => {
    const root = parseSvg('<line x1="10%" y1="20%" x2="90%" y2="80%"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('em·vw 등 다른 상대 단위 도형도 BBox 계산에서 무시한다', () => {
    const emRoot = parseSvg('<rect x="1em" y="1em" width="10em" height="5em"/>');
    expect(heuristicBBox(emRoot)).toBeNull();

    const vwRoot = parseSvg('<circle cx="50vw" cy="50vh" r="10vw"/>');
    expect(heuristicBBox(vwRoot)).toBeNull();
  });

  it('px 단위 도형은 user unit과 동일하게 계산한다', () => {
    const root = parseSvg('<rect x="10px" y="20px" width="100px" height="50px"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
  });

  it('단위가 붙은 points 좌표는 건너뛴다', () => {
    // points는 <number> 목록이라 단위 접미사가 허용되지 않는다
    const root = parseSvg('<polyline points="10%,10% 90%,80%"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('퍼센트 도형과 단위 없는 도형이 섞이면 단위 없는 도형만 계산한다', () => {
    // 배경용 100% rect는 무시하고 실제 좌표를 가진 circle만 반영한다
    const root = parseSvg('<rect width="100%" height="100%"/><circle cx="200" cy="200" r="50"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 150, minY: 150, width: 100, height: 100 });
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

// 길이 파싱 자체(parseSvgLength)의 검증은 svg-length.test.ts가 담당한다.

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

describe('기존 viewBox에서 width/height 주입 — 구분자와 공백', () => {
  it('콤마로 구분된 viewBox에서 크기를 주입한다', () => {
    const { enhancedSvg } = enhanceBrowserCompatibility('<svg viewBox="0,0,300,150"></svg>', {
      ensureNonZeroViewport: true,
    });
    expect(enhancedSvg).toContain('width="300"');
    expect(enhancedSvg).toContain('height="150"');
  });

  it('앞뒤 공백이 있는 viewBox에서도 크기를 주입한다', () => {
    const { enhancedSvg } = enhanceBrowserCompatibility('<svg viewBox=" 0 0 300 150 "></svg>', {
      ensureNonZeroViewport: true,
    });
    expect(enhancedSvg).toContain('width="300"');
    expect(enhancedSvg).toContain('height="150"');
  });

  it('값이 4개가 아닌 viewBox는 defaultSize로 폴백한다', () => {
    const { enhancedSvg } = enhanceBrowserCompatibility('<svg viewBox="0 0 300"></svg>', {
      ensureNonZeroViewport: true,
      defaultSize: { width: 64, height: 64 },
    });
    expect(enhancedSvg).toContain('width="64"');
    expect(enhancedSvg).toContain('height="64"');
  });
});

describe('width/height 단서로 viewBox 생성 — 공백 포함 값의 px 판정', () => {
  it('숫자와 단위 사이에 공백이 있으면 px 크기로 인정하지 않고 defaultSize로 폴백한다', () => {
    const { enhancedSvg, report } = enhanceBrowserCompatibility('<svg width="100 px" height="100 px"></svg>');
    expect(enhancedSvg).toContain('viewBox="0 0 512 512"');
    expect(report.warnings).toContain('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  });

  it('숫자와 단위가 공백 없이 붙어있으면 정상적으로 px 크기로 인정한다', () => {
    const { enhancedSvg, report } = enhanceBrowserCompatibility('<svg width="100px" height="100px"></svg>');
    expect(enhancedSvg).toContain('viewBox="0 0 100 100"');
    expect(report.warnings).not.toContain('Non-px or partial size detected. Falling back to defaultSize for viewBox.');
  });
});

describe('내부 헬퍼 — applyViewBoxPolicy 반환값', () => {
  /** DOMParser로 SVG 루트 요소를 파싱한다. */
  function parseSvgRoot(svgString: string): Element {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    return doc.documentElement;
  }

  /** 테스트용 빈 리포트를 만든다. */
  function makeReport(): SvgCompatibilityReport {
    return {
      addedNamespaces: [],
      fixedDimensions: false,
      modernizedSyntax: 0,
      warnings: [],
      infos: [],
      processingTimeMs: 0,
    };
  }

  it('기존 viewBox를 보존하는 경우 null을 반환한다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
    const root = parseSvgRoot(svg);

    const result = applyViewBoxPolicy(root, SVG_RENDERING_OPTIONS, makeReport(), svg);

    expect(result).toBeNull();
  });

  it('viewBox가 없어 새로 계산하는 경우 DOM에 실제로 쓴 값을 그대로 반환한다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="80" height="80"/></svg>';
    const root = parseSvgRoot(svg);

    const result = applyViewBoxPolicy(root, SVG_RENDERING_OPTIONS, makeReport(), svg);

    expect(result).toEqual({ minX: 10, minY: 10, width: 80, height: 80 });
    expect(root.getAttribute('viewBox')).toBe('10 10 80 80');
  });

  it('콘텐츠 단서가 전혀 없으면 defaultSize로 보정된 값을 반환한다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    const root = parseSvgRoot(svg);

    const result = applyViewBoxPolicy(root, SVG_RENDERING_OPTIONS, makeReport(), svg);

    expect(result).toEqual({
      minX: 0,
      minY: 0,
      width: DEFAULT_OPTIONS.defaultSize.width,
      height: DEFAULT_OPTIONS.defaultSize.height,
    });
  });
});
