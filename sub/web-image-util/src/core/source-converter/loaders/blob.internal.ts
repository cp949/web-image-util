/**
 * Blob/ArrayBuffer 입력을 HTMLImageElement로 변환하는 경로다.
 *
 * 판정 모듈이 본문까지 확인한 결과를 받아 SVG 보안 경로 또는 일반 이미지 경로만 실행한다.
 */

import { formatToMimeType } from '../../../utils/format-utils';
import { decodeImageFromBlob } from '../../../utils/image-decode.internal';
import { readBlobAsText } from '../../../utils/source-utils/blob-io.internal';
import { detectFormatFromBytes } from '../../../utils/source-utils/byte-signature.internal';
import { DEFAULT_SVG_SNIFF_BYTES, isInlineSvg } from '../../../utils/svg-detection';
import { assertBlobSizeWithinLimit } from '../detect.internal';
import { buildSvgRenderOptions, type InternalSourceConverterOptions } from '../options.internal';
import { convertSvgToElement } from '../svg/loader.internal';

/**
 * ArrayBuffer 입력의 MIME 타입을 자동 판정한다.
 *
 * 판정 표 자체는 detectFormatFromBytes가 소유한다(image-info의 formatFromBytes와 공유).
 * 이 함수가 갖는 건 폴백 정책뿐이다 — 시그니처가 없으면 SVG 텍스트를 스니핑하고,
 * 그래도 없으면 image/png로 떨어뜨린다.
 */
export function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const format = detectFormatFromBytes(bytes);

  // bmp/tiff/ico는 공개 ImageFormat이 표현하지 못해 formatToMimeType에 넘길 수 없다 —
  // 여기서만 쓰는 raw 컨테이너 MIME이라 로컬로 직접 매핑한다.
  switch (format) {
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
      return 'image/tiff';
    case 'ico':
      return 'image/x-icon';
    case 'unknown':
      break;
    default:
      // 여기 도달하면 format은 'png'|'jpeg'|'webp'|'gif'|'avif' — ImageFormat의 부분집합이다.
      return formatToMimeType(format);
  }

  // 바이너리 시그니처가 없더라도 실제 SVG XML이면 보안 경로를 타도록 본문 앞부분을 스니핑한다.
  try {
    const sniffLength = Math.min(bytes.length, DEFAULT_SVG_SNIFF_BYTES);
    const decodedHead = new TextDecoder().decode(bytes.subarray(0, sniffLength));
    if (isInlineSvg(decodedHead)) {
      return 'image/svg+xml';
    }
  } catch {
    // 텍스트 디코딩 실패는 비-SVG 후보로 간주하고 기존 기본값으로 폴백한다.
  }

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
    const svgText = await readBlobAsText(blob);
    return convertSvgToElement(svgText, undefined, undefined, buildSvgRenderOptions(options));
  }

  // Regular Blob processing
  return decodeImageFromBlob(blob, {
    errorCode: 'SOURCE_LOAD_FAILED',
    message: 'Failed to load Blob image',
  });
}
