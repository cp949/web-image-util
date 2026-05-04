/**
 * DOMPurify 기반 strict SVG sanitizer의 보안 계약을 검증한다.
 */

import { describe, expect, it } from 'vitest';

import { sanitizeSvgStrict, sanitizeSvgStrictDetailed } from '../../src/svg-sanitizer';

describe('strict SVG sanitizer', () => {
  it('입력 바이트 크기가 maxBytes를 초과하면 정제 전에 차단한다', () => {
    const oversizedSvg = '<svg><text>가나다</text></svg>';

    expect(() => sanitizeSvgStrict(oversizedSvg, { maxBytes: 20 })).toThrow(/maxBytes|입력 크기/);
  });

  it('정제 후 노드 개수가 maxNodeCount를 초과하면 차단한다', () => {
    const svg = '<svg><g><rect/><circle/></g></svg>';

    expect(() => sanitizeSvgStrict(svg, { maxNodeCount: 2 })).toThrow(/노드 개수/);
  });

  it('DOCTYPE과 ENTITY 선언을 제거하고 경고를 반환한다', () => {
    const result = sanitizeSvgStrictDetailed(`
      <!DOCTYPE svg [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <svg xmlns="http://www.w3.org/2000/svg">
        <text>&xxe;</text>
      </svg>
    `);

    expect(result.svg).toContain('<svg');
    expect(result.svg).not.toContain('<!DOCTYPE');
    expect(result.svg).not.toContain('<!ENTITY');
    expect(result.svg).not.toContain('&xxe;');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('DOCTYPE'), expect.stringContaining('ENTITY')])
    );
  });

  it('removeMetadata 옵션이 켜지면 metadata 요소를 DOM 기반으로 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(
      '<svg><metadata><metadata>nested</metadata><title>tool</title></metadata><rect width="1" height="1"/></svg>',
      { removeMetadata: true }
    );

    expect(result.svg).toContain('<rect');
    expect(result.svg).not.toContain('<metadata');
    expect(result.svg).not.toContain('nested');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('metadata')]));
  });

  it('위험 태그와 이벤트 핸들러를 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(
      '<svg onload="alert(1)"><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><rect onclick="alert(2)"/></svg>'
    );

    expect(result.svg).toContain('<svg');
    expect(result.svg).not.toContain('<script');
    expect(result.svg).not.toContain('foreignObject');
    expect(result.svg).not.toContain('onload');
    expect(result.svg).not.toContain('onclick');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('이벤트 핸들러')]));
  });

  it('외부 URI와 위험한 URL scheme을 제거한다', () => {
    const result = sanitizeSvgStrict(`
      <svg xmlns:xlink="http://www.w3.org/1999/xlink">
        <defs><linearGradient id="safe"/></defs>
        <image href="https://example.com/tracker.png"/>
        <a href="javascript:alert(1)"><rect/></a>
        <image xlink:href="file:///tmp/secret.png"/>
        <image href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20onload%3D%22alert(1)%22%3E%3Crect%2F%3E%3C%2Fsvg%3E"/>
      </svg>
    `);

    expect(result).toContain('id="safe"');
    expect(result).not.toContain('https://example.com');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('file:///');
    // data:image/svg+xml은 nested sanitizer로 정제 후 base64로 보존된다 — 위험 요소만 제거되어야 한다
    expect(result).toContain('data:image/svg+xml;base64,');
    expect(result).not.toContain('onload');
  });

  it('비이미지 data: 참조는 strict sanitizer에서도 제거한다', () => {
    const result = sanitizeSvgStrict('<svg><image href="data:text/html,%3Cscript%3Ealert(1)%3C/script%3E"/></svg>');

    expect(result).not.toContain('data:text/html');
    expect(result).not.toContain('<script');
  });

  it('safe raster data:image 참조는 strict sanitizer에서도 보존한다', () => {
    const svg = '<svg><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>';

    const result = sanitizeSvgStrict(svg);

    expect(result).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  it('data:image/svg+xml 참조는 nested strict sanitizer 적용 후 보존한다', () => {
    const nestedSvg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';
    const svg = `<svg><image href="data:image/svg+xml,${encodeURIComponent(nestedSvg)}" width="10" height="10"/></svg>`;

    const result = sanitizeSvgStrict(svg);

    expect(result).toContain('data:image/svg+xml;base64,');
    expect(result).not.toContain('<script');
  });

  it('style 속성과 style 요소의 외부 URL 및 위험 CSS 구문을 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(`
      <svg>
        <rect style="fill: url(https://example.com/pattern.svg); stroke: url(#safe); -moz-binding: url(http://evil);"/>
        <style>
          @import url("https://example.com/evil.css");
          rect { filter: url(https://example.com/filter.svg); clip-path: url(#safe); width: expression(alert(1)); }
        </style>
      </svg>
    `);

    expect(result.svg).toContain('url(#safe)');
    expect(result.svg).not.toContain('https://example.com');
    expect(result.svg).not.toContain('@import');
    expect(result.svg).not.toContain('expression');
    expect(result.svg).not.toContain('-moz-binding');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('CSS')]));
  });

  it('CSS escape로 숨긴 url 함수가 있으면 보수적으로 속성을 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(
      String.raw`<svg><rect style="fill: u\72l(https://example.com/a.svg)"/></svg>`
    );

    expect(result.svg).not.toContain('style=');
    expect(result.svg).not.toContain('example.com');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('CSS')]));
  });

  it('image-set 함수의 외부 URL 문자열을 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(`
      <svg>
        <rect style='background-image: image-set("https://example.com/a.png" 1x)'/>
        <circle style='background-image: -webkit-image-set("//example.com/b.png" 1x)'/>
      </svg>
    `);

    expect(result.svg).not.toContain('image-set');
    expect(result.svg).not.toContain('example.com');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('CSS')]));
  });

  it('image-set 함수의 상대 URL 문자열도 제거한다', () => {
    const result = sanitizeSvgStrictDetailed(`
      <svg>
        <rect style='background-image: image-set("tracker.png" 1x)'/>
        <circle style='background-image: -webkit-image-set("/assets/tracker.png" 1x)'/>
      </svg>
    `);

    expect(result.svg).not.toContain('image-set');
    expect(result.svg).not.toContain('tracker.png');
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('CSS')]));
  });

  it('정상 xmlns 속성만으로 CSS 외부 URL 경고를 만들지 않는다', () => {
    const result = sanitizeSvgStrictDetailed(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
    );

    expect(result.svg).toContain('<svg');
    expect(result.warnings).not.toEqual(expect.arrayContaining([expect.stringContaining('CSS')]));
  });
});
