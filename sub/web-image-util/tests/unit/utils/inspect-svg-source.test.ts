import { describe, expect, it } from 'vitest';
import { MAX_SVG_BYTES } from '../../../src/core/source-converter/options';
import { ImageProcessError } from '../../../src/errors';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';

// 책임이 더 큰 분기는 다음 파일로 분리되어 있다.
//   - sniffing: inspect-svg-source-sniffing.test.ts
//   - fetch 모드(never/metadata/body): inspect-svg-source-fetch.test.ts
//   - fetch 실패(abort/timeout/network): inspect-svg-source-fetch-failures.test.ts
//   - 누출 방지(URL/Data URL/Blob sentinel): inspect-svg-source-leakage.test.ts

describe('inspectSvgSource() — 비-허용 입력 검증', () => {
  it('null 입력 시 ImageProcessError를 던진다', async () => {
    await expect(inspectSvgSource(null as any)).rejects.toBeInstanceOf(ImageProcessError);
  });

  it('null 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "null"이다', async () => {
    await expect(inspectSvgSource(null as any)).rejects.toMatchObject({
      code: 'SVG_SOURCE_INVALID',
      details: { actualType: 'null' },
    });
  });

  it('undefined 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "undefined"이다', async () => {
    await expect(inspectSvgSource(undefined as any)).rejects.toMatchObject({
      code: 'SVG_SOURCE_INVALID',
      details: { actualType: 'undefined' },
    });
  });

  it('숫자 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "number"이다', async () => {
    await expect(inspectSvgSource(42 as any)).rejects.toMatchObject({
      code: 'SVG_SOURCE_INVALID',
      details: { actualType: 'number' },
    });
  });

  it('일반 객체 입력 시 code가 SVG_SOURCE_INVALID이고 actualType이 "object"이다', async () => {
    await expect(inspectSvgSource({} as any)).rejects.toMatchObject({
      code: 'SVG_SOURCE_INVALID',
      details: { actualType: 'object' },
    });
  });

  it('HTMLImageElement placeholder 객체 입력 시 code가 SVG_SOURCE_INVALID이다', async () => {
    const mockImg = { tagName: 'IMG', src: 'https://example.com/img.png' };
    await expect(inspectSvgSource(mockImg as any)).rejects.toMatchObject({
      code: 'SVG_SOURCE_INVALID',
      details: { actualType: 'object' },
    });
  });
});

describe('inspectSvgSource() — 잘못된 options 검증', () => {
  const validInput = '<svg xmlns="http://www.w3.org/2000/svg"/>';

  it('options.fetch가 허용값 외일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { fetch: 'invalid' as any })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'fetch' },
    });
  });

  it('options.byteLimit이 0일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { byteLimit: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'byteLimit' },
    });
  });

  it('options.byteLimit이 음수일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { byteLimit: -1 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'byteLimit' },
    });
  });

  it('options.byteLimit이 MAX_SVG_BYTES + 1일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { byteLimit: MAX_SVG_BYTES + 1 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'byteLimit' },
    });
  });

  it('options.timeoutMs가 0일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { timeoutMs: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'timeoutMs' },
    });
  });

  it('options.timeoutMs가 음수일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { timeoutMs: -1 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'timeoutMs' },
    });
  });

  it('options.timeoutMs가 비-정수(1.5)일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { timeoutMs: 1.5 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'timeoutMs' },
    });
  });

  it('options.signal이 AbortSignal이 아닌 문자열일 때 OPTION_INVALID를 던진다', async () => {
    await expect(inspectSvgSource(validInput, { signal: 'not-a-signal' as any })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
      details: { option: 'signal' },
    });
  });
});

describe('inspectSvgSource() — 정상 입력 originalKind 판정', () => {
  it('inline SVG 문자열 입력 시 originalKind가 "string"이다', async () => {
    const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(result.source.originalKind).toBe('string');
  });

  it('정상 string 입력 시 environment가 유효한 값이다', async () => {
    const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(['browser', 'happy-dom', 'node', 'unknown']).toContain(result.environment);
  });

  it('Data URL 입력 시 originalKind가 "data-url"이다', async () => {
    const result = await inspectSvgSource('data:image/svg+xml;base64,PHN2Zy8+');
    expect(result.source.originalKind).toBe('data-url');
  });

  it('https URL 문자열 입력 시 originalKind가 "url-string"이다', async () => {
    const result = await inspectSvgSource('https://example.com/foo.svg');
    expect(result.source.originalKind).toBe('url-string');
  });

  it('URL 인스턴스 입력 시 originalKind가 "url-string"이다', async () => {
    const result = await inspectSvgSource(new URL('https://example.com/foo.svg'));
    expect(result.source.originalKind).toBe('url-string');
  });

  it('Blob 입력 시 originalKind가 "blob"이다', async () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    expect(result.source.originalKind).toBe('blob');
  });

  it('File 입력 시 originalKind가 "file"이다', async () => {
    const file = new File(['<svg/>'], 'test.svg', { type: 'image/svg+xml' });
    const result = await inspectSvgSource(file);
    expect(result.source.originalKind).toBe('file');
  });
});

describe('inspectSvgSource() — 환경 감지', () => {
  it('happy-dom 환경에서 environment가 "happy-dom"이다', async () => {
    const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(result.environment).toBe('happy-dom');
  });
});
