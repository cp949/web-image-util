/**
 * 참조 속성 판정(isReferenceAttribute/readReferenceAttribute)의 단일 소유 leaf를 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { isReferenceAttribute, readReferenceAttribute } from '../../../src/utils/svg-reference-attribute.internal';

/** 테스트용 SVG 문서를 파싱한다. */
function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('isReferenceAttribute()', () => {
  it('href 속성은 참조로 판정한다', () => {
    const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>');
    const use = doc.getElementsByTagName('use')[0];
    expect(isReferenceAttribute(use, 'href')).toBe(true);
  });

  it('표준 prefix xlink:href 속성은 참조로 판정한다', () => {
    const doc = parse(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<use xlink:href="#a"/></svg>'
    );
    const use = doc.getElementsByTagName('use')[0];
    expect(isReferenceAttribute(use, 'xlink:href')).toBe(true);
  });

  it('src 속성은 참조로 판정한다', () => {
    const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><image src="a.png"/></svg>');
    const image = doc.getElementsByTagName('image')[0];
    expect(isReferenceAttribute(image, 'src')).toBe(true);
  });

  it('비표준 prefix로 선언된 xlink 참조도 localName 기준으로 참조로 판정한다', () => {
    const doc = parse(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:foo="http://example.test/foo">' +
        '<use foo:href="#a"/></svg>'
    );
    const use = doc.getElementsByTagName('use')[0];
    expect(isReferenceAttribute(use, 'foo:href')).toBe(true);
  });

  it('참조와 무관한 속성은 false를 반환한다', () => {
    const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(#g1)" id="r1"/></svg>');
    const rect = doc.getElementsByTagName('rect')[0];
    expect(isReferenceAttribute(rect, 'fill')).toBe(false);
    expect(isReferenceAttribute(rect, 'id')).toBe(false);
  });
});

describe('readReferenceAttribute()', () => {
  it('href 값을 그대로 읽는다', () => {
    const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><use href="#a"/></svg>');
    const use = doc.getElementsByTagName('use')[0];
    expect(readReferenceAttribute(use, 'href')).toBe('#a');
  });

  it('표준 prefix xlink:href 값을 getAttributeNS 경로로 읽는다', () => {
    const doc = parse(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
        '<use xlink:href="#a"/></svg>'
    );
    const use = doc.getElementsByTagName('use')[0];
    expect(readReferenceAttribute(use, 'xlink:href')).toBe('#a');
  });

  it('존재하지 않는 속성은 null을 반환한다', () => {
    const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><use/></svg>');
    const use = doc.getElementsByTagName('use')[0];
    expect(readReferenceAttribute(use, 'href')).toBeNull();
  });
});
