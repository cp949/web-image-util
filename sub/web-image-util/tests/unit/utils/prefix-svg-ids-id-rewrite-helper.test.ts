import { describe, expect, it } from 'vitest';
import {
  applyIdRewrites,
  collectIdElements,
  planIdRewrites,
} from '../../../src/utils/prefix-svg-ids/id-rewrite.internal';

/** 테스트용 SVG 문서를 파싱한다. */
function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('id-rewrite helper', () => {
  describe('collectIdElements', () => {
    it('id 속성이 있는 요소만 순서대로 수집한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><g/><circle id="b"/></svg>');
      const ids = collectIdElements(doc).map((el) => el.getAttribute('id'));
      expect(ids).toEqual(['a', 'b']);
    });

    it('빈 문자열 id는 제외한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id=""/><circle id="b"/></svg>');
      const ids = collectIdElements(doc).map((el) => el.getAttribute('id'));
      expect(ids).toEqual(['b']);
    });
  });

  describe('planIdRewrites', () => {
    it('정상 id는 prefix-id로 rewrite 계획한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      const { rewrites, warnings } = planIdRewrites(collectIdElements(doc), 'p');
      expect(rewrites.get('a')).toBe('p-a');
      expect(warnings).toEqual({ idempotent: 0, collision: 0 });
    });

    it('이미 prefix가 붙은 id는 idempotent로 생략한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>');
      const { rewrites, warnings } = planIdRewrites(collectIdElements(doc), 'p');
      expect(rewrites.has('p-a')).toBe(false);
      expect(warnings).toEqual({ idempotent: 1, collision: 0 });
    });

    it('후보 결과 id가 기존 doc id와 충돌하면 collision으로 생략한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>');
      const { rewrites, warnings } = planIdRewrites(collectIdElements(doc), 'p');
      expect(rewrites.has('a')).toBe(false);
      expect(warnings.collision).toBe(1);
    });
  });

  describe('applyIdRewrites', () => {
    it('rewrites에 등재된 id를 적용하고 적용 개수를 반환한다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      const elements = collectIdElements(doc);
      const count = applyIdRewrites(elements, new Map([['a', 'p-a']]));
      expect(count).toBe(1);
      expect(doc.getElementsByTagName('rect')[0].getAttribute('id')).toBe('p-a');
    });

    it('rewrites에 없는 id는 변경하지 않는다', () => {
      const doc = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>');
      const count = applyIdRewrites(collectIdElements(doc), new Map());
      expect(count).toBe(0);
      expect(doc.getElementsByTagName('rect')[0].getAttribute('id')).toBe('a');
    });
  });
});
