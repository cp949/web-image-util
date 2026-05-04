/**
 * Blob/ArrayBuffer 입력을 HTMLImageElement로 변환하는 경로다.
 *
 * SVG Blob은 본문 스니핑을 통해 보안 검사 경로를 우회하지 못하게 한다.
 */

import { ImageProcessError } from '../../../types';
import { isInlineSvg } from '../../../utils/svg-detection';
import {
  DEFAULT_MAX_SOURCE_BYTES,
  type InternalSourceConverterOptions,
  resolvePassthroughMode,
  resolveSvgSanitizerMode,
} from '../options';
import { sniffSvgFromBlob } from '../svg/data-url';
import { convertSvgToElement } from '../svg/loader';

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

/**
 * Convert Blob to HTMLImageElement (includes SVG high-quality processing)
 */
export async function convertBlobToElement(
  blob: Blob,
  options?: InternalSourceConverterOptions
): Promise<HTMLImageElement> {
  // maxSourceBytes 옵션이 설정된 경우, Blob 크기가 한도를 초과하면 오류를 던진다
  const maxBytes = options?.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  if (maxBytes > 0 && blob.size > maxBytes) {
    throw new ImageProcessError(
      `Blob 크기(${blob.size} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
      'SOURCE_LOAD_FAILED'
    );
  }

  // MIME이 비어 있거나 XML 계열인 Blob도 본문을 스니핑해 SVG 경로를 우회하지 못하게 한다.
  const normalizedType = blob.type.toLowerCase();
  const shouldSniffSvg =
    normalizedType === '' ||
    normalizedType === 'image/svg+xml' ||
    normalizedType.includes('text/xml') ||
    normalizedType.includes('application/xml') ||
    (blob as File).name?.endsWith('.svg');

  // High-quality processing for SVG Blob
  if (
    shouldSniffSvg &&
    (normalizedType === 'image/svg+xml' || (blob as File).name?.endsWith('.svg') || (await sniffSvgFromBlob(blob)))
  ) {
    const svgText = await blob.text();
    return convertSvgToElement(svgText, undefined, undefined, {
      quality: 'auto',
      passthroughMode: resolvePassthroughMode(options),
      sanitizerMode: resolveSvgSanitizerMode(options),
    });
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
