import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import {
  assertInspectSvgSourceInput,
  assertInspectSvgSourceOptions,
} from '../../../src/utils/inspect-svg-source/validation';

describe('assertInspectSvgSourceInput() — 비허용 입력 throw', () => {
  it('null 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "null"이다', () => {
    expect(() => assertInspectSvgSourceInput(null)).toThrowError(
      expect.objectContaining({ code: 'SVG_SOURCE_INVALID', details: { actualType: 'null' } })
    );
  });

  it('undefined 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "undefined"이다', () => {
    expect(() => assertInspectSvgSourceInput(undefined)).toThrowError(
      expect.objectContaining({ code: 'SVG_SOURCE_INVALID', details: { actualType: 'undefined' } })
    );
  });

  it('숫자 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "number"이다', () => {
    expect(() => assertInspectSvgSourceInput(42)).toThrowError(
      expect.objectContaining({ code: 'SVG_SOURCE_INVALID', details: { actualType: 'number' } })
    );
  });

  it('일반 객체 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "object"이다', () => {
    expect(() => assertInspectSvgSourceInput({})).toThrowError(
      expect.objectContaining({ code: 'SVG_SOURCE_INVALID', details: { actualType: 'object' } })
    );
  });

  it('HTMLImageElement placeholder 객체 입력 시 code가 SVG_SOURCE_INVALID이다', () => {
    const mockImg = { tagName: 'IMG', src: 'https://example.com/img.png' };
    expect(() => assertInspectSvgSourceInput(mockImg)).toThrowError(
      expect.objectContaining({ code: 'SVG_SOURCE_INVALID', details: { actualType: 'object' } })
    );
  });

  it('string 입력 시 throw 없이 통과한다', () => {
    expect(() => assertInspectSvgSourceInput('<svg/>')).not.toThrow();
  });

  it('Blob 입력 시 throw 없이 통과한다', () => {
    expect(() => assertInspectSvgSourceInput(new Blob(['<svg/>']))).not.toThrow();
  });

  it('File 입력 시 throw 없이 통과한다', () => {
    expect(() => assertInspectSvgSourceInput(new File(['<svg/>'], 'test.svg'))).not.toThrow();
  });

  it('URL 입력 시 throw 없이 통과한다', () => {
    expect(() => assertInspectSvgSourceInput(new URL('https://example.com/foo.svg'))).not.toThrow();
  });
});

describe('assertInspectSvgSourceOptions() — 잘못된 옵션 throw', () => {
  it('options가 undefined이면 throw 없이 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions(undefined)).not.toThrow();
  });

  it('options.fetch가 허용값 외일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ fetch: 'invalid' as any })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'fetch' } })
    );
  });

  it('options.fetch가 "never"일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ fetch: 'never' })).not.toThrow();
  });

  it('options.fetch가 "metadata"일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ fetch: 'metadata' })).not.toThrow();
  });

  it('options.fetch가 "body"일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ fetch: 'body' })).not.toThrow();
  });

  it('options.byteLimit이 0일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: 0 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'byteLimit' } })
    );
  });

  it('options.byteLimit이 음수일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: -1 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'byteLimit' } })
    );
  });

  it('options.byteLimit이 MAX_SVG_BYTES + 1일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: MAX_SVG_BYTES + 1 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'byteLimit' } })
    );
  });

  it('options.byteLimit이 비-정수(1.5)일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: 1.5 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'byteLimit' } })
    );
  });

  it('options.byteLimit이 1일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: 1 })).not.toThrow();
  });

  it('options.byteLimit이 MAX_SVG_BYTES일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ byteLimit: MAX_SVG_BYTES })).not.toThrow();
  });

  it('options.timeoutMs가 0일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ timeoutMs: 0 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'timeoutMs' } })
    );
  });

  it('options.timeoutMs가 음수일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ timeoutMs: -1 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'timeoutMs' } })
    );
  });

  it('options.timeoutMs가 비-정수(1.5)일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ timeoutMs: 1.5 })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'timeoutMs' } })
    );
  });

  it('options.timeoutMs가 양의 정수(1000)일 때 통과한다', () => {
    expect(() => assertInspectSvgSourceOptions({ timeoutMs: 1000 })).not.toThrow();
  });

  it('options.signal이 AbortSignal이 아닌 문자열일 때 OPTION_INVALID를 던진다', () => {
    expect(() => assertInspectSvgSourceOptions({ signal: 'not-a-signal' as any })).toThrowError(
      expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'signal' } })
    );
  });

  it('options.signal이 AbortSignal 인스턴스일 때 통과한다', () => {
    const controller = new AbortController();
    expect(() => assertInspectSvgSourceOptions({ signal: controller.signal })).not.toThrow();
  });
});
