import { describe, expect, it } from 'vitest';
import { detectSourceType } from '../../src/core/source-converter';

// isInlineSvg는 내부 함수라 직접 접근이 불가능하므로 detectSourceType을 통해 간접 검증한다.
// SVG로 감지되면 'svg' 타입을 반환한다.

describe('보안: SVG 입력 검증', () => {
  it('보안 테스트 환경은 window.Image를 전역 목과 동일하게 맞춘다', () => {
    expect(window.Image).toBe(globalThis.Image);
    expect(window.HTMLImageElement).toBe(globalThis.HTMLImageElement);
  });

  describe('XSS 방지 - 스크립트 포함 SVG 감지', () => {
    it('인라인 스크립트가 포함된 SVG를 svg 타입으로 감지한다', () => {
      // 공격자가 XSS를 시도하는 SVG 입력
      const xssSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
      // 라이브러리는 SVG로 감지한다 — 렌더링 여부는 상위 레이어가 결정한다
      expect(detectSourceType(xssSvg)).toBe('svg');
    });

    it('onload 이벤트 핸들러가 포함된 SVG를 svg 타입으로 감지한다', () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
      expect(detectSourceType(xssSvg)).toBe('svg');
    });

    it('javascript: URI 참조가 포함된 SVG를 svg 타입으로 감지한다', () => {
      const xssSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="100" height="100"/></a></svg>';
      expect(detectSourceType(xssSvg)).toBe('svg');
    });

    it('XML 선언이 앞에 붙은 스크립트 포함 SVG를 svg 타입으로 감지한다', () => {
      const xssSvg =
        '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>';
      expect(detectSourceType(xssSvg)).toBe('svg');
    });

    it('DOCTYPE 선언이 앞에 붙은 스크립트 포함 SVG를 svg 타입으로 감지한다', () => {
      const xssSvg =
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "">\n<svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>';
      expect(detectSourceType(xssSvg)).toBe('svg');
    });
  });

  describe('외부 리소스 참조 SVG 감지', () => {
    it('외부 이미지를 참조하는 SVG를 svg 타입으로 감지한다', () => {
      // 외부 트래킹 픽셀이나 SSRF 시도
      const svgWithExternalRef =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="http://evil.com/track.png" width="1" height="1"/></svg>';
      expect(detectSourceType(svgWithExternalRef)).toBe('svg');
    });

    it('외부 스크립트를 참조하는 SVG를 svg 타입으로 감지한다', () => {
      const svgWithExternalScript =
        '<svg xmlns="http://www.w3.org/2000/svg"><script href="http://evil.com/payload.js"/></svg>';
      expect(detectSourceType(svgWithExternalScript)).toBe('svg');
    });

    it('use 태그로 외부 기호를 참조하는 SVG를 svg 타입으로 감지한다', () => {
      const svgWithUseRef =
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="http://evil.com/symbols.svg#icon"/></svg>';
      expect(detectSourceType(svgWithUseRef)).toBe('svg');
    });
  });

  describe('비정상 입력 경계 처리', () => {
    it('스크립트가 포함된 일반 HTML은 svg로 감지하지 않는다 (false positive 방지)', () => {
      // HTML 내 SVG는 svg 타입으로 분류하면 안 된다
      const htmlWithSvg = '<html><body><svg><script>alert(1)</script></svg></body></html>';
      // HTML로 시작하므로 svg가 아닌 path로 처리된다
      expect(detectSourceType(htmlWithSvg)).not.toBe('svg');
    });

    it('div 내부에 중첩된 SVG는 svg로 감지하지 않는다', () => {
      const embeddedSvg = '<div><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg></div>';
      expect(detectSourceType(embeddedSvg)).not.toBe('svg');
    });

    it('빈 문자열은 예외를 던지지 않고 path 타입으로 반환한다', () => {
      // 빈 문자열은 조용히 처리되어야 한다
      expect(() => detectSourceType('')).not.toThrow();
      // 빈 문자열은 path로 fallback된다
      expect(detectSourceType('')).toBe('path');
    });

    it('공백만 있는 문자열은 예외를 던지지 않는다', () => {
      expect(() => detectSourceType('   ')).not.toThrow();
    });

    // 참고: 감지 레이어(detectSourceType)는 크기 제한을 강제하지 않는다.
    // 실제 차단은 변환 레이어(convertToElement)에서 이루어진다 — svg-sanitization.test.ts 참조
    it('매우 긴 문자열(10MB) 처리 시 예외를 던지지 않는다', () => {
      // 과도한 입력으로 인한 DoS 시도 방어
      const largePadding = 'a'.repeat(10 * 1024 * 1024);
      const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${largePadding} --><rect width="100" height="100"/></svg>`;
      expect(() => detectSourceType(largeSvg)).not.toThrow();
      expect(detectSourceType(largeSvg)).toBe('svg');
    });

    it('매우 긴 비-SVG 문자열 처리 시 예외를 던지지 않는다', () => {
      // SVG가 아닌 대용량 데이터 입력
      const largeNonSvg = 'x'.repeat(10 * 1024 * 1024);
      expect(() => detectSourceType(largeNonSvg)).not.toThrow();
    });
  });

  describe('Data URL SVG 보안 검증', () => {
    it('스크립트가 포함된 Data URL SVG를 svg 타입으로 감지한다', () => {
      // URL 인코딩된 XSS 페이로드
      const xssDataUrl =
        'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E%3C%2Fsvg%3E';
      expect(detectSourceType(xssDataUrl)).toBe('svg');
    });

    it('base64 인코딩된 Data URL SVG를 svg 타입으로 감지한다', () => {
      // base64("<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>")
      const base64Svg =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxyZWN0Lz48L3N2Zz4=';
      expect(detectSourceType(base64Svg)).toBe('svg');
    });
  });

  describe('Blob 타입 SVG 감지', () => {
    it('image/svg+xml MIME 타입의 Blob은 svg 타입으로 감지한다', () => {
      const svgBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'], {
        type: 'image/svg+xml',
      });
      expect(detectSourceType(svgBlob)).toBe('svg');
    });

    it('일반 MIME 타입의 Blob은 blob 타입으로 감지한다', () => {
      const pngBlob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
        type: 'image/png',
      });
      expect(detectSourceType(pngBlob)).toBe('blob');
    });
  });
});

import { sanitizeSvg } from '../../src/utils/svg-sanitizer';

describe('SVG sanitize 유틸', () => {
  describe('스크립트 노드 제거', () => {
    it('script 요소를 제거하고 나머지 SVG를 반환한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/<script/i);
      expect(result).toMatch(/<rect/);
    });

    it('닫는 태그 없이 자가 닫힘인 script 요소도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><script src="evil.js"/><rect width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/<script/i);
      expect(result).toMatch(/<rect/);
    });

    it('XML 선언이 앞에 붙은 스크립트 포함 SVG에서도 script 요소를 제거한다', () => {
      const input = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script><rect/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/<script/i);
    });
  });

  describe('인라인 이벤트 속성 제거', () => {
    it('onload 이벤트 속성을 제거한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/\bonload\b/i);
      expect(result).toMatch(/<circle/);
    });

    it('onclick, onmouseover 등 다양한 이벤트 속성을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onclick="evil()" onmouseover="track()"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/\bonclick\b/i);
      expect(result).not.toMatch(/\bonmouseover\b/i);
      expect(result).toMatch(/<rect/);
    });

    it('대소문자가 섞인 이벤트 속성(oNcLiCk)도 제거한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" oNcLiCk="alert(1)"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/oNcLiCk/i);
      expect(result).toMatch(/<rect/);
    });
  });

  describe('foreignObject 요소 제거', () => {
    it('foreignObject 요소와 그 내용을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml">XSS</div></foreignObject><rect width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/foreignObject/i);
      expect(result).toMatch(/<rect/);
    });
  });

  describe('외부 URL 참조 제거', () => {
    it('http:// 외부 href 속성을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil.com/track.png" width="1" height="1"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href="http:/i);
    });

    it('https:// 외부 href 속성을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.com/track.png" width="1" height="1"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href="https:/i);
    });

    it('javascript: href 속성을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href="javascript:/i);
    });

    it('엔티티로 인코딩된 javascript: href 속성도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="jav&#x61;script:alert(1)"><rect width="10" height="10"/></a></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href=/i);
    });

    it('안전한 raster data:image href는 제거하지 않는다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo=" width="10" height="10"/></svg>';

      const result = sanitizeSvg(input);

      expect(result).toContain('href="data:image/png;base64,iVBORw0KGgo="');
    });

    it('비이미지 data: href는 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:text/html,%3Cscript%3Ealert(1)%3C/script%3E" width="10" height="10"/></svg>';

      const result = sanitizeSvg(input);

      expect(result).not.toContain('data:text/html');
      expect(result).not.toMatch(/\shref=/i);
    });

    it('data:image/svg+xml href는 nested SVG를 정제한 뒤 보존한다', () => {
      const nestedSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';
      const nestedDataUrl = `data:image/svg+xml,${encodeURIComponent(nestedSvg)}`;
      const input = `<svg xmlns="http://www.w3.org/2000/svg"><image href="${nestedDataUrl}" width="10" height="10"/></svg>`;

      const result = sanitizeSvg(input);

      expect(result).toContain('href="data:image/svg+xml;base64,');
      const encoded = result.match(/href="data:image\/svg\+xml;base64,([^"]+)"/)?.[1];
      expect(encoded).toBeDefined();
      const decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded as string), (char) => char.charCodeAt(0)));
      expect(decoded).toContain('<rect');
      expect(decoded).not.toContain('<script');
    });

    it('xlink:href 외부 참조도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="http://evil.com/symbols.svg#icon"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/xlink:href="http:/i);
    });

    it('따옴표 없는 외부 href 속성도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href=https://evil.com/track.png width="1" height="1"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href=https:/i);
    });

    it('protocol-relative 외부 href 속성도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href=//evil.com/track.png width="1" height="1"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href=\/\/evil\.com/i);
    });

    it('따옴표 없는 style 속성의 외부 url() 참조도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style=fill:url(https://evil.com/pattern.svg#id) width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/style=fill:url\(https:/i);
      expect(result).toMatch(/style="fill:url\(#invalid\)"/i);
    });

    it('엔티티로 인코딩된 javascript: url() 참조도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(jav&#x61;script:alert(1))" width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).toMatch(/url\(#invalid\)/i);
    });

    it('protocol-relative style 속성의 외부 url() 참조도 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style=fill:url(//evil.com/pattern.svg#id) width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/url\(\/\/evil\.com/i);
      expect(result).toMatch(/style="fill:url\(#invalid\)"/i);
    });

    it('텍스트 노드 안의 href= 문자열은 속성으로 오인해 제거하지 않는다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><text>x href=https://example.com y</text></svg>';
      const result = sanitizeSvg(input);
      expect(result).toContain('href=https://example.com');
    });

    it('텍스트 노드 안의 style=url() 문자열은 속성으로 오인해 변형하지 않는다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><text>x style=fill:url(https://example.com/pattern.svg#id) y</text></svg>';
      const result = sanitizeSvg(input);
      expect(result).toContain('style=fill:url(https://example.com/pattern.svg#id)');
    });

    it('다른 속성값 안에 > 문자가 있어도 뒤쪽의 외부 href 속성을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image aria-label="1 > 0" href="https://evil.com/track.png" width="1" height="1"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/href="https:\/\/evil\.com/i);
    });

    it('다른 속성값 안에 > 문자가 있어도 뒤쪽의 외부 style url()을 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect aria-label="1 > 0" style="fill:url(https://evil.com/pattern.svg#id)" width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).not.toMatch(/url\(https:\/\/evil\.com/i);
      expect(result).toMatch(/style="fill:url\(#invalid\)"/i);
    });

    it('프래그먼트 참조(#id)는 보존한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="#icon"/><symbol id="icon"><rect/></symbol></svg>';
      const result = sanitizeSvg(input);
      expect(result).toMatch(/href="#icon"/);
    });

    it('sanitize 후에도 SVG 루트 태그가 유지된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
      const result = sanitizeSvg(input);
      expect(result).toMatch(/<svg/);
      expect(result).toMatch(/<rect/);
    });
  });
});
