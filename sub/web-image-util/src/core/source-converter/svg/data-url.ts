/**
 * SVG data: URL 파싱과 인코딩, Blob 본문 SVG 스니핑 헬퍼다.
 */

import { ImageProcessError } from '../../../types';
import { isInlineSvg } from '../../../utils/svg-detection';
import { MAX_SVG_BYTES } from '../options';
import { checkSvgSizeLimit, createSvgSizeLimitError } from './safety';

/**
 * 문자열이 SVG Data URL 형식인지 판정한다.
 *
 * @param input 검사할 문자열
 * @returns SVG Data URL이면 true
 */
export function isDataUrlSvg(input: string): boolean {
  return /^data:image\/svg\+xml(?:[;,]|$)/i.test(input);
}

/**
 * Base64 문자열의 디코딩 후 예상 크기를 계산한다.
 *
 * @param base64Content 패딩을 포함할 수 있는 Base64 본문
 * @returns 디코딩 후 예상 바이트 수
 */
function estimateBase64DecodedSize(base64Content: string): number {
  const normalized = base64Content.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

/**
 * Blob 앞부분만 읽어 실제 SVG 콘텐츠인지 판정한다.
 *
 * MIME 타입이 비어 있거나 신뢰하기 어려운 업로드에서도 `<svg` 루트를 빠르게 확인하기 위한 헬퍼다.
 * 읽기 실패는 모두 안전하게 false로 처리한다.
 *
 * @param blob 검사할 Blob 객체
 * @param bytes 앞에서부터 읽을 최대 바이트 수
 * @returns SVG 콘텐츠로 판정되면 true
 */
export async function sniffSvgFromBlob(blob: Blob, bytes = 4096): Promise<boolean> {
  try {
    const slice = await blob.slice(0, bytes).text();
    return isInlineSvg(slice);
  } catch {
    return false;
  }
}

/**
 * SVG Data URL에서 실제 SVG 문자열을 추출하고 검증한다.
 *
 * @param dataUrl SVG Data URL 문자열
 * @returns 파싱과 검증을 통과한 SVG 문자열
 */
export function parseSvgFromDataUrl(dataUrl: string): string {
  // Format: data:image/svg+xml;base64,<base64-data>
  // Format: data:image/svg+xml;charset=utf-8,<url-encoded-data>
  // Format: data:image/svg+xml,<svg-content>

  const [header, content] = dataUrl.split(',');
  if (!content) {
    throw new ImageProcessError('Invalid SVG Data URL format', 'INVALID_SOURCE');
  }

  let svgContent: string;

  // Base64 인코딩은 디코딩 예상 크기부터 확인해 과도한 메모리 사용을 막는다.
  if (header.includes('base64')) {
    if (estimateBase64DecodedSize(content) > MAX_SVG_BYTES) {
      throw createSvgSizeLimitError('Data URL SVG');
    }
    try {
      svgContent = atob(content);
    } catch (error) {
      throw new ImageProcessError('Failed to decode Base64 SVG', 'SOURCE_LOAD_FAILED', error as Error);
    }
  } else {
    // URL 인코딩 Data URL은 원문 길이가 아닌 디코딩 결과 기준으로 제한을 적용한다.
    try {
      svgContent = decodeURIComponent(content);
    } catch {
      // URL 디코딩 실패 시에도 원문으로 한 번 더 SVG 형식을 검증한다.
      svgContent = content;
    }
  }

  // 디코딩된 SVG 크기가 허용 한도를 초과하는지 검사한다
  checkSvgSizeLimit(svgContent, 'Data URL SVG');

  // 디코딩 결과가 실제 SVG 루트인지 다시 확인한다.
  if (!isInlineSvg(svgContent)) {
    throw new ImageProcessError('Data URL content is not valid SVG', 'INVALID_SOURCE');
  }

  return svgContent;
}

/**
 * SVG 문자열을 Base64 Data URL로 변환한다.
 *
 * @param svgString SVG 문자열
 * @returns Base64 인코딩된 Data URL
 */
export function createBase64DataUrl(svgString: string): string {
  try {
    // UTF-8 바이트 기준으로 안전하게 Base64 인코딩한다.
    const base64 = btoa(
      Array.from(new TextEncoder().encode(svgString))
        .map((byte) => String.fromCharCode(byte))
        .join('')
    );
    return `data:image/svg+xml;base64,${base64}`;
  } catch {
    // Base64 인코딩이 실패하면 URL 인코딩 방식으로 폴백한다.
    const encoded = encodeURIComponent(svgString);
    return `data:image/svg+xml,${encoded}`;
  }
}
