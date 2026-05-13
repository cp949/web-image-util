import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvgSanitization } from '../../../src/svg-sanitizer/inspect-sanitization';
import { sanitizeSvgForRendering } from '../../../src/utils/svg-sanitizer';
import { encodedByteLength, TINY_SVG } from './inspect-sanitization-helpers';

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
      const sanitizedBytes = encodedByteLength(sanitizeSvgForRendering(TINY_SVG));
      expect(report.bytes).toBe(encodedByteLength(TINY_SVG));
      expect(report.byteLimit).toBe(MAX_SVG_BYTES);
      expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(report.environment);
      expect(report.policy).toBe('lightweight');
      expect(report.impact.kind).toBe('lightweight');
      if (report.impact.kind === 'lightweight') {
        expect(report.impact.status).toBe('ok');
        expect(report.impact.outputBytes).toBe(sanitizedBytes);
        expect(report.impact.stages).toEqual([]);
        expect(report.impact.failure).toBeNull();
      }
    });

    it('strict: 정상 SVG는 ok status와 정확한 outputBytes/outputNodeCount를 반환한다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG, { policy: 'strict' });
      expect(report.policy).toBe('strict');
      expect(report.impact.kind).toBe('strict');
      if (report.impact.kind === 'strict') {
        expect(report.impact.status).toBe('ok');
        // 빈 SVG도 정제 결과는 자기 자신과 동등한 마크업이므로 outputBytes > 0
        expect(report.impact.outputBytes).not.toBeNull();
        expect(report.impact.outputBytes ?? 0).toBeGreaterThan(0);
        // querySelectorAll('*')는 root element를 제외하므로 자식이 없으면 0
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

  describe('환경 감지', () => {
    it('happy-dom 기본 환경에서 environment가 "happy-dom"이다', async () => {
      const report = await inspectSvgSanitization(TINY_SVG);
      expect(report.environment).toBe('happy-dom');
    });
  });

  describe('공개 표면 노출', () => {
    it('svg-sanitizer 서브패스에서 inspectSvgSanitization을 import할 수 있다', async () => {
      const module = await import('@cp949/web-image-util/svg-sanitizer');
      expect(typeof module.inspectSvgSanitization).toBe('function');
      const report = await module.inspectSvgSanitization(TINY_SVG);
      expect(report.policy).toBe('lightweight');
      expect(report.impact.kind).toBe('lightweight');
    });
  });
});
