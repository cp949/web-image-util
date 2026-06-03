import { describe, expect, it } from 'vitest';
import { extractSvgBody } from '../../../src/utils/inspect-svg-source/body-extraction';

const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';

describe('extractSvgBody() — string 경로', () => {
  it('inline SVG string → svgString 그대로 반환하고 consumed false이다', async () => {
    const result = await extractSvgBody(VALID_SVG, 'string', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toBe(VALID_SVG);
      expect(result.consumed).toBe(false);
    }
  });

  it('비-SVG string도 svgString 그대로 반환한다 — 판정은 호출자가 한다', async () => {
    const result = await extractSvgBody('<html></html>', 'string', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toBe('<html></html>');
      expect(result.consumed).toBe(false);
    }
  });
});

describe('extractSvgBody() — data-url 경로', () => {
  it('유효한 SVG Data URL(charset) → svgString 도출, consumed false이다', async () => {
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(VALID_SVG)}`;
    const result = await extractSvgBody(dataUrl, 'data-url', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toContain('<svg');
      expect(result.consumed).toBe(false);
    }
  });

  it('유효한 SVG Data URL(base64) → svgString 도출, consumed false이다', async () => {
    // PHN2Zy8+ = btoa('<svg/>')
    const result = await extractSvgBody('data:image/svg+xml;base64,PHN2Zy8+', 'data-url', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toBe('<svg/>');
      expect(result.consumed).toBe(false);
    }
  });

  it('잘못된 base64 Data URL → failure "data-url-decode-failed"이다', async () => {
    const result = await extractSvgBody('data:image/svg+xml;base64,!!!invalid!!!', 'data-url', 1_000_000);
    expect('failure' in result).toBe(true);
    if ('failure' in result) {
      expect(result.failure).toBe('data-url-decode-failed');
    }
  });

  it('Data URL decode 실패 시 consumed 필드가 없다', async () => {
    const result = await extractSvgBody('data:image/svg+xml;base64,!!!bad!!!', 'data-url', 1_000_000);
    if ('failure' in result) {
      expect(result.consumed).toBeUndefined();
    }
  });
});

describe('extractSvgBody() — blob/file 경로', () => {
  it('Blob 정상 본문 → svgString 도출, consumed true이다', async () => {
    const blob = new Blob([VALID_SVG], { type: 'image/svg+xml' });
    const result = await extractSvgBody(blob, 'blob', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toBe(VALID_SVG);
      expect(result.consumed).toBe(true);
    }
  });

  it('File 정상 본문 → svgString 도출, consumed true이다', async () => {
    const file = new File([VALID_SVG], 'icon.svg', { type: 'image/svg+xml' });
    const result = await extractSvgBody(file, 'file', 1_000_000);
    expect('svgString' in result).toBe(true);
    if ('svgString' in result) {
      expect(result.svgString).toBe(VALID_SVG);
      expect(result.consumed).toBe(true);
    }
  });

  it('Blob.size가 byteLimit 초과 → .text() 호출 없음, failure "byte-limit-exceeded"이다', async () => {
    const blob = new Blob(['a'.repeat(2048)], { type: 'image/svg+xml' });
    let textCalls = 0;
    const original = blob.text.bind(blob);
    blob.text = (() => {
      textCalls += 1;
      return original();
    }) as Blob['text'];

    const result = await extractSvgBody(blob, 'blob', 256);

    expect(textCalls).toBe(0);
    expect('failure' in result).toBe(true);
    if ('failure' in result) {
      expect(result.failure).toBe('byte-limit-exceeded');
      expect(result.consumed).toBeUndefined();
    }
  });

  it.skip('Blob.size 가드 통과 후 UTF-8 bytes가 byteLimit 초과 → failure "byte-limit-exceeded", consumed true이다', async () => {
    // jsdom에서 Blob.size는 UTF-8 바이트 수이므로 size === encodeBytes 가 성립한다.
    // 사후 byte 체크가 트리거되려면 .size < byteLimit < encodeBytes 이어야 하는데
    // jsdom 환경에서는 이 조건을 충족하는 Blob을 만들 수 없다.
    // 브라우저 테스트(TASK-05+)로 이관 예정.
  });

  it('url-string → failure "fetch-not-attempted-in-this-task"이다', async () => {
    const url = new URL('https://example.com/foo.svg');
    const result = await extractSvgBody(url, 'url-string', 1_000_000);
    expect('failure' in result).toBe(true);
    if ('failure' in result) {
      expect(result.failure).toBe('fetch-not-attempted-in-this-task');
    }
  });
});
