import { describe, expect, it, vi } from 'vitest';
import { getImageFormat } from '../../../../src';
import {
  formatFromBlobMetadata,
  formatFromBytes,
  formatFromMimeType,
} from '../../../../src/utils/image-info/format-detection.internal';

describe('getImageFormat', () => {
  it('Blob MIME만으로 포맷을 단독 조회한다', async () => {
    const blob = new Blob(['mock'], { type: 'image/webp' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');

    await expect(getImageFormat(blob)).resolves.toBe('webp');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('확장자로 포맷을 알 수 있는 URL을 네트워크 요청 없이 반환한다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      await expect(getImageFormat('https://example.com/photo.webp?cache=1')).resolves.toBe('webp');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('호스트명이 이미지 확장자로 끝나도 포맷으로 판정하지 않는다', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      // 확장자는 경로에서 읽어야 한다. 아래 입력은 경로가 비어 있고 호스트명만 .svg/.png로 끝난다.
      await expect(getImageFormat('https://ex.com.svg')).resolves.toBe('unknown');
      await expect(getImageFormat('//cdn.example.png')).resolves.toBe('unknown');
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('formatFromMimeType', () => {
  it('대문자 MIME 타입을 소문자로 정규화하여 포맷을 반환한다', () => {
    expect(formatFromMimeType('IMAGE/JPEG')).toBe('jpeg');
    expect(formatFromMimeType('IMAGE/PNG')).toBe('png');
    expect(formatFromMimeType('Image/WebP')).toBe('webp');
  });

  it(';charset= 파라미터가 붙어도 MIME을 올바르게 판정한다', () => {
    expect(formatFromMimeType('image/jpeg;charset=utf-8')).toBe('jpeg');
    expect(formatFromMimeType('image/png; charset=utf-8')).toBe('png');
  });

  it('알 수 없는 MIME 타입은 unknown을 반환한다', () => {
    expect(formatFromMimeType('image/bmp')).toBe('unknown');
    expect(formatFromMimeType('text/plain')).toBe('unknown');
    expect(formatFromMimeType('')).toBe('unknown');
  });

  it('지원하는 MIME 타입 전체를 올바른 포맷으로 변환한다', () => {
    expect(formatFromMimeType('image/avif')).toBe('avif');
    expect(formatFromMimeType('image/gif')).toBe('gif');
    expect(formatFromMimeType('image/svg+xml')).toBe('svg');
  });
});

// 경로 확장자 → 포맷 매핑 자체의 검증은 정본 소유자인
// tests/unit/utils/source-utils.test.ts의 getFormatFromPath 블록에 있다.

describe('formatFromBytes', () => {
  it('AVIF ftyp 시그니처를 avif로 판정한다', () => {
    // ISO BMFF 박스: 4바이트 크기 + 'ftyp' + 'avif'
    const avifBytes = new Uint8Array([
      0x00,
      0x00,
      0x00,
      0x18, // 박스 크기 (임의)
      0x66,
      0x74,
      0x79,
      0x70, // 'ftyp'
      0x61,
      0x76,
      0x69,
      0x66, // 'avif'
    ]);
    expect(formatFromBytes(avifBytes)).toBe('avif');
  });

  it('2바이트 이하의 짧은 배열은 unknown을 반환한다', () => {
    // JPEG 시그니처는 최소 3바이트가 필요하므로 2바이트는 매칭 실패
    expect(formatFromBytes(new Uint8Array([0xff, 0xd8]))).toBe('unknown');
    expect(formatFromBytes(new Uint8Array([0x89]))).toBe('unknown');
    expect(formatFromBytes(new Uint8Array([]))).toBe('unknown');
  });

  it('알 수 없는 바이트 패턴은 unknown을 반환한다', () => {
    expect(formatFromBytes(new Uint8Array(12).fill(0))).toBe('unknown');
  });
});

describe('formatFromBlobMetadata — 포맷 판정 우선순위', () => {
  it('Blob type이 있으면 MIME에서 포맷을 즉시 반환한다', () => {
    // type이 webp이므로 name이 .png여도 webp가 반환되어야 한다
    const file = new File(['data'], 'photo.png', { type: 'image/webp' });
    expect(formatFromBlobMetadata(file)).toBe('webp');
  });

  it('Blob type이 unknown이면 File name에서 포맷을 읽는다', () => {
    const file = new File(['data'], 'photo.png', { type: '' });
    expect(formatFromBlobMetadata(file)).toBe('png');
  });

  it('File name은 URL 스킴으로 해석하지 않고 확장자를 읽는다', () => {
    const cases = [
      ['http:photo.png', 'png'],
      ['https://example.com.svg', 'svg'],
      ['C:\\fakepath\\사진 100%.png', 'png'],
      ['보고서:2026.png', 'png'],
    ] as const;

    for (const [name, expected] of cases) {
      expect(formatFromBlobMetadata(new File(['data'], name, { type: '' }))).toBe(expected);
    }
  });

  it('#와 ?는 파일명의 일부이므로 잘라내지 않고 확장자를 읽는다', () => {
    const cases = [
      ['사진#1.png', 'png'],
      ['v1.0#final.jpg', 'jpg'],
      ['report?draft.webp', 'webp'],
      ['Q&A#2.svg', 'svg'],
    ] as const;

    for (const [name, expected] of cases) {
      expect(formatFromBlobMetadata(new File(['data'], name, { type: '' }))).toBe(expected);
    }
  });

  it('URL에서 파생된 파일명은 쿼리·해시를 걷어낸 확장자로도 판정한다', () => {
    const cases = [
      ['photo.png?v=1', 'png'],
      ['icon.svg#symbol', 'svg'],
    ] as const;

    for (const [name, expected] of cases) {
      expect(formatFromBlobMetadata(new File(['data'], name, { type: '' }))).toBe(expected);
    }
  });

  it('Blob type도 unknown이고 name도 없으면 unknown을 반환한다', () => {
    // 일반 Blob은 name 속성이 없어 bytes 단계 전에 unknown이 된다
    const blob = new Blob(['data'], { type: '' });
    expect(formatFromBlobMetadata(blob)).toBe('unknown');
  });
});

describe('getImageFormat — bytes fallback', () => {
  it('type이 없는 Blob은 바이트 시그니처로 포맷을 판정한다', async () => {
    // PNG 매직바이트: \x89PNG\r\n\x1a\n
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const blob = new Blob([pngSignature], { type: '' });
    await expect(getImageFormat(blob)).resolves.toBe('png');
  });

  it('SVG는 바이트 시그니처가 없으므로 파일명 판정이 최종 답이 된다', async () => {
    // formatFromBytes에 SVG 분기가 없어 파일명에서 놓치면 unknown으로 끝난다
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
    const file = new File([svg], '사진#1.svg', { type: '' });
    await expect(getImageFormat(file)).resolves.toBe('svg');
  });
});
