/**
 * PNG/GIF/BMP 헤더에서 width/height를 읽는 leaf 함수다.
 *
 * `byte-signature.internal.ts`와 같은 계층 — 판정만 하고 정책(거부 여부)은 갖지 않는다.
 * 포맷 판정 자체는 `detectFormatFromBytes()`에 위임해 매직바이트 상수를 이 파일에 다시
 * 두지 않는다(단일 소유). 세 포맷 모두 매직바이트 직후 고정 오프셋에 width/height가 있어
 * 세그먼트 스캔이 필요 없다.
 *
 * 향후 추가 포맷 지원: JPEG(SOF 마커를 찾으려면 세그먼트를 순회해야 함)·WebP(VP8/VP8L/VP8X별로
 * 파싱이 다름)는 고정 오프셋 포맷과 비용이 달라 v1에서 제외했다. 필요가 확인되면 이 파일에
 * 개별 파서를 추가한다.
 */

import { detectFormatFromBytes } from './byte-signature.internal';

/** 헤더에서 읽어낸 raster 크기. clamp/검증 없이 원시값을 그대로 담는다 */
export interface RasterHeaderDimensions {
  width: number;
  height: number;
}

/** PNG IHDR: 8바이트 시그니처 뒤 4바이트 길이(13) + "IHDR" + width(4, BE) + height(4, BE) */
function parsePngDimensions(bytes: Uint8Array): RasterHeaderDimensions | undefined {
  if (bytes.length < 24) {
    return undefined;
  }
  const width = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
  const height = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
  return { width, height };
}

/** GIF Logical Screen Descriptor: "GIF87a"/"GIF89a"(6바이트) 뒤 width(2, LE) + height(2, LE) */
function parseGifDimensions(bytes: Uint8Array): RasterHeaderDimensions | undefined {
  if (bytes.length < 10) {
    return undefined;
  }
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return { width, height };
}

/** width/height가 오프셋 18/22에 4바이트 signed LE로 오는 DIB 헤더 크기(BITMAPINFOHEADER 계열) */
const SUPPORTED_BMP_DIB_HEADER_SIZES = new Set([40, 52, 56, 108, 124]);

/**
 * BMP BITMAPINFOHEADER: "BM"(2바이트) 뒤 오프셋 14에 DIB 헤더 크기(4, LE), 오프셋 18에
 * width(4, signed LE), 오프셋 22에 height(4, signed LE, 음수면 top-down).
 *
 * 레거시 OS/2 1.x BITMAPCOREHEADER(크기 12, width/height가 unsigned 16bit)는 같은 오프셋에서
 * 다른 필드 폭을 쓰기 때문에 헤더 크기를 먼저 확인해 지원 목록 밖이면 undefined로 거른다 —
 * 그러지 않으면 width/height를 인접 필드와 뒤섞어 잘못된 값을 반환한다(false-reject 위험).
 */
function parseBmpDimensions(bytes: Uint8Array): RasterHeaderDimensions | undefined {
  if (bytes.length < 26) {
    return undefined;
  }
  const dibHeaderSize = (bytes[14] | (bytes[15] << 8) | (bytes[16] << 16) | (bytes[17] << 24)) >>> 0;
  if (!SUPPORTED_BMP_DIB_HEADER_SIZES.has(dibHeaderSize)) {
    return undefined;
  }
  const width = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24) | 0;
  const height = bytes[22] | (bytes[23] << 8) | (bytes[24] << 16) | (bytes[25] << 24) | 0;
  return { width: Math.abs(width), height: Math.abs(height) };
}

/** PNG/GIF/BMP 중 하나로 판정되면 width/height를 반환한다. 그 외(JPEG/WebP 등 미지원 포맷)는 undefined다 */
export function parseRasterHeaderDimensions(bytes: Uint8Array): RasterHeaderDimensions | undefined {
  switch (detectFormatFromBytes(bytes)) {
    case 'png':
      return parsePngDimensions(bytes);
    case 'gif':
      return parseGifDimensions(bytes);
    case 'bmp':
      return parseBmpDimensions(bytes);
    default:
      return undefined;
  }
}
