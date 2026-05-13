import { describe, expect, it } from 'vitest';
import { inspectSvgSource } from '../../../src/utils/inspect-svg-source';

describe('inspectSvgSource() — MIME/확장자/Data URL/byte sniff 분기', () => {
  it('image/svg+xml MIME Blob → kind이 "svg"이고 mime이 "image/svg+xml"이다', async () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    expect(result.kind).toBe('svg');
    expect(result.source.mime).toBe('image/svg+xml');
  });

  it('image/png MIME Blob → kind이 "not-svg-source"이다', async () => {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const result = await inspectSvgSource(blob);
    expect(result.kind).toBe('not-svg-source');
  });

  it('.svg 확장자 + text/plain MIME File → kind이 "svg"이고 finding mime-mismatch가 있다', async () => {
    const file = new File(['<svg/>'], 'image.svg', { type: 'text/plain' });
    const result = await inspectSvgSource(file);
    expect(result.kind).toBe('svg');
    expect(result.findings.some((f) => f.code === 'mime-mismatch')).toBe(true);
  });

  it('image/svg+xml MIME + .png 확장자 File → kind이 "svg"이고 finding extension-mismatch가 있다', async () => {
    const file = new File(['<svg/>'], 'image.png', { type: 'image/svg+xml' });
    const result = await inspectSvgSource(file);
    expect(result.kind).toBe('svg');
    expect(result.findings.some((f) => f.code === 'extension-mismatch')).toBe(true);
  });

  it('SVG Data URL → kind이 "svg"이고 mime이 "image/svg+xml"이다', async () => {
    const result = await inspectSvgSource('data:image/svg+xml;base64,PHN2Zy8+');
    expect(result.kind).toBe('svg');
    expect(result.source.mime).toBe('image/svg+xml');
  });

  it('PNG Data URL → kind이 "not-svg-source"이다', async () => {
    const result = await inspectSvgSource(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=='
    );
    expect(result.kind).toBe('not-svg-source');
  });

  it('inline SVG string → TASK-03 이후 본문 도출로 kind이 "svg"이다', async () => {
    const result = await inspectSvgSource('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(result.kind).toBe('svg');
  });

  it('byteLimit: 10 + 11바이트 비-SVG string → finding byte-limit-exceeded가 있고 kind이 "not-svg-source"이다', async () => {
    const result = await inspectSvgSource('hello world', { byteLimit: 10 });
    expect(result.findings.some((f) => f.code === 'byte-limit-exceeded')).toBe(true);
    expect(result.kind).toBe('not-svg-source');
  });
});

describe('inspectSvgSource() — 본문 도출 경로(string / data-url / blob / file)', () => {
  const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

  it('inline SVG string → kind이 "svg"이고 svg가 존재하며 valid가 true이고 consumed가 false이다', async () => {
    const result = await inspectSvgSource(VALID_SVG);
    expect(result.kind).toBe('svg');
    expect(result.svg).not.toBeNull();
    expect(result.svg?.valid).toBe(true);
    expect(result.source.consumed).toBe(false);
  });

  it('inline non-SVG string "<html></html>" → kind이 "not-svg-source"이고 svg.valid가 false이다', async () => {
    const result = await inspectSvgSource('<html></html>');
    expect(result.kind).toBe('not-svg-source');
    expect(result.svg?.valid).toBe(false);
  });

  it('SVG Data URL(charset) → kind이 "svg"이고 svg.valid가 true이고 consumed가 false이다', async () => {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VALID_SVG)}`;
    const result = await inspectSvgSource(dataUrl);
    expect(result.kind).toBe('svg');
    expect(result.svg?.valid).toBe(true);
    expect(result.source.consumed).toBe(false);
  });

  it('SVG Data URL base64 decode 실패 → finding "data-url-decode-failed"이 있고 kind이 "unknown"이다', async () => {
    const result = await inspectSvgSource('data:image/svg+xml;base64,!!!invalid!!!');
    expect(result.findings.some((f) => f.code === 'data-url-decode-failed')).toBe(true);
    expect(result.kind).toBe('unknown');
  });

  it('SVG MIME Blob 정상 본문 → kind이 "svg"이고 svg.valid가 true이고 consumed가 true이고 finding body-consumed-once가 있다', async () => {
    const blob = new Blob([VALID_SVG], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    expect(result.kind).toBe('svg');
    expect(result.svg?.valid).toBe(true);
    expect(result.source.consumed).toBe(true);
    expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(true);
  });

  it('SVG MIME File 정상 본문 → kind이 "svg"이고 svg.valid가 true이고 consumed가 true이고 finding body-consumed-once가 있다', async () => {
    const file = new File([VALID_SVG], 'icon.svg', { type: 'image/svg+xml' });
    const result = await inspectSvgSource(file);
    expect(result.kind).toBe('svg');
    expect(result.svg?.valid).toBe(true);
    expect(result.source.consumed).toBe(true);
    expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(true);
  });

  it('SVG MIME Blob 손상된 본문 "<not-svg>" → kind이 "svg"(MIME 기준)이고 svg.valid가 false이다', async () => {
    const blob = new Blob(['<not-svg>'], { type: 'image/svg+xml' });
    const result = await inspectSvgSource(blob);
    expect(result.kind).toBe('svg');
    expect(result.svg?.valid).toBe(false);
  });

  it('URL string 입력 → 본문 도출 시도 없이 svg가 null이다', async () => {
    const result = await inspectSvgSource('https://example.com/icon.svg');
    expect(result.svg).toBeNull();
  });
});

describe('inspectSvgSource() — Blob/File 본문 도출 byte 가드', () => {
  it('Blob.size가 byteLimit을 넘으면 .text() 호출 없이 finding byte-limit-exceeded가 있고 consumed가 false이다', async () => {
    const big = 'a'.repeat(2048);
    const blob = new Blob([big], { type: 'image/svg+xml' });
    let textCalls = 0;
    const original = blob.text.bind(blob);
    // .text() 호출 여부를 카운트한다 — 사전 가드가 작동하면 0이어야 한다.
    blob.text = (() => {
      textCalls += 1;
      return original();
    }) as Blob['text'];

    const result = await inspectSvgSource(blob, { byteLimit: 256 });

    expect(textCalls).toBe(0);
    expect(result.findings.some((f) => f.code === 'byte-limit-exceeded')).toBe(true);
    expect(result.source.consumed).toBe(false);
    expect(result.findings.some((f) => f.code === 'body-consumed-once')).toBe(false);
    expect(result.svg).toBeNull();
    expect(result.kind).toBe('unknown');
  });
});
