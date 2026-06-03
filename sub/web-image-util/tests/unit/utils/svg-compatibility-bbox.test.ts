/**
 * SVG 호환성 bbox 측정 경로 보강 단위 테스트.
 *
 * - computeBBox: live → DOM heuristic → string heuristic 폴백 순서 검증
 * - liveGetBBox: document.body 임시 부착/제거 계약 검증
 * - heuristicBBox: path/text 무시, 여러 도형 합산
 * - heuristicBBoxFromString: 미지원 도형 null, 지원 도형 합산
 * - padBBox: 0 이하 padding 원본 유지, 양수 padding 사방 확장
 *
 * jsdom 환경에서 SVGGraphicsElement.getBBox는 미구현 가능성이 높으므로
 * 각 describe에서 vi.spyOn으로 최소 mock을 만들고 afterEach에서 복구한다.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { computeBBox } from '../../../src/utils/svg-compatibility/bbox/compute.internal';
import {
  heuristicBBox,
  heuristicBBoxFromString,
  padBBox,
} from '../../../src/utils/svg-compatibility/bbox/heuristic.internal';
import { liveGetBBox } from '../../../src/utils/svg-compatibility/bbox/live.internal';
import type { SvgCompatibilityReport } from '../../../src/utils/svg-compatibility/options';

// jsdom이 SVGGraphicsElement.prototype.getBBox를 구현하지 않을 수 있으므로
// 없으면 spy 설치 전에 최소 stub을 추가한다.
beforeAll(() => {
  const proto = SVGGraphicsElement.prototype as unknown as Record<string, unknown>;
  if (typeof proto.getBBox !== 'function') {
    proto.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
  }
});

/** DOMParser로 SVG 루트 요소를 파싱한다. */
function parseSvg(inner: string): Element {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`,
    'image/svg+xml'
  );
  return doc.documentElement;
}

/** SVGSVGElement를 document.createElementNS로 직접 생성한다. */
function makeSvgRoot(): SVGSVGElement {
  const root = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '100');
  rect.setAttribute('height', '50');
  root.appendChild(rect);
  return root;
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

/** 테스트용 opts를 만든다. 모든 필드를 채운다. */
function makeOpts(
  overrides: Partial<{
    enableLiveBBox: boolean;
    enableHeuristicBBox: boolean;
    mode: 'preserve-framing' | 'fit-content';
    paddingPercent: number;
    addNamespaces: boolean;
    fixDimensions: boolean;
    modernizeSyntax: boolean;
    addPreserveAspectRatio: boolean;
    preferResponsive: boolean;
    ensureNonZeroViewport: boolean;
    defaultSize: { width: number; height: number };
  }> = {}
) {
  return {
    enableLiveBBox: false,
    enableHeuristicBBox: true,
    mode: 'preserve-framing' as const,
    paddingPercent: 0,
    addNamespaces: true,
    fixDimensions: true,
    modernizeSyntax: true,
    addPreserveAspectRatio: true,
    preferResponsive: true,
    ensureNonZeroViewport: true,
    defaultSize: { width: 512, height: 512 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// heuristicBBox — path/text 무시, 여러 도형 합산
// ---------------------------------------------------------------------------
describe('heuristicBBox — path/text 무시 검증', () => {
  it('path 요소만 있으면 null을 반환한다', () => {
    const root = parseSvg('<path d="M0 0 L100 100"/>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('text 요소만 있으면 null을 반환한다', () => {
    const root = parseSvg('<text x="10" y="20">hello</text>');
    expect(heuristicBBox(root)).toBeNull();
  });

  it('rect와 path가 함께 있으면 rect 범위만 반영한다', () => {
    // path(M0 0 L200 200)는 무시되고 rect(0,0,100,50)만 BBox에 기여한다
    const root = parseSvg('<rect x="0" y="0" width="100" height="50"/><path d="M0 0 L200 200"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 0, minY: 0, width: 100, height: 50 });
  });

  it('rect·circle·ellipse·line·polygon 도형들의 합산 BBox를 반환한다', () => {
    // rect: (0,0)→(50,50)
    // circle: cx=100,cy=100,r=10 → (90,90)→(110,110)
    // 합산: minX=0, minY=0, maxX=110, maxY=110
    const root = parseSvg('<rect x="0" y="0" width="50" height="50"/>' + '<circle cx="100" cy="100" r="10"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 0, minY: 0, width: 110, height: 110 });
  });

  it('ellipse만 있으면 ellipse의 BBox를 반환한다', () => {
    // cx=50,cy=50,rx=30,ry=20 → minX=20, minY=30, maxX=80, maxY=70
    const root = parseSvg('<ellipse cx="50" cy="50" rx="30" ry="20"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 20, minY: 30, width: 60, height: 40 });
  });

  it('line만 있으면 두 끝점을 포함하는 BBox를 반환한다', () => {
    // x1=10,y1=20,x2=90,y2=80 → minX=10, minY=20, maxX=90, maxY=80
    const root = parseSvg('<line x1="10" y1="20" x2="90" y2="80"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 20, width: 80, height: 60 });
  });

  it('polyline만 있으면 모든 점을 포함하는 BBox를 반환한다', () => {
    // points: (10,20),(90,80),(50,0) → minX=10, minY=0, maxX=90, maxY=80
    const root = parseSvg('<polyline points="10,20 90,80 50,0"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 0, width: 80, height: 80 });
  });

  it('polygon만 있으면 모든 꼭짓점을 포함하는 BBox를 반환한다', () => {
    // points: (10,20),(90,80),(50,0) → minX=10, minY=0, maxX=90, maxY=80
    const root = parseSvg('<polygon points="10,20 90,80 50,0"/>');
    expect(heuristicBBox(root)).toEqual({ minX: 10, minY: 0, width: 80, height: 80 });
  });
});

// ---------------------------------------------------------------------------
// heuristicBBoxFromString — 지원/미지원 도형 경계
// ---------------------------------------------------------------------------
describe('heuristicBBoxFromString — 미지원 도형 케이스', () => {
  it('line 요소는 인식하지 않고 null을 반환한다', () => {
    // heuristicBBoxFromString은 rect/circle만 인식한다
    const svg = '<svg><line x1="0" y1="0" x2="100" y2="100"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('path 요소는 인식하지 않고 null을 반환한다', () => {
    const svg = '<svg><path d="M0 0 L100 100"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });

  it('rect와 circle이 함께 있으면 합산 BBox를 반환한다', () => {
    // rect: (0,0)→(50,50)
    // circle: cx=80,cy=80,r=20 → (60,60)→(100,100)
    // 합산: minX=0, minY=0, maxX=100, maxY=100
    const svg = '<svg><rect x="0" y="0" width="50" height="50"/><circle cx="80" cy="80" r="20"/></svg>';
    expect(heuristicBBoxFromString(svg)).toEqual({ minX: 0, minY: 0, width: 100, height: 100 });
  });

  it('인식 가능한 도형이 없으면 null을 반환한다', () => {
    const svg = '<svg><ellipse cx="50" cy="50" rx="40" ry="30"/></svg>';
    expect(heuristicBBoxFromString(svg)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// padBBox — padding 방향 및 원본 유지 계약
// ---------------------------------------------------------------------------
describe('padBBox — 사방 확장 및 원본 유지', () => {
  const base = { minX: 0, minY: 0, width: 100, height: 200 };

  it('0 padding은 원본 객체 참조를 그대로 반환한다', () => {
    expect(padBBox(base, 0)).toBe(base);
  });

  it('음수 padding은 원본 객체 참조를 그대로 반환한다', () => {
    expect(padBBox(base, -5)).toBe(base);
  });

  it('양수 padding은 사방(상·하·좌·우)을 모두 확장한다', () => {
    // dx = 100 * 0.1 = 10, dy = 200 * 0.1 = 20
    // minX = 0 - 10 = -10, minY = 0 - 20 = -20
    // width = 100 + 2*10 = 120, height = 200 + 2*20 = 240
    const result = padBBox(base, 0.1);
    expect(result.minX).toBe(-10);
    expect(result.minY).toBe(-20);
    expect(result.width).toBe(120);
    expect(result.height).toBe(240);
  });

  it('양수 padding은 새 객체를 반환해 원본을 변이하지 않는다', () => {
    const result = padBBox(base, 0.05);
    expect(result).not.toBe(base);
    expect(base.minX).toBe(0);
    expect(base.minY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeBBox — live → DOM heuristic → string heuristic 폴백 순서
// ---------------------------------------------------------------------------
describe('computeBBox — 전략 선택 및 폴백 순서', () => {
  let getBBoxSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    getBBoxSpy?.mockRestore();
    getBBoxSpy = undefined;
  });

  it('enableLiveBBox가 false이면 live를 시도하지 않고 heuristic으로 처리한다', () => {
    const root = parseSvg('<rect x="5" y="5" width="90" height="40"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: false, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report);

    expect(result).toEqual({ minX: 5, minY: 5, width: 90, height: 40 });
    // live를 시도하지 않았으므로 live 성공 메시지 없음
    expect(report.infos).not.toContain('BBox computed via live getBBox.');
    // 경고도 없어야 한다
    expect(report.warnings).toHaveLength(0);
    expect(report.infos).toContain('BBox computed via heuristic scan.');
  });

  it('enableHeuristicBBox가 false이면 heuristic 없이 null을 반환한다', () => {
    const root = parseSvg('<rect x="0" y="0" width="100" height="50"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: false, enableHeuristicBBox: false });

    const result = computeBBox(root, opts, report);

    expect(result).toBeNull();
    expect(report.infos).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
  });

  it('live getBBox 성공 시 즉시 반환하고 infos에 live 메시지를 남긴다', () => {
    // SVGGraphicsElement.prototype.getBBox를 mock해 유효한 BBox를 반환한다
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      top: 20,
      right: 110,
      bottom: 70,
      left: 10,
      toJSON: () => ({}),
    } as DOMRect);

    const root = parseSvg('<rect x="0" y="0" width="100" height="50"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: true, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report);

    expect(result).toEqual({ minX: 10, minY: 20, width: 100, height: 50 });
    expect(report.infos).toContain('BBox computed via live getBBox.');
    // live 성공 시 heuristic은 호출하지 않아야 한다
    expect(report.infos).not.toContain('BBox computed via heuristic scan.');
    expect(report.warnings).toHaveLength(0);
  });

  it('live getBBox가 빈 BBox를 반환하면 경고를 남기고 DOM heuristic으로 폴백한다', () => {
    // 폭/높이가 0인 BBox → isValidBBox 거짓 → "Live getBBox returned empty." 경고
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const root = parseSvg('<rect x="0" y="0" width="100" height="50"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: true, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report);

    expect(report.warnings).toContain('Live getBBox returned empty.');
    // heuristic으로 폴백되어 결과가 있어야 한다
    expect(result).not.toBeNull();
    expect(report.infos).toContain('BBox computed via heuristic scan.');
  });

  it('live getBBox가 예외를 던지면 경고 메시지를 남기고 DOM heuristic으로 폴백한다', () => {
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockImplementation(() => {
      throw new Error('getBBox 미구현');
    });

    const root = parseSvg('<rect x="10" y="10" width="80" height="40"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: true, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report);

    expect(report.warnings.some((w) => w.startsWith('Live getBBox failed:'))).toBe(true);
    // heuristic으로 폴백되어 결과가 있어야 한다
    expect(result).not.toBeNull();
    expect(report.infos).toContain('BBox computed via heuristic scan.');
  });

  it('DOM heuristic이 null을 반환하면 string heuristic으로 폴백한다', () => {
    // path만 있는 root → DOM heuristic null, svgString에는 rect 포함
    const root = parseSvg('<path d="M0 0 L100 100"/>');
    const svgString = '<svg><rect x="0" y="0" width="50" height="30"/></svg>';
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: false, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report, svgString);

    // string heuristic이 rect를 인식해 결과를 반환한다
    expect(result).not.toBeNull();
    expect(report.infos).toContain('BBox computed via string-based heuristic.');
    expect(report.infos).not.toContain('BBox computed via heuristic scan.');
  });

  it('모든 폴백이 실패하면 null을 반환한다', () => {
    // root에도 svgString에도 인식 가능한 도형이 없다
    const root = parseSvg('<path d="M0 0 L100 100"/>');
    const svgString = '<svg><path d="M0 0 L100 100"/></svg>';
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: false, enableHeuristicBBox: true });

    const result = computeBBox(root, opts, report, svgString);

    expect(result).toBeNull();
    expect(report.infos).toHaveLength(0);
  });

  it('svgString이 없으면 string heuristic을 시도하지 않아 null을 반환한다', () => {
    const root = parseSvg('<path d="M0 0 L100 100"/>');
    const report = makeReport();
    const opts = makeOpts({ enableLiveBBox: false, enableHeuristicBBox: true });

    // svgString 인수를 전달하지 않는다
    const result = computeBBox(root, opts, report);

    expect(result).toBeNull();
    expect(report.infos).not.toContain('BBox computed via string-based heuristic.');
  });
});

// ---------------------------------------------------------------------------
// liveGetBBox — document.body 부착/제거 계약
// ---------------------------------------------------------------------------
describe('liveGetBBox — DOM 부착/제거 계약', () => {
  let getBBoxSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    getBBoxSpy?.mockRestore();
    getBBoxSpy = undefined;
  });

  it('getBBox 성공 시 임시 SVG를 document.body에서 제거한다', () => {
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const before = document.body.childElementCount;
    liveGetBBox(makeSvgRoot());
    expect(document.body.childElementCount).toBe(before);
  });

  it('getBBox 예외 발생 시에도 임시 SVG를 document.body에서 제거한다', () => {
    // finally 블록이 예외보다 먼저 정리하므로 body 개수는 원래대로 돌아간다
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockImplementation(() => {
      throw new Error('getBBox 미구현');
    });

    const before = document.body.childElementCount;
    // liveGetBBox는 getBBox 예외를 다시 던진다
    expect(() => liveGetBBox(makeSvgRoot())).toThrow();
    expect(document.body.childElementCount).toBe(before);
  });

  it('getBBox가 유효하지 않은 BBox를 반환하면 null을 반환하고 임시 SVG를 document.body에서 제거한다', () => {
    // 폭/높이가 0 → isValidBBox 거짓 → null, 단 finally 블록이 항상 cleanup을 수행한다
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const before = document.body.childElementCount;
    const result = liveGetBBox(makeSvgRoot());
    expect(result).toBeNull();
    expect(document.body.childElementCount).toBe(before);
  });

  it('getBBox가 유효한 BBox를 반환하면 { minX, minY, width, height } 형태로 변환한다', () => {
    getBBoxSpy = vi.spyOn(SVGGraphicsElement.prototype, 'getBBox').mockReturnValue({
      x: 5,
      y: 15,
      width: 80,
      height: 60,
      top: 15,
      right: 85,
      bottom: 75,
      left: 5,
      toJSON: () => ({}),
    } as DOMRect);

    const result = liveGetBBox(makeSvgRoot());
    expect(result).toEqual({ minX: 5, minY: 15, width: 80, height: 60 });
  });
});
