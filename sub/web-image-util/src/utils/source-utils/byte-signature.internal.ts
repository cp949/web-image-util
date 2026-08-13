/**
 * 매직바이트로 이미지 포맷을 판정하는 leaf 함수다.
 *
 * MIME이나 파일명 같은 부가 힌트 없이 바이트 자체만 본다. 소비자마다 폴백 정책이 다르므로
 * (로더는 image/png로 떨어뜨리고, 진단 API는 unknown을 그대로 둔다) 그 판단은 여기 두지 않는다.
 * SVG는 매직바이트가 아니라 텍스트 패턴이라 이 함수의 대상이 아니다 — 호출자가 별도로
 * isInlineSvg()를 쓴다.
 */

/** 매직바이트 판정이 낼 수 있는 값. 공개 `ImageFormat`과 달리 bmp/tiff/ico도 표현한다. */
export type ByteSignatureFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'bmp' | 'tiff' | 'ico' | 'unknown';

/** 매직바이트로 이미지 포맷을 판정한다. 시그니처가 없으면 'unknown'이다. */
export function detectFormatFromBytes(bytes: Uint8Array): ByteSignatureFormat {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // WebP: RIFF....WEBP (8~11바이트가 WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  // GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'gif';
  }

  // AVIF: ftyp 박스의 major brand가 avif (4~11바이트)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    bytes[11] === 0x66
  ) {
    return 'avif';
  }

  // BMP: 'BM'
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'bmp';
  }

  // TIFF: II*\0 (little-endian) 또는 MM\0* (big-endian)
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return 'tiff';
  }

  // ICO: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'ico';
  }

  return 'unknown';
}
