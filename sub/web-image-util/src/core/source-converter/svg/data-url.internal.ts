/**
 * SVG data: URL 디코딩과 인코딩, Blob 본문 SVG 스니핑 헬퍼다.
 *
 * 구조 분해(scheme/metadata/payload)는 `utils/data-url` leaf에 위임하고,
 * 이 모듈은 source-converter 레이어의 크기 제한 정책과 디코딩만 소유한다.
 * 오류 code는 source-converter 의미 체계(`INVALID_SOURCE`, `SOURCE_LOAD_FAILED`)를 따른다.
 */

import { ImageProcessError } from '../../../errors.internal';
import { tryParseDataURL } from '../../../utils/data-url';
import { isInlineSvg } from '../../../utils/svg-detection';
import { MAX_SVG_BYTES } from '../options.internal';
import { checkSvgSizeLimit, createSvgSizeLimitError } from './safety.internal';

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
 * SVG Data URL에서 실제 SVG 문자열을 추출하고 검증한다.
 *
 * @param dataUrl SVG Data URL 문자열
 * @returns 파싱과 검증을 통과한 SVG 문자열
 */
export function parseSvgFromDataUrl(dataUrl: string): string {
  // Format: data:image/svg+xml;base64,<base64-data>
  // Format: data:image/svg+xml;charset=utf-8,<url-encoded-data>
  // Format: data:image/svg+xml,<svg-content>

  const parsed = tryParseDataURL(dataUrl);
  if (!parsed || parsed.payload === '') {
    throw new ImageProcessError('Invalid SVG Data URL format', 'INVALID_SOURCE');
  }

  let svgContent: string;

  // Base64 인코딩은 디코딩 예상 크기부터 확인해 과도한 메모리 사용을 막는다.
  if (parsed.isBase64) {
    const estimatedBytes = estimateBase64DecodedSize(parsed.payload);
    if (estimatedBytes > MAX_SVG_BYTES) {
      throw createSvgSizeLimitError('Data URL SVG', estimatedBytes);
    }
    try {
      svgContent = atob(parsed.payload);
    } catch (error) {
      throw new ImageProcessError('Failed to decode Base64 SVG', 'SOURCE_LOAD_FAILED', { cause: error });
    }
  } else {
    // URL 인코딩 Data URL은 원문 길이가 아닌 디코딩 결과 기준으로 제한을 적용한다.
    try {
      svgContent = decodeURIComponent(parsed.payload);
    } catch {
      // URL 디코딩 실패 시에도 원문으로 한 번 더 SVG 형식을 검증한다.
      svgContent = parsed.payload;
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
