import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvgSanitization } from '../../../src/svg-sanitizer/inspect-sanitization';

const TINY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

describe('inspectSvgSanitization()', () => {
  describe('비문자열 입력 검증', () => {
    it('숫자 입력 시 ImageProcessError를 던지고 actualType이 "number"다', async () => {
      try {
        await inspectSvgSanitization(123 as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('number');
      }
    });

    it('undefined 입력 시 actualType이 "undefined"다', async () => {
      try {
        await inspectSvgSanitization(undefined as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('undefined');
      }
    });

    it('null 입력 시 actualType이 "null"이다', async () => {
      try {
        await inspectSvgSanitization(null as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('null');
      }
    });

    it('일반 객체 입력 시 actualType이 "object"다', async () => {
      try {
        await inspectSvgSanitization({} as unknown as string);
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('SVG_INPUT_INVALID');
        expect((e as ImageProcessError).details?.actualType).toBe('object');
      }
    });
  });

  describe('옵션 정책 검증', () => {
    it('지원하지 않는 policy 문자열은 ImageProcessError를 던진다', async () => {
      try {
        await inspectSvgSanitization(TINY_SVG, { policy: 'foo' as unknown as 'lightweight' });
        expect.fail('예외가 던져져야 한다');
      } catch (e) {
        expect(e).toBeInstanceOf(ImageProcessError);
        expect((e as ImageProcessError).code).toBe('INVALID_SOURCE');
        expect((e as ImageProcessError).details?.policy).toBe('foo');
      }
    });

    it('policy 미지정 시 보고서의 policy 필드가 기본값 lightweight다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.policy).toBe('lightweight');
    });
  });

  describe('정상 입력 — 정책별 placeholder 보고서', () => {
    it('lightweight: 보고서의 bytes·byteLimit·environment·impact 기본 형태가 일치한다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.bytes).toBe(new TextEncoder().encode(TINY_SVG).length);
      expect(report.byteLimit).toBe(MAX_SVG_BYTES);
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(report.environment);
      expect(report.policy).toBe('lightweight');
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind === 'lightweight') {
        expect(report.impact.status).toBe('ok');
        expect(report.impact.outputBytes).toBe(report.bytes);
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure).toBeNull();
      }
    });

    it('strict: impact.kind가 strict이고 outputNodeCount는 0(placeholder)이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG, { policy: 'strict' });
      expect(report.policy).toBe('strict');
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind === 'strict') {
        expect(report.impact.status).toBe('ok');
        expect(report.impact.outputBytes).toBe(report.bytes);
        expect(report.impact.outputNodeCount).toBe(0);
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure).toBeNull();
      }
    });

    it('skip: impact.kind가 skip이고 potentialStages가 빈 배열이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG, { policy: 'skip' });
      expect(report.policy).toBe('skip');
      expect(report.impact.kind).toBe('skip');
      if (report.impact.kind === 'skip') {
        expect(report.impact.status).toBe('not-applied');
        expect(report.impact.potentialStages).toEqual([]);
      }
    });
  });

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

  describe('환경 감지', () => {
    it('happy-dom 기본 환경에서 environment가 "happy-dom"이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.environment).toBe('happy-dom');
    });
  });
});
