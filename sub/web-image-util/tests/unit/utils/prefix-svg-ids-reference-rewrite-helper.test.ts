/**
 * SVG fragment 참조의 분류·읽기·쓰기·일괄 재작성 helper 계약을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyFragmentReference,
  rewriteFragmentReferences,
  writeReferenceAttribute,
} from '../../../src/utils/prefix-svg-ids/reference-rewrite.internal';
import { readReferenceAttribute, XLINK_NAMESPACE } from '../../../src/utils/svg-reference-attribute.internal';

/** 테스트용 SVG 문서를 파싱한다. */
function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('reference-rewrite helper', () => {
  describe('classifyFragmentReference', () => {
    it('"#a" 내부 참조는 internal로 token까지 분류한다', () => {
      expect(classifyFragmentReference('#a')).toEqual({ kind: 'internal', token: 'a' });
    });

    it('앞뒤 공백이 있어도 trim 후 token을 노출한다', () => {
      expect(classifyFragmentReference('  #a  ')).toEqual({ kind: 'internal', token: 'a' });
    });

    it('"sprite.svg#a"는 external로 분류한다', () => {
      expect(classifyFragmentReference('sprite.svg#a')).toEqual({ kind: 'external' });
    });

    it('"http://example.com"은 non-fragment로 분류한다', () => {
      expect(classifyFragmentReference('http://example.com')).toEqual({ kind: 'non-fragment' });
    });

    it('Data URL은 non-fragment로 분류한다', () => {
      expect(classifyFragmentReference('data:image/png;base64,abc')).toEqual({ kind: 'non-fragment' });
    });

    it('"#" 단독은 non-fragment로 분류한다', () => {
      expect(classifyFragmentReference('#')).toEqual({ kind: 'non-fragment' });
    });
  });

  describe('readReferenceAttribute / writeReferenceAttribute', () => {
    it('일반 href 값을 읽는다', () => {
      const el = parse('<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>').getElementsByTagName('use')[0];
      expect(readReferenceAttribute(el, 'href')).toBe('#a');
    });

    it('xlink:href namespace 값을 읽는다', () => {
      const el = parse(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
          '<use xlink:href="#a"/></svg>'
      ).getElementsByTagName('use')[0];
      expect(readReferenceAttribute(el, 'xlink:href')).toBe('#a');
    });

    it('xlink:href namespace를 보존하며 쓴다', () => {
      const el = parse(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
          '<use xlink:href="#a"/></svg>'
      ).getElementsByTagName('use')[0];
      writeReferenceAttribute(el, 'xlink:href', 'xlink:href', '#p-a');
      expect(el.getAttributeNS(XLINK_NAMESPACE, 'href')).toBe('#p-a');
    });

    it('같은 localName의 다른 namespace 속성을 변경하지 않고 지정한 속성만 쓴다', () => {
      const el = parse(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://www.w3.org/1999/xlink" ' +
          'xmlns:xlink="http://example.test/other"><use foo:href="#safe" xlink:href="#target"/></svg>'
      ).getElementsByTagName('use')[0];

      writeReferenceAttribute(el, 'xlink:href', 'xlink:href', '#p-target');

      expect(el.getAttribute('foo:href')).toBe('#safe');
      expect(el.getAttribute('xlink:href')).toBe('#p-target');
    });
  });

  describe('rewriteFragmentReferences', () => {
    it('내부 참조를 rewrite하고 count를 보고한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><use href="#a"/></svg>');
      const result = rewriteFragmentReferences(doc, new Map([['a', 'p-a']]), new Set(['a']));
      expect(result).toEqual({ rewrittenCount: 1, danglingCount: 0, externalCount: 0 });
      expect(doc.getElementsByTagName('use')[0].getAttribute('href')).toBe('#p-a');
    });

    it('dangling 참조는 danglingCount만 올린다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><use href="#missing"/></svg>');
      const result = rewriteFragmentReferences(doc, new Map(), new Set());
      expect(result).toEqual({ rewrittenCount: 0, danglingCount: 1, externalCount: 0 });
    });

    it('external 참조는 externalCount만 올린다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><use href="sprite.svg#a"/></svg>');
      const result = rewriteFragmentReferences(doc, new Map(), new Set());
      expect(result).toEqual({ rewrittenCount: 0, danglingCount: 0, externalCount: 1 });
    });
  });
});
