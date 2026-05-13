import { describe, expect, it } from 'vitest';
import { prefixSvgIds } from '../../../src/utils/prefix-svg-ids';
import { extractIds } from './prefix-svg-ids-helpers';

describe('prefixSvgIds() — ID rewrite', () => {
  describe('ID rewrite — 단일 id', () => {
    it('단일 id 입력 시 prefixedIdCount가 1이다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      expect(result.report.prefixedIdCount).toBe(1);
    });

    it('단일 id 입력 시 결과 svg에 "p-a" id 요소가 존재한다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });

    it('단일 id 입력 시 결과 svg에 원본 "a" id가 없다', () => {
      const result = prefixSvgIds('<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>', 'p');
      const ids = extractIds(result.svg);
      expect(ids).not.toContain('a');
    });
  });

  describe('ID rewrite — 다중 id', () => {
    it('다중 id 입력 시 prefixedIdCount가 3이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><g id="b"><circle id="c"/></g></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(3);
    });

    it('다중 id 입력 시 결과 svg에 세 id 모두 prefix 적용된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><g id="b"><circle id="c"/></g></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
      expect(ids).toContain('p-b');
      expect(ids).toContain('p-c');
    });
  });

  describe('ID rewrite — idempotent', () => {
    it('이미 prefix 적용된 id 입력 시 prefixedIdCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });

    it('이미 prefix 적용된 id 입력 시 warnings에 "id-rewrite-skipped-idempotent" (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-idempotent');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('이미 prefix 적용된 id 입력 시 결과 svg의 id는 원본 그대로다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
    });

    it('같은 prefix로 두 번 호출 시 두 번째 결과 id 분포가 첫 번째와 동등하다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/></svg>';
      const first = prefixSvgIds(input, 'p');
      const second = prefixSvgIds(first.svg, 'p');
      const ids1 = extractIds(first.svg).sort();
      const ids2 = extractIds(second.svg).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  describe('ID rewrite — collision', () => {
    it('기존 id와 collision 시 충돌 id rewrite 생략하고 prefixedIdCount는 충돌 제외 수다', () => {
      // id="a" → "p-a"가 기존 id="p-a"와 충돌. "a" rewrite 생략.
      // id="p-a"는 idempotent로 분류.
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });

    it('collision 시 warnings에 "id-rewrite-skipped-collision" (count=1) 포함', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-collision');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('collision 시 두 id 모두 결과 svg에 보존된다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="p-a"/></svg>';
      const result = prefixSvgIds(input, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('a');
      expect(ids).toContain('p-a');
    });
  });

  describe('ID rewrite — 빈 id 속성 제외', () => {
    it('빈 id 속성 입력 시 prefixedIdCount가 0이다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect id=""/></svg>';
      const result = prefixSvgIds(input, 'p');
      expect(result.report.prefixedIdCount).toBe(0);
    });
  });

  describe('ID rewrite — 비정상 입력(중복 id)', () => {
    // 같은 id를 가진 두 요소가 한 doc에 있는 비정상 입력. 명세 D12: "1개만 적용, 1개는 collision".
    // 명세는 회귀 테스트 필수 항목이 아니라 권장 사항으로 둔다(input 무결성 의존).
    const DUP_INPUT = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a"/><circle id="a"/></svg>';

    it('중복 id 입력 시 prefixedIdCount가 1이다', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      expect(result.report.prefixedIdCount).toBe(1);
    });

    it('중복 id 입력 시 warnings에 "id-rewrite-skipped-collision" (count=1) 포함', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      const w = result.report.warnings.find((w) => w.code === 'id-rewrite-skipped-collision');
      expect(w).toBeDefined();
      expect(w?.count).toBe(1);
    });

    it('중복 id 입력 시 결과 svg에 "p-a"와 "a"가 공존한다', () => {
      const result = prefixSvgIds(DUP_INPUT, 'p');
      const ids = extractIds(result.svg);
      expect(ids).toContain('p-a');
      expect(ids).toContain('a');
    });
  });
});
