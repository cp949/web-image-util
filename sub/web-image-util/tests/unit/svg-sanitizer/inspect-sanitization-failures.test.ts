import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { inspectSvgSanitization } from '../../../src/svg-sanitizer/inspect-sanitization';
import { DEFAULT_MAX_NODE_COUNT } from '../../../src/svg-sanitizer/types';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';
import { encodedByteLength } from './inspect-sanitization-helpers';

describe('inspectSvgSanitization() 실패 경계', () => {
  describe('byte 초과 → 정책별 fallback', () => {
    // MAX_SVG_BYTES = 10 MiB. 한 글자 = 1 byte ASCII이므로 +1로 초과를 만든다.
    const oversizedInput = 'a'.repeat(MAX_SVG_BYTES + 1);

    it('lightweight: failure.code가 svg-bytes-exceeded이고 outputBytes가 null이다', async () => {
      const report = await inspectSvgSanitization(oversizedInput);
      expect(report.bytes).toBe(MAX_SVG_BYTES + 1);
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind === 'lightweight') {
        expect(report.impact.status).toBe('failed');
        expect(report.impact.outputBytes).toBeNull();
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure?.code).toBe('svg-bytes-exceeded');
      }
    });

    it('strict: failure.code가 svg-bytes-exceeded이고 outputNodeCount가 null이다', async () => {
      const report = await inspectSvgSanitization(oversizedInput, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind === 'strict') {
        expect(report.impact.status).toBe('failed');
        expect(report.impact.outputBytes).toBeNull();
        expect(report.impact.outputNodeCount).toBeNull();
        expect(report.impact.failure?.code).toBe('svg-bytes-exceeded');
      }
    });

    it('skip: byte 초과여도 항상 not-applied + 빈 potentialStages를 반환한다', async () => {
      const report = await inspectSvgSanitization(oversizedInput, { policy: 'skip' });
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind === 'skip') {
        expect(report.impact.status).toBe('not-applied');
        expect(report.impact.potentialStages).toEqual([]);
      }
    });
  });

  describe('파싱 실패 fallback', () => {
    it('파싱 실패 입력도 status는 ok이고 stages는 빈 배열이며 outputBytes는 정제 결과 byte다', async () => {
      const input = '<not-svg-root>broken<';
      const report = await inspectSvgSanitization(input);
      const expected = encodedByteLength(sanitizeSvgForRendering(input));
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind !== 'lightweight') return;
      expect(report.impact.status).toBe('ok');
      expect(report.impact.stages).toEqual([]);
      expect(report.impact.outputBytes).toBe(expected);
      expect(report.impact.failure).toBeNull();
    });
  });

  describe('strict 노드 개수 초과', () => {
    it('노드 개수 초과 입력은 status failed + failure.code "svg-node-count-exceeded"로 분기된다', async () => {
      // root svg 자체가 count 1로 잡히므로 +1로 한도 초과를 만든다
      const child = '<rect/>';
      const input = `<svg xmlns="http://www.w3.org/2000/svg">${child.repeat(DEFAULT_MAX_NODE_COUNT + 1)}</svg>`;
      const report = await inspectSvgSanitization(input, { policy: 'strict' });
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind !== 'strict') return;
      expect(report.impact.status).toBe('failed');
      expect(report.impact.failure?.code).toBe('svg-node-count-exceeded');
      expect(report.impact.outputBytes).toBeNull();
      expect(report.impact.outputNodeCount).toBeNull();
      expect(report.impact.stages).toEqual([]);
    });
  });
});
