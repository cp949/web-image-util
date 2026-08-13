/**
 * Blob/ArrayBuffer 입력을 HTMLImageElement로 변환하는 경로다.
 *
 * 판정 모듈이 본문까지 확인한 결과를 받아 SVG 보안 경로 또는 일반 이미지 경로만 실행한다.
 */

import { ImageProcessError } from '../../../types';
import { isInlineSvg } from '../../../utils/svg-detection';
import { assertBlobSizeWithinLimit } from '../detect.internal';
import { buildSvgRenderOptions, type InternalSourceConverterOptions } from '../options.internal';
import { convertSvgToElement } from '../svg/loader.internal';

/**
 * Auto-detect MIME type from ArrayBuffer
 *
 * @param buffer ArrayBuffer data
 * @returns Detected MIME type
 */
export function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
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
    return 'image/png';
  }

  // JPEG signature: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP signature: RIFF ... WEBP (check file header)
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    // Check WEBP signature (bytes 8-11)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
  }

  // GIF signature: GIF87a or GIF89a
  if (bytes.length >= 6) {
    const gifSignature = String.fromCharCode(...bytes.slice(0, 3));
    if (gifSignature === 'GIF') {
      const version = String.fromCharCode(...bytes.slice(3, 6));
      if (version === '87a' || version === '89a') {
        return 'image/gif';
      }
    }
  }

  // BMP signature: BM
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }

  // TIFF signature: II* (little-endian) or MM* (big-endian)
  if (bytes.length >= 4) {
    if (
      (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
    ) {
      return 'image/tiff';
    }
  }

  // ICO signature: 00 00 01 00
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return 'image/x-icon';
  }

  // 바이너리 시그니처가 없더라도 실제 SVG XML이면 보안 경로를 타도록 본문 앞부분을 스니핑한다.
  try {
    const sniffLength = Math.min(bytes.length, 4096);
    const decodedHead = new TextDecoder().decode(bytes.subarray(0, sniffLength));
    if (isInlineSvg(decodedHead)) {
      return 'image/svg+xml';
    }
  } catch {
    // 텍스트 디코딩 실패는 비-SVG 후보로 간주하고 기존 기본값으로 폴백한다.
  }

  // Return PNG as default
  return 'image/png';
}

/** 판정이 끝난 Blob을 일반 이미지 또는 SVG 보안 경로로 변환한다. */
export async function convertBlobToElement(
  blob: Blob,
  sourceType: 'blob' | 'svg-blob',
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  // 직접 호출되더라도 본문을 읽기 전에 공통 크기 상한을 다시 적용한다.
  assertBlobSizeWithinLimit(blob, options?.maxSourceBytes);

  // 판정 모듈이 확정한 SVG Blob만 보안 처리 경로로 보낸다.
  if (sourceType === 'svg-blob') {
    const svgText = await blob.text();
    return convertSvgToElement(svgText, undefined, undefined, buildSvgRenderOptions(options));
  }

  // Regular Blob processing
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(blob);

    // Promise 결정 시 핸들러를 해제하고 Blob URL을 정리한다.
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };
    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new ImageProcessError('Failed to load Blob image', 'SOURCE_LOAD_FAILED'));
    };

    img.src = objectUrl;
  });
}
