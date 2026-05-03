import { describe, expect, it } from 'vitest';
import { sanitizeSvgForRendering } from '../../src/utils/svg-sanitizer';

const externalHosts = ['evil.example.com', 'attacker.test'];

function containsExternalReference(svg: string): boolean {
  return externalHosts.some((host) => svg.includes(host));
}

function decodeCssEscapesForAssertion(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|.)/gi, (_match, escaped: string) => {
    const hex = escaped.trim();
    if (/^[0-9a-f]{1,6}$/i.test(hex)) {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }
    return escaped;
  });
}

describe('스타일 escape 우회 후보 정제', () => {
  const cases: Array<{ name: string; payload: string; skipHostCheck?: boolean }> = [
    {
      name: 'h 문자 hex escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(\\68ttp://evil.example.com/x.png)"/></svg>',
    },
    {
      name: '0 패딩 hex escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(\\000068ttp://evil.example.com/x.png)"/></svg>',
    },
    {
      name: '문자별 분할 escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(\\68 \\74 \\74 \\70 ://evil.example.com)"/></svg>',
    },
    {
      // \\68 = 리터럴 백슬래시 + h → CSS 파서가 \h 로 해석하므로 http:// 가 되지 않음.
      // 실제 외부 URL이 아니므로 호스트 문자열 차단 여부는 검사하지 않는다.
      name: '이중 백슬래시 escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(\\\\68\\\\74\\\\74\\\\70 ://evil.example.com)"/></svg>',
      skipHostCheck: true,
    },
    {
      name: '이스케이프된 따옴표',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(\\22 http://evil.example.com/x.png\\22)"/></svg>',
    },
    {
      name: 'image-set 내부 escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:image-set(url(\\68ttp://evil.example.com/x.png))"/></svg>',
    },
    {
      name: 'data URL 콜론 escape',
      payload:
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="background:url(data\\3a image/png;base64,iVBORw0KGgo=)"/></svg>',
    },
  ];

  for (const { name, payload, skipHostCheck } of cases) {
    it(`${name}`, () => {
      const sanitized = sanitizeSvgForRendering(payload);
      const decodedSanitized = decodeCssEscapesForAssertion(sanitized);
      if (!skipHostCheck) {
        expect(containsExternalReference(sanitized)).toBe(false);
      }
      expect(decodedSanitized).not.toMatch(/url\s*\(\s*(?:["']?)\s*(?:http|data|javascript|\/\/)/i);
      expect(sanitized).not.toMatch(/data\\3a/i);
    });
  }
});
