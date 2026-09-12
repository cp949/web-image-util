/**
 * PNG/GIF/BMP 헤더에서 width/height를 읽는 leaf 파서 테스트.
 */

import { describe, expect, it } from 'vitest';
import { parseRasterHeaderDimensions } from '../../../src/utils/source-utils/raster-header-dimensions.internal';

/** 실제 8x4 PNG(IHDR까지)의 시그니처+IHDR 헤더만 담은 바이트를 만든다 */
function makePngHeaderBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // 시그니처
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR 청크 길이(13, 사용 안 함)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false); // big-endian
  view.setUint32(20, height, false);
  return bytes;
}

function makeGifHeaderBytes(width: number, height: number, variant: '87a' | '89a' = '89a'): Uint8Array {
  const bytes = new Uint8Array(10);
  const signature = variant === '87a' ? [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] : [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
  bytes.set(signature, 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true); // little-endian
  view.setUint16(8, height, true);
  return bytes;
}

function makeBmpHeaderBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x42, 0x4d], 0); // "BM"
  const view = new DataView(bytes.buffer);
  view.setUint32(14, 40, true); // DIB 헤더 크기(BITMAPINFOHEADER = 40)
  view.setInt32(18, width, true); // little-endian, signed
  view.setInt32(22, height, true);
  return bytes;
}

/** 레거시 OS/2 1.x BITMAPCOREHEADER(12바이트, width/height가 unsigned 16bit) 헤더를 만든다 */
function makeBmpCoreHeaderBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x42, 0x4d], 0); // "BM"
  const view = new DataView(bytes.buffer);
  view.setUint32(14, 12, true); // DIB 헤더 크기(BITMAPCOREHEADER = 12)
  view.setUint16(18, width, true);
  view.setUint16(20, height, true);
  return bytes;
}

describe('parseRasterHeaderDimensions', () => {
  it('PNG 헤더에서 width/height를 big-endian으로 읽는다', () => {
    expect(parseRasterHeaderDimensions(makePngHeaderBytes(800, 600))).toEqual({ width: 800, height: 600 });
  });

  it('GIF89a 헤더에서 width/height를 little-endian으로 읽는다', () => {
    expect(parseRasterHeaderDimensions(makeGifHeaderBytes(320, 240, '89a'))).toEqual({ width: 320, height: 240 });
  });

  it('GIF87a 헤더도 동일하게 읽는다', () => {
    expect(parseRasterHeaderDimensions(makeGifHeaderBytes(320, 240, '87a'))).toEqual({ width: 320, height: 240 });
  });

  it('BMP 헤더에서 width/height를 little-endian으로 읽고 음수 height(top-down)는 절댓값으로 바꾼다', () => {
    expect(parseRasterHeaderDimensions(makeBmpHeaderBytes(100, -50))).toEqual({ width: 100, height: 50 });
  });

  it('레거시 BITMAPCOREHEADER(12바이트, OS/2 1.x)는 undefined를 반환한다(width/height 오독 방지)', () => {
    expect(parseRasterHeaderDimensions(makeBmpCoreHeaderBytes(100, 50))).toBeUndefined();
  });

  it('시그니처가 없는 바이트는 undefined를 반환한다(JPEG 등 미지원 포맷 포함)', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);
    expect(parseRasterHeaderDimensions(jpeg)).toBeUndefined();
  });

  it('길이가 모자란 바이트는 undefined를 반환한다(크래시하지 않는다)', () => {
    const truncatedPng = makePngHeaderBytes(800, 600).slice(0, 15);
    expect(parseRasterHeaderDimensions(truncatedPng)).toBeUndefined();
  });

  it('빈 배열은 undefined를 반환한다', () => {
    expect(parseRasterHeaderDimensions(new Uint8Array(0))).toBeUndefined();
  });
});
