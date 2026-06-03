import { describe, expect, it } from 'vitest';
import { buildDeoptResult, buildPrefixWarnings } from '../../../src/utils/prefix-svg-ids/report-utils';

describe('report-utils helper', () => {
  describe('buildPrefixWarnings', () => {
    it('count가 0인 항목은 제외하고 양수 항목만 code/count로 조립한다', () => {
      expect(buildPrefixWarnings({ idempotent: 1, collision: 0, dangling: 2, external: 0 })).toEqual([
        { code: 'id-rewrite-skipped-idempotent', count: 1 },
        { code: 'reference-skipped-dangling', count: 2 },
      ]);
    });

    it('모든 count가 0이면 빈 배열', () => {
      expect(buildPrefixWarnings({ idempotent: 0, collision: 0, dangling: 0, external: 0 })).toEqual([]);
    });

    it('네 항목 순서는 idempotent → collision → dangling → external이다', () => {
      expect(buildPrefixWarnings({ idempotent: 1, collision: 2, dangling: 3, external: 4 })).toEqual([
        { code: 'id-rewrite-skipped-idempotent', count: 1 },
        { code: 'id-rewrite-skipped-collision', count: 2 },
        { code: 'reference-skipped-dangling', count: 3 },
        { code: 'reference-skipped-external', count: 4 },
      ]);
    });
  });

  describe('buildDeoptResult', () => {
    it('입력 svg를 그대로 보존하고 deoptimized=true로 만든다', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{}</style></svg>';
      const result = buildDeoptResult(input, 42, 'node', ['style-tag-present']);
      expect(result.svg).toBe(input);
      expect(result.report.deoptimized).toBe(true);
      expect(result.report.deoptReasons).toEqual(['style-tag-present']);
    });

    it('deopt result는 warnings가 비어 있고 prefix/reference count가 0이다', () => {
      const result = buildDeoptResult('<svg/>', 5, 'browser', ['byte-limit-exceeded']);
      expect(result.report.warnings).toEqual([]);
      expect(result.report.prefixedIdCount).toBe(0);
      expect(result.report.rewrittenReferenceCount).toBe(0);
      expect(result.report.bytes).toBe(5);
      expect(result.report.environment).toBe('browser');
    });
  });
});
