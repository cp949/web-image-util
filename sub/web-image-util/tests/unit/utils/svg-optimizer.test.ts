/**
 * SVG 최적화 오케스트레이터가 단계 옵션과 결과 metadata를 안정적으로 반환하는지 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { SvgOptimizer } from '../../../src/utils/svg-optimizer';
import { optimizeGradients } from '../../../src/utils/svg-optimizer/optimize-gradients';
import { removeUnusedDefs } from '../../../src/utils/svg-optimizer/remove-unused-defs';
import { simplifyPaths } from '../../../src/utils/svg-optimizer/simplify-paths';

describe('SVG 최적화', () => {
  it('기본 옵션은 안전한 단계들을 켜고 요소 병합은 끈다', () => {
    expect(SvgOptimizer.getDefaultOptions()).toEqual({
      removeMetadata: true,
      simplifyPaths: true,
      optimizeGradients: true,
      mergeElements: false,
      removeUnusedDefs: true,
      precision: 3,
    });
  });

  it('기본 최적화는 메타데이터와 불필요한 공백을 제거하고 결과 metadata를 반환한다', () => {
    const svg = `
      <?xml version="1.0"?>
      <!-- editor comment -->
      <svg width="10" height="10" xmlns:dc="http://purl.org/dc/elements/1.1/" data-name="sample">
        <title>sample title</title>
        <desc>sample description</desc>
        <rect id="box" x="0" y="0" width="10" height="10" style="" />
      </svg>
    `;

    const { optimizedSvg, result } = SvgOptimizer.optimize(svg);

    expect(optimizedSvg).toContain('<svg');
    expect(optimizedSvg).toContain('<rect');
    expect(optimizedSvg).not.toContain('<?xml');
    expect(optimizedSvg).not.toContain('editor comment');
    expect(optimizedSvg).not.toContain('<title>');
    expect(optimizedSvg).not.toContain('data-name');
    expect(optimizedSvg).not.toContain('id="box"');
    expect(result.originalSize).toBe(svg.length);
    expect(result.optimizedSize).toBe(optimizedSvg.length);
    expect(result.compressionRatio).toBeGreaterThan(0);
    expect(result.optimizations).toEqual([
      'metadata removal',
      'path simplification',
      'gradient optimization',
      'unused definitions removal',
      'whitespace cleanup',
    ]);
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('단계 옵션을 끄면 해당 최적화 이름과 결과 변환을 생략한다', () => {
    const svg = '<svg><title>keep</title><rect id="box" width="10" height="10" /></svg>';

    const { optimizedSvg, result } = SvgOptimizer.optimize(svg, {
      removeMetadata: false,
      simplifyPaths: false,
      optimizeGradients: false,
      mergeElements: false,
      removeUnusedDefs: false,
      precision: 3,
    });

    expect(optimizedSvg).toBe('<svg><title>keep</title><rect id="box" width="10" height="10" /></svg>');
    expect(result.optimizations).toEqual(['whitespace cleanup']);
    expect(result.compressionRatio).toBe(0);
  });
});

describe('removeUnusedDefs 내부 패스', () => {
  it('<defs>가 없는 SVG는 원본 문자열 그대로 반환한다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toBe(svg);
  });

  it('미사용 id는 <defs>에서 제거된다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="unused"/></defs>' +
      '<rect width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).not.toContain('id="unused"');
  });

  it('미사용 id를 모두 제거한 뒤 비워진 <defs>도 함께 제거된다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="gone"/></defs>' +
      '<rect width="10" height="10"/></svg>';
    const result = removeUnusedDefs(svg);
    expect(result).not.toContain('<defs');
  });

  it('fill="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="g1"><stop offset="0" stop-color="red"/></linearGradient></defs>' +
      '<rect fill="url(#g1)" width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="g1"');
  });

  it('stroke="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="g2"><stop offset="0" stop-color="blue"/></linearGradient></defs>' +
      '<rect stroke="url(#g2)" width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="g2"');
  });

  it('filter="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><filter id="f1"><feGaussianBlur stdDeviation="2"/></filter></defs>' +
      '<rect filter="url(#f1)" width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="f1"');
  });

  it('clip-path="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="c1"><rect width="5" height="5"/></clipPath></defs>' +
      '<rect clip-path="url(#c1)" width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="c1"');
  });

  it('mask="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><mask id="m1"><rect width="10" height="10" fill="white"/></mask></defs>' +
      '<rect mask="url(#m1)" width="10" height="10"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="m1"');
  });

  it('marker-start="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="mk1" markerWidth="10" markerHeight="10"><path d="M0,0 L10,5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="50" marker-start="url(#mk1)"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="mk1"');
  });

  it('marker-mid="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="mk2" markerWidth="10" markerHeight="10"><circle r="3" cx="5" cy="5"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="50" marker-mid="url(#mk2)"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="mk2"');
  });

  it('marker-end="url(#id)" 참조가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><marker id="mk3" markerWidth="10" markerHeight="10"><path d="M0,0 L10,5 L0,10"/></marker></defs>' +
      '<line x1="0" y1="0" x2="50" y2="50" marker-end="url(#mk3)"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="mk3"');
  });

  it('href="#id" 참조(<use>)가 있으면 해당 정의를 보존한다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs><symbol id="sym1" viewBox="0 0 10 10"><circle r="5" cx="5" cy="5"/></symbol></defs>' +
      '<use href="#sym1" x="0" y="0"/></svg>';
    expect(removeUnusedDefs(svg)).toContain('id="sym1"');
  });

  it('같은 <defs> 안에 사용 중인 id와 미사용 id가 공존할 때 미사용만 제거된다', () => {
    // 사용 중 id와 미사용 id가 같은 <defs>에 있을 때 제거 루프가 continue/remove를 함께 도는 경로를 자극한다.
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<linearGradient id="used"><stop offset="0" stop-color="red"/></linearGradient>' +
      '<linearGradient id="unused"/>' +
      '</defs>' +
      '<rect fill="url(#used)" width="10" height="10"/>' +
      '</svg>';
    const result = removeUnusedDefs(svg);
    expect(result).toContain('id="used"');
    expect(result).not.toContain('id="unused"');
  });
});

describe('optimizeGradients 내부 패스', () => {
  it('그라디언트가 없는 SVG는 직사각형 요소를 보존한 채 반환된다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    const result = optimizeGradients(svg);
    expect(result).toContain('<rect');
    expect(result).not.toContain('Gradient');
  });

  it('동일한 두 그라디언트 중 하나는 제거된다', () => {
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="ga">${sameDef}</linearGradient>` +
      `<linearGradient id="gb">${sameDef}</linearGradient>` +
      `</defs><rect fill="url(#ga)" width="10" height="10"/></svg>`;
    const result = optimizeGradients(svg);
    const gaCount = (result.match(/id="ga"/g) ?? []).length;
    const gbCount = (result.match(/id="gb"/g) ?? []).length;
    // ga 또는 gb 중 정확히 하나만 남아야 한다
    expect(gaCount + gbCount).toBe(1);
  });

  it('중복 그라디언트 제거 후 fill 참조가 살아남은 id로 재작성된다', () => {
    // ga가 먼저 등장하므로 ga가 살아남고 gb가 제거됨. gb를 가리키는 fill이 ga로 바뀜.
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="ga">${sameDef}</linearGradient>` +
      `<linearGradient id="gb">${sameDef}</linearGradient>` +
      `</defs><rect fill="url(#gb)" width="10" height="10"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('url(#ga)');
    expect(result).not.toContain('url(#gb)');
  });

  it('중복 그라디언트 제거 후 stroke 참조가 살아남은 id로 재작성된다', () => {
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="ga">${sameDef}</linearGradient>` +
      `<linearGradient id="gb">${sameDef}</linearGradient>` +
      `</defs><rect stroke="url(#gb)" width="10" height="10"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('url(#ga)');
    expect(result).not.toContain('url(#gb)');
  });

  it('동일한 두 radialGradient 중 하나는 제거된다', () => {
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<radialGradient id="ra" cx="0.5" cy="0.5" r="0.5">${sameDef}</radialGradient>` +
      `<radialGradient id="rb" cx="0.5" cy="0.5" r="0.5">${sameDef}</radialGradient>` +
      `</defs><circle fill="url(#ra)" cx="10" cy="10" r="10"/></svg>`;
    const result = optimizeGradients(svg);
    const raCount = (result.match(/id="ra"/g) ?? []).length;
    const rbCount = (result.match(/id="rb"/g) ?? []).length;
    // ra 또는 rb 중 정확히 하나만 남아야 한다
    expect(raCount + rbCount).toBe(1);
  });

  it('중복 radialGradient 제거 후 fill 참조가 살아남은 id로 재작성된다', () => {
    // ra가 먼저 등장하므로 ra가 살아남고 rb가 제거됨. rb를 가리키는 fill이 ra로 바뀜.
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<radialGradient id="ra" cx="0.5" cy="0.5" r="0.5">${sameDef}</radialGradient>` +
      `<radialGradient id="rb" cx="0.5" cy="0.5" r="0.5">${sameDef}</radialGradient>` +
      `</defs><circle fill="url(#rb)" cx="10" cy="10" r="10"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('url(#ra)');
    expect(result).not.toContain('url(#rb)');
  });

  it('서로 다른 두 그라디언트는 둘 다 보존된다 (stop-color 차이)', () => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="gx"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient>` +
      `<linearGradient id="gy"><stop offset="0" stop-color="green"/><stop offset="1" stop-color="yellow"/></linearGradient>` +
      `</defs>` +
      `<rect fill="url(#gx)" width="5" height="5"/>` +
      `<rect fill="url(#gy)" width="5" height="5"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('id="gx"');
    expect(result).toContain('id="gy"');
  });

  it('stop이 같아도 linearGradient 기하 속성(x1/y1/x2/y2)이 다르면 병합되지 않는다', () => {
    // hashGradient의 attrs 수집 줄(x1,y1,x2,y2)을 자극.
    // 색은 동일하고 방향만 다른 그라디언트가 잘못 병합되면 렌더 방향이 바뀐다.
    const stops = '<stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="h1" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>` +
      `<linearGradient id="h2" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>` +
      `</defs>` +
      `<rect fill="url(#h1)" width="5" height="5"/>` +
      `<rect fill="url(#h2)" width="5" height="5"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('id="h1"');
    expect(result).toContain('id="h2"');
  });

  it('stop이 같아도 radialGradient 기하 속성(cx/r)이 다르면 병합되지 않는다', () => {
    // hashGradient의 attrs 수집 줄(cx,cy,r)과 radialGradient 경로를 자극.
    const stops = '<stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<radialGradient id="r1" cx="0.5" cy="0.5" r="0.3">${stops}</radialGradient>` +
      `<radialGradient id="r2" cx="0.5" cy="0.5" r="0.8">${stops}</radialGradient>` +
      `</defs>` +
      `<circle fill="url(#r1)" cx="10" cy="10" r="10"/>` +
      `<circle fill="url(#r2)" cx="20" cy="20" r="10"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('id="r1"');
    expect(result).toContain('id="r2"');
  });

  it('기하 속성이 같아도 stop offset이 다르면 병합되지 않는다', () => {
    // hashGradient의 stop offset 항목을 자극.
    // 색은 같고 offset만 다른 stop을 가진 그라디언트가 병합되면 색 분포가 달라진다.
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="o1"><stop offset="0.2" stop-color="red"/><stop offset="0.8" stop-color="blue"/></linearGradient>` +
      `<linearGradient id="o2"><stop offset="0.0" stop-color="red"/><stop offset="1.0" stop-color="blue"/></linearGradient>` +
      `</defs>` +
      `<rect fill="url(#o1)" width="5" height="5"/>` +
      `<rect fill="url(#o2)" width="5" height="5"/></svg>`;
    const result = optimizeGradients(svg);
    expect(result).toContain('id="o1"');
    expect(result).toContain('id="o2"');
  });

  it('id가 없는 그라디언트는 건너뛰어 제거되지 않는다', () => {
    // no-id 그라디언트와 해시가 같은 id 있는 그라디언트가 공존할 때,
    // !currentId skip으로 no-id 그라디언트는 보존되고 id 있는 그라디언트도 제거되지 않는다.
    const sameDef = '<stop offset="0" stop-color="red"/>';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="gid">${sameDef}</linearGradient>` +
      `<linearGradient>${sameDef}</linearGradient>` +
      `</defs><rect fill="url(#gid)" width="10" height="10"/></svg>`;
    const result = optimizeGradients(svg);
    // id 있는 그라디언트는 보존된다
    expect(result).toContain('id="gid"');
    // no-id 그라디언트도 skip되어 제거되지 않고 남는다
    const linearCount = (result.match(/<linearGradient/g) ?? []).length;
    expect(linearCount).toBe(2);
  });
});

describe('simplifyPaths 내부 패스', () => {
  it('d 속성이 없는 SVG는 그대로 반환된다', () => {
    const svg = '<svg><rect width="10" height="10"/></svg>';
    expect(simplifyPaths(svg, 3)).toBe(svg);
  });

  it('precision=3일 때 소수점 4자리 이상의 수는 3자리로 절단된다', () => {
    const svg = '<svg><path d="M1.23456 5"/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).not.toContain('1.23456');
    expect(result).toContain('1.235');
  });

  it('precision=1일 때 소수점 2자리 이상의 수는 1자리로 절단된다', () => {
    const svg = '<svg><path d="M1.56 5"/></svg>';
    const result = simplifyPaths(svg, 1);
    expect(result).not.toContain('1.56');
    expect(result).toContain('1.6');
  });

  it('소수점 이하가 모두 0인 값은 trailing zero가 제거된다', () => {
    const svg = '<svg><path d="M1.000 2"/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).not.toContain('1.000');
    // trailing zero 제거 후 숫자 사이 공백도 콤마로 정리됨
    expect(result).toContain('d="M1,2"');
  });

  it('명령어 뒤의 공백은 제거된다', () => {
    const svg = '<svg><path d="M 10 20"/></svg>';
    const result = simplifyPaths(svg, 3);
    // 명령어 M 뒤 공백 제거 → M10
    expect(result).toContain('M10');
  });

  it('명령어 앞의 공백은 제거된다', () => {
    const svg = '<svg><path d="M10,20 L30,40"/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).not.toContain(' L');
    expect(result).toContain('L30,40');
  });

  it('콤마 주변 공백은 정리된다', () => {
    const svg = '<svg><path d="M10 , 20"/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).not.toContain(' , ');
    expect(result).toContain('10,20');
  });

  it('연속 공백은 단일 공백으로 축약된 뒤 숫자 사이 공백이 콤마로 정리된다', () => {
    // 숫자 3개 이상: \s+→' ' 단계 없이 (\d)\s+(\d) 한 번만 치환하면 두 번째 공백이 남아 '  '가 유지된다
    const svg = '<svg><path d="M1  2  3"/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).not.toContain('  ');
    expect(result).toContain('M1,2');
  });

  it('d 값 앞뒤 공백은 제거된다', () => {
    // 끝 공백은 명령어 앞/뒤 공백 단계에서 처리되지 않으므로 trim()만 제거함
    const svg = '<svg><path d="M10,20 "/></svg>';
    const result = simplifyPaths(svg, 3);
    expect(result).toContain('d="M10,20"');
  });
});

describe('SvgOptimizer 공개 표면 — 개별 패스 옵션 분기', () => {
  it('simplifyPaths: true이면 path 소수점이 단순화된다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.23456 2"/></svg>';
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
      precision: 3,
    });
    expect(optimizedSvg).not.toContain('1.23456');
  });

  it('optimizeGradients: true이면 동일한 그라디언트가 하나로 병합된다', () => {
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    // pa와 pb 모두 참조해야 removeUnusedDefs가 개입하지 않는다 — optimizeGradients 병합으로만 sum===1 가능
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="pa">${sameDef}</linearGradient>` +
      `<linearGradient id="pb">${sameDef}</linearGradient>` +
      `</defs>` +
      `<rect fill="url(#pa)" width="5" height="10"/>` +
      `<rect fill="url(#pb)" width="5" height="10"/>` +
      `</svg>`;
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
    });
    const paCount = (optimizedSvg.match(/id="pa"/g) ?? []).length;
    const pbCount = (optimizedSvg.match(/id="pb"/g) ?? []).length;
    expect(paCount + pbCount).toBe(1);
  });

  it('removeUnusedDefs: true이면 미사용 정의가 제거된다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="orphan"/></defs>' +
      '<rect width="10" height="10"/></svg>';
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
    });
    expect(optimizedSvg).not.toContain('id="orphan"');
  });

  it('simplifyPaths: false이면 path 소수점이 그대로 유지된다', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1.23456 2"/></svg>';
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
      simplifyPaths: false,
    });
    expect(optimizedSvg).toContain('1.23456');
  });

  it('removeUnusedDefs: false이면 미사용 정의가 보존된다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="orphan"/></defs>' +
      '<rect width="10" height="10"/></svg>';
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
      removeUnusedDefs: false,
    });
    expect(optimizedSvg).toContain('id="orphan"');
  });

  it('optimizeGradients: false이면 동일한 그라디언트 두 개가 모두 보존된다', () => {
    const sameDef = '<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>';
    // 양쪽 참조 fixture — removeUnusedDefs가 켜져 있어도 pa/pb 모두 참조되므로 개입하지 않음
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg"><defs>` +
      `<linearGradient id="pa">${sameDef}</linearGradient>` +
      `<linearGradient id="pb">${sameDef}</linearGradient>` +
      `</defs>` +
      `<rect fill="url(#pa)" width="5" height="10"/>` +
      `<rect fill="url(#pb)" width="5" height="10"/>` +
      `</svg>`;
    const { optimizedSvg } = SvgOptimizer.optimize(svg, {
      ...SvgOptimizer.getDefaultOptions(),
      removeMetadata: false,
      optimizeGradients: false,
    });
    expect(optimizedSvg).toContain('id="pa"');
    expect(optimizedSvg).toContain('id="pb"');
  });
});
