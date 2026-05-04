import { describe, expect, it } from 'vitest';
import { MAX_EMBEDDED_DATA_IMAGE_BYTES, MAX_NESTED_SVG_DEPTH } from '../../src/utils/svg-data-url-policy';
import { sanitizeSvg } from '../../src/utils/svg-sanitizer';
import { extractDecodedNestedSvg } from './helpers/svg-test-helpers';

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

  describe('embedded data:image 정책 경계', () => {
    it('한계 크기의 raster data:image 참조는 보존한다', () => {
      // URL-encoded(non-base64) payload는 디코딩 후 UTF-8 바이트 수가 한계 이하면 보존된다.
      // ASCII 문자는 1바이트이므로 길이 == 바이트 수.
      const payload = 'a'.repeat(MAX_EMBEDDED_DATA_IMAGE_BYTES);
      const input = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png,${payload}" width="10" height="10"/></svg>`;

      const result = sanitizeSvg(input);

      expect(result).toContain('href="data:image/png,');
    });

    it('한계+1 크기의 raster data:image 참조는 제거한다', () => {
      const payload = 'a'.repeat(MAX_EMBEDDED_DATA_IMAGE_BYTES + 1);
      const input = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png,${payload}" width="10" height="10"/></svg>`;

      const result = sanitizeSvg(input);

      expect(result).not.toMatch(/\shref=/i);
    });

    it('잘못된 base64 data:image/svg+xml 참조는 fail-closed로 제거한다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,!!!not_base64!!!" width="10" height="10"/></svg>';

      const result = sanitizeSvg(input);

      expect(result).not.toMatch(/\shref=/i);
    });

    it('재귀 깊이 한계까지의 nested data:image/svg+xml은 모두 보존한다', () => {
      let nested = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="deepest" width="10" height="10"/></svg>';
      for (let i = 0; i < MAX_NESTED_SVG_DEPTH; i++) {
        nested = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml,${encodeURIComponent(nested)}" width="10" height="10"/></svg>`;
      }

      let current = sanitizeSvg(nested);
      for (let i = 0; i < MAX_NESTED_SVG_DEPTH; i++) {
        const decoded = extractDecodedNestedSvg(current);
        expect(decoded, `깊이 ${i + 1}단계의 base64 href를 디코드할 수 있어야 한다`).not.toBeNull();
        current = decoded as string;
      }
      expect(current).toContain('deepest');
    });

    it('재귀 깊이 한계를 넘는 nested data:image/svg+xml은 가장 깊은 href를 제거한다', () => {
      let nested = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="deepest" width="10" height="10"/></svg>';
      for (let i = 0; i < MAX_NESTED_SVG_DEPTH + 1; i++) {
        nested = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml,${encodeURIComponent(nested)}" width="10" height="10"/></svg>`;
      }

      let current = sanitizeSvg(nested);
      let extractedHrefs = 0;
      while (true) {
        const decoded = extractDecodedNestedSvg(current);
        if (decoded === null) break;
        extractedHrefs++;
        current = decoded;
      }
      expect(extractedHrefs).toBe(MAX_NESTED_SVG_DEPTH);
      // 마지막 디코드 결과(한계에서 잘린 가장 안쪽 SVG)에는 deepest 마커가 닿지 못한다.
      expect(current).not.toContain('deepest');
    });

    it('nested SVG의 on* 이벤트 속성은 디코드 결과에 남지 않는다', () => {
      const nestedSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" width="10" height="10"/></svg>';
      const input = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml,${encodeURIComponent(nestedSvg)}" width="10" height="10"/></svg>`;

      const result = sanitizeSvg(input);
      const decoded = extractDecodedNestedSvg(result);

      expect(decoded).not.toBeNull();
      expect(decoded).toContain('<rect');
      expect(decoded).not.toMatch(/\bonload\b/i);
    });

    it('nested SVG의 foreignObject 요소는 디코드 결과에 남지 않는다', () => {
      const nestedSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml">XSS</div></foreignObject><rect width="10" height="10"/></svg>';
      const input = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml,${encodeURIComponent(nestedSvg)}" width="10" height="10"/></svg>`;

      const result = sanitizeSvg(input);
      const decoded = extractDecodedNestedSvg(result);

      expect(decoded).not.toBeNull();
      expect(decoded).toContain('<rect');
      expect(decoded).not.toMatch(/foreignObject/i);
    });
  });
});
