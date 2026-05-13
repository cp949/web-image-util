import { describe, expect, it } from 'vitest';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';
import { extractIds } from './prefix-svg-ids-helpers';

describe('prefixSvgIds() — fragment reference rewrite', () => {
  describe('fragment reference rewrite — 내부 href', () => {
    it('href="#a"를 가진 use 요소 입력 시 rewrittenReferenceCount가 1이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(1);
    });

    it('href="#a"는 "#p-a"로 rewrite된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('#p-a');
    });

    it('href="#a"와 함께 rect id도 "p-a"로 rewrite된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });
  });

  describe('fragment reference rewrite — xlink:href', () => {
    it('xlink:href="#a"를 "#p-a"로 rewrite한다', () => {
      const XLINK = 'http://www.w3.org/1999/xlink';
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<rect id="a"/><use xlink:href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttributeNS(XLINK, 'href')).toBe('#p-a');
    });
  });

  describe('fragment reference rewrite — dangling', () => {
    it('dangling href="#missing"는 rewrite 없이 원본 유지', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#missing"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('#missing');
    });

    it('dangling ref 시 warnings에 reference-skipped-dangling (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#missing"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'reference-skipped-dangling');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });
  });

  describe('fragment reference rewrite — external sprite', () => {
    it('external href="sprite.svg#frag"는 rewrite 없이 원본 유지', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="sprite.svg#frag"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const doc = new DOMParser().parseFromString(result.svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('sprite.svg#frag');
    });

    it('external sprite 시 warnings에 reference-skipped-external (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="sprite.svg#frag"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'reference-skipped-external');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });
  });

  describe('fragment reference rewrite — 비fragment 값', () => {
    it('href="http://example.com"은 warning 없음, rewrite 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><a href="http://example.com"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });

    it('src="data:image/png;base64,..." 는 warning 없음, rewrite 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><image src="data:image/png;base64,abc"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });
  });

  describe('fragment reference rewrite — 다중 참조', () => {
    it('같은 id를 가리키는 href attribute 3개는 rewrittenReferenceCount가 3이다', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/>' +
        '<use href="#a"/><use href="#a"/><use href="#a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(3);
    });
  });

  describe('fragment reference rewrite — idempotent id의 fragment ref', () => {
    it('idempotent id를 가리키는 href="#p-a"는 rewrite 없음, rewrittenReferenceCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.rewrittenReferenceCount).toBe(0);
    });

    it('idempotent id의 fragment ref는 reference 측 warning 없음', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const hasRefWarning = result.report.warnings.some(
        (w) => w.code === 'reference-skipped-dangling' || w.code === 'reference-skipped-external'
      );
      expect(hasRefWarning).toBe(false);
    });

    it('idempotent id의 fragment ref 시 id-rewrite-skipped-idempotent warning은 존재한다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/><use href="#p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-idempotent');
      expect(w).toBeDefined();
    });
  });
});
