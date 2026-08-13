/**
 * 바이트 시그니처 판정 facts 함수의 특성화 테스트다.
 *
 * blob loader(detectMimeTypeFromBuffer)와 image-info(formatFromBytes) 두 소비자가
 * 갈라져 있던 시그니처 표를 이 함수 하나로 합친 뒤 전수로 고정한다. 폴백 정책은
 * 소비자 쪽 테스트(각 소비자 파일)가 검증하며 여기서는 다루지 않는다.
 */

import { describe, expect, it } from 'vitest';

import { detectFormatFromBytes } from '../../../src/utils/source-utils/byte-signature.internal';

describe('detectFormatFromBytes — 바이트 시그니처 판정', () => {
  it('PNG 시그니처(89 50 4E 47 0D 0A 1A 0A)를 png로 판정한다', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectFormatFromBytes(bytes)).toBe('png');
  });

  it('JPEG 시그니처(FF D8 FF)를 jpeg로 판정한다', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    expect(detectFormatFromBytes(bytes)).toBe('jpeg');
  });

  it('WebP 시그니처(RIFF....WEBP)를 webp로 판정한다', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectFormatFromBytes(bytes)).toBe('webp');
  });

  it('GIF89a 시그니처를 gif로 판정한다', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectFormatFromBytes(bytes)).toBe('gif');
  });

  it('GIF87a 시그니처를 gif로 판정한다', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(detectFormatFromBytes(bytes)).toBe('gif');
  });

  it('AVIF ftyp 시그니처(4~11바이트 ftypavif)를 avif로 판정한다', () => {
    // ISO BMFF 박스: 4바이트 크기(임의) + 'ftyp' + 'avif'
    const bytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(detectFormatFromBytes(bytes)).toBe('avif');
  });

  it('ftyp 박스 크기가 00 00 01 00(ICO 시그니처와 동일)이어도 AVIF로 판정한다', () => {
    // ICO 시그니처(00 00 01 00)와 ftyp 박스 크기 필드가 우연히 겹치는 경계 사례다.
    // AVIF 검사가 ICO보다 먼저 실행되어야 이 충돌에서 올바른 답을 낸다.
    const bytes = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);
    expect(detectFormatFromBytes(bytes)).toBe('avif');
  });

  it('BMP 시그니처(42 4D)를 bmp로 판정한다', () => {
    const bytes = new Uint8Array([0x42, 0x4d, 0x00, 0x00]);
    expect(detectFormatFromBytes(bytes)).toBe('bmp');
  });

  it('TIFF little-endian 시그니처(49 49 2A 00)를 tiff로 판정한다', () => {
    const bytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
    expect(detectFormatFromBytes(bytes)).toBe('tiff');
  });

  it('TIFF big-endian 시그니처(4D 4D 00 2A)를 tiff로 판정한다', () => {
    const bytes = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
    expect(detectFormatFromBytes(bytes)).toBe('tiff');
  });

  it('ICO 시그니처(00 00 01 00)를 ico로 판정한다', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0x01, 0x00]);
    expect(detectFormatFromBytes(bytes)).toBe('ico');
  });

  it('짧은 배열은 시그니처 가드를 통과하지 못해 unknown을 반환한다', () => {
    expect(detectFormatFromBytes(new Uint8Array([0xff, 0xd8]))).toBe('unknown');
    expect(detectFormatFromBytes(new Uint8Array([0x89]))).toBe('unknown');
    expect(detectFormatFromBytes(new Uint8Array([]))).toBe('unknown');
  });

  it('7바이트 PNG prefix는 length>=8 가드 실패로 unknown을 반환한다', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a]);
    expect(detectFormatFromBytes(bytes)).toBe('unknown');
  });

  it('알 수 없는 바이트 패턴은 unknown을 반환한다', () => {
    expect(detectFormatFromBytes(new Uint8Array(12).fill(0))).toBe('unknown');
  });
});
