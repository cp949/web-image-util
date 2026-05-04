/**
 * SVG embedded `data:image/*` 참조 보존 정책 유틸리티.
 *
 * @description
 * SVG 안에 정상적으로 포함되는 embedded image Data URL을 sanitizer가 무차별 제거하지 않도록
 * MIME 타입과 payload 크기 기준으로 안전 여부를 판정한다.
 *
 * - raster `data:image/*`는 디코딩하지 않고 그대로 보존한다.
 * - `data:image/svg+xml`은 호출처에서 nested SVG를 재정제하기 위해 디코드/인코드 helper를 제공한다.
 *
 * 이 모듈은 브라우저 전용이며 Node 단독 실행을 위한 polyfill을 추가하지 않는다.
 */

/**
 * sanitizer가 보존할 raster `data:image/*` MIME 타입 목록.
 *
 * `image/svg+xml`은 nested SVG 재정제 경로로 처리되므로 이 집합에 포함하지 않는다.
 */
const SAFE_RASTER_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

/**
 * 단일 embedded Data URL이 가질 수 있는 최대 디코딩 바이트 수.
 *
 * SVG 전체 크기 제한과 별개로, 한 개의 `data:` 참조가 비정상적으로 크지 않도록 추가 상한을 둔다.
 */
export const MAX_EMBEDDED_DATA_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * sanitizer가 nested `data:image/svg+xml`을 재귀 정제할 때 허용할 최대 깊이.
 *
 * lightweight와 strict 양쪽 sanitizer가 동일한 한도를 공유한다.
 * 이 한도를 넘으면 속성을 제거해 fail-closed로 처리한다.
 */
export const MAX_NESTED_SVG_DEPTH = 5;

/**
 * `parseSvgDataUrlRef()` 결과 타입.
 *
 * @property mimeType    소문자로 정규화된 MIME 타입. metadata가 비어 있으면 `text/plain`.
 * @property isBase64    `;base64` 토큰이 metadata에 포함되어 있는지 여부.
 * @property payload     쉼표 이후의 원본 payload 문자열. 디코딩하지 않는다.
 * @property decodedBytes payload를 디코딩했을 때의 예상 바이트 수. 추정 실패 시 null.
 */
export interface SvgDataUrlInfo {
  mimeType: string;
  isBase64: boolean;
  payload: string;
  decodedBytes: number | null;
}

/**
 * `data:` URL 문자열을 metadata와 payload로 분해한다.
 *
 * @param value 검사할 속성값. 앞뒤 공백은 무시한다.
 * @returns `data:` URL이 아닐 경우 null. 그 외에는 구조화된 정보를 반환한다.
 */
export function parseSvgDataUrlRef(value: string): SvgDataUrlInfo | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('data:')) return null;

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return null;

  const metadata = trimmed.slice(5, commaIndex);
  const payload = trimmed.slice(commaIndex + 1);
  const metadataParts = metadata.split(';').map((part) => part.trim().toLowerCase());
  const mimeType = metadataParts[0] || 'text/plain';
  const isBase64 = metadataParts.includes('base64');

  return {
    mimeType,
    isBase64,
    payload,
    decodedBytes: estimateDataUrlPayloadBytes(payload, isBase64),
  };
}

/**
 * 값이 보존 대상인 raster `data:image/*` 참조인지 검사한다.
 *
 * @param value 검사할 속성값
 * @returns 보존 대상이면 true. SVG/비이미지/크기 초과는 false.
 */
export function isSafeRasterDataImageRef(value: string): boolean {
  const info = parseSvgDataUrlRef(value);
  if (!info) return false;
  if (!SAFE_RASTER_IMAGE_MIME_TYPES.has(info.mimeType)) return false;
  if (info.decodedBytes === null) return false;
  return info.decodedBytes <= MAX_EMBEDDED_DATA_IMAGE_BYTES;
}

/**
 * 값이 `data:image/svg+xml` 참조인지 검사한다.
 *
 * 이 검사는 nested SVG 재정제 경로의 진입점 판정에만 사용한다. 실제 보존 여부는
 * 호출처에서 디코딩/재정제/재인코딩 결과로 결정한다.
 *
 * @param value 검사할 속성값
 * @returns `data:image/svg+xml`이면 true
 */
export function isSvgDataImageRef(value: string): boolean {
  const info = parseSvgDataUrlRef(value);
  return info?.mimeType === 'image/svg+xml';
}

/**
 * `data:image/svg+xml` 참조의 nested SVG 본문을 UTF-8 문자열로 디코딩한다.
 *
 * 디코딩 가능한 크기 상한(`MAX_EMBEDDED_DATA_IMAGE_BYTES`)을 넘거나, base64/URL 디코딩이
 * 실패하면 null을 반환해 호출처가 속성을 제거하도록 유도한다(fail-closed).
 *
 * @param value 검사할 속성값
 * @returns 디코딩된 SVG 문자열 또는 null
 */
export function decodeSvgDataImageRef(value: string): string | null {
  const info = parseSvgDataUrlRef(value);
  if (!info || info.mimeType !== 'image/svg+xml') return null;
  if (info.decodedBytes === null || info.decodedBytes > MAX_EMBEDDED_DATA_IMAGE_BYTES) return null;

  try {
    if (info.isBase64) {
      const normalized = info.payload.replace(/\s+/g, '');
      return new TextDecoder().decode(Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0)));
    }
    return decodeURIComponent(info.payload);
  } catch {
    return null;
  }
}

/**
 * 정제된 SVG 문자열을 `data:image/svg+xml;base64,...` 형식으로 다시 인코딩한다.
 *
 * 인코딩 형식을 base64로 통일해 다음을 보장한다.
 * - URL 인코딩 단계가 추가되지 않으므로 `assertSafeSvgContent()`가 단일 정책으로 검사 가능
 * - 결과 문자열이 sanitizer 정규식에 의해 다시 변형되지 않는다
 *
 * @param svg base64로 인코딩할 SVG 문자열
 * @returns `data:image/svg+xml;base64,...` Data URL
 */
export function encodeSvgDataImageRef(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Data URL payload의 예상 디코딩 바이트 수를 계산한다.
 *
 * - base64: 화이트스페이스를 제거한 문자열의 길이로 디코딩 크기를 추정한다.
 *   base64 알파벳을 벗어난 문자가 있으면 null을 반환해 호출처가 안전 측 결정을 내리게 한다.
 * - URL-encoded: `decodeURIComponent` 후 UTF-8 바이트 수를 계산한다.
 *   디코딩 실패는 null로 보고한다.
 */
function estimateDataUrlPayloadBytes(payload: string, isBase64: boolean): number | null {
  if (isBase64) {
    const normalized = payload.replace(/\s+/g, '');
    if (!/^[a-z0-9+/]*={0,2}$/i.test(normalized)) return null;
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    return Math.floor((normalized.length * 3) / 4) - padding;
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return null;
  }
}
