/**
 * SVG embedded Data URL 정책 유틸리티의 파싱, 허용 MIME, 크기 제한을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import {
  isSafeRasterDataImageRef,
  isSanitizedSvgDataImageRef,
  isSvgDataImageRef,
  MAX_EMBEDDED_DATA_IMAGE_BYTES,
  MAX_NESTED_SVG_DEPTH,
  parseSvgDataUrlRef,
} from '../../../src/utils/svg-data-url-policy';

const ONE_PIXEL_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const URL_ENCODED_SVG_DATA_URL = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';
const URL_ENCODED_SVG_TEXT = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const BASE64_SVG_DATA_URL = `data:image/svg+xml;base64,${btoa(URL_ENCODED_SVG_TEXT)}`;

/** 최대 허용 바이트를 1바이트 초과하도록 최소에 가깝게 base64 길이를 맞춘다. */
function createOversizedDataImageUrl(mimeType = 'image/png'): string {
  const payloadLength = Math.ceil(((MAX_EMBEDDED_DATA_IMAGE_BYTES + 1) * 4) / 3);
  return `data:${mimeType};base64,${'A'.repeat(payloadLength)}`;
}

describe('상수', () => {
  it('MAX_EMBEDDED_DATA_IMAGE_BYTES는 2MB(2097152)이다', () => {
    expect(MAX_EMBEDDED_DATA_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  });

  it('MAX_NESTED_SVG_DEPTH는 5이다', () => {
    expect(MAX_NESTED_SVG_DEPTH).toBe(5);
  });
});

describe('parseSvgDataUrlRef()', () => {
  it('data: 접두사가 없으면 null을 반환한다', () => {
    expect(parseSvgDataUrlRef('https://example.com/image.png')).toBeNull();
  });

  it('쉼표가 없으면 null을 반환한다', () => {
    expect(parseSvgDataUrlRef('data:image/png;base64')).toBeNull();
  });

  it('MIME 타입을 추출한다', () => {
    expect(parseSvgDataUrlRef(' data:IMAGE/PNG;base64,AA== ')?.mimeType).toBe('image/png');
  });

  it('base64 플래그를 감지한다', () => {
    expect(parseSvgDataUrlRef('data:image/png;charset=utf-8;base64,AA==')?.isBase64).toBe(true);
    expect(parseSvgDataUrlRef('data:image/png,%00')?.isBase64).toBe(false);
  });

  it('payload를 분리한다', () => {
    expect(parseSvgDataUrlRef('data:image/png;base64,abc,def')?.payload).toBe('abc,def');
  });

  it('base64 payload는 decodedBytes를 추정하고 decodedText는 null이다', () => {
    const info = parseSvgDataUrlRef('data:image/png;base64,aGVsbG8=');

    expect(info).toMatchObject({
      decodedBytes: 5,
      decodedText: null,
      isBase64: true,
      mimeType: 'image/png',
      payload: 'aGVsbG8=',
    });
  });

  it('URL-encoded payload는 decodedText를 채운다', () => {
    const info = parseSvgDataUrlRef(URL_ENCODED_SVG_DATA_URL);

    expect(info).toMatchObject({
      decodedBytes: new TextEncoder().encode(URL_ENCODED_SVG_TEXT).length,
      decodedText: URL_ENCODED_SVG_TEXT,
      isBase64: false,
      mimeType: 'image/svg+xml',
    });
  });

  it('메타데이터가 없으면 MIME을 text/plain으로 처리한다', () => {
    expect(parseSvgDataUrlRef('data:,hello')?.mimeType).toBe('text/plain');
  });
});

describe('isSafeRasterDataImageRef()', () => {
  it('image/png base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef(ONE_PIXEL_PNG_DATA_URL)).toBe(true);
  });

  it('image/jpeg base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/jpeg;base64,AA==')).toBe(true);
  });

  it('image/webp base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/webp;base64,AA==')).toBe(true);
  });

  it('image/gif base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/gif;base64,AA==')).toBe(true);
  });

  it('image/bmp base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/bmp;base64,AA==')).toBe(true);
  });

  it('image/avif base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/avif;base64,AA==')).toBe(true);
  });

  it('image/x-icon base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/x-icon;base64,AA==')).toBe(true);
  });

  it('image/vnd.microsoft.icon base64는 통과한다', () => {
    expect(isSafeRasterDataImageRef('data:image/vnd.microsoft.icon;base64,AA==')).toBe(true);
  });

  it('image/svg+xml는 거부한다', () => {
    expect(isSafeRasterDataImageRef(BASE64_SVG_DATA_URL)).toBe(false);
  });

  it('비이미지 MIME은 거부한다', () => {
    expect(isSafeRasterDataImageRef('data:text/plain;base64,AA==')).toBe(false);
  });

  it('크기가 MAX_EMBEDDED_DATA_IMAGE_BYTES를 초과하면 거부한다', () => {
    expect(isSafeRasterDataImageRef(createOversizedDataImageUrl())).toBe(false);
  });

  it('data: 접두사가 없으면 false를 반환한다', () => {
    expect(isSafeRasterDataImageRef('not-data-url')).toBe(false);
  });

  it('보안: HTML entity로 인코딩된 MIME은 allowlist에서 탈락한다', () => {
    expect(isSafeRasterDataImageRef('data:image/png&#59;base64,AA==')).toBe(false);
  });
});

describe('isSvgDataImageRef()', () => {
  it('data:image/svg+xml는 true를 반환한다', () => {
    expect(isSvgDataImageRef(BASE64_SVG_DATA_URL)).toBe(true);
    expect(isSvgDataImageRef(URL_ENCODED_SVG_DATA_URL)).toBe(true);
  });

  it('data:image/png는 false를 반환한다', () => {
    expect(isSvgDataImageRef(ONE_PIXEL_PNG_DATA_URL)).toBe(false);
  });

  it('data: 비접두는 false를 반환한다', () => {
    expect(isSvgDataImageRef('<svg />')).toBe(false);
  });
});

describe('isSanitizedSvgDataImageRef()', () => {
  it('base64 SVG data URL은 true를 반환한다', () => {
    expect(isSanitizedSvgDataImageRef(BASE64_SVG_DATA_URL)).toBe(true);
  });

  it('URL-encoded SVG는 false를 반환한다 (canonical form 아님)', () => {
    expect(isSanitizedSvgDataImageRef(URL_ENCODED_SVG_DATA_URL)).toBe(false);
  });

  it('PNG data URL은 false를 반환한다', () => {
    expect(isSanitizedSvgDataImageRef(ONE_PIXEL_PNG_DATA_URL)).toBe(false);
  });

  it('크기가 MAX_EMBEDDED_DATA_IMAGE_BYTES를 초과하면 false를 반환한다', () => {
    expect(isSanitizedSvgDataImageRef(createOversizedDataImageUrl('image/svg+xml'))).toBe(false);
  });
});
