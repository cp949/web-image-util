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

import { tryParseDataURL } from './data-url';

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
 * 진단 리포트의 sample 토큰으로 그대로 노출해도 안전한, 인식된 MIME 타입 집합.
 *
 * `data:` URL의 metadata 위치(예: `data:<여기>,...`)는 공격자가 임의 텍스트를 심을 수 있는
 * 자리다. blocked/diagnostic sample이 이 위치 값을 무검증으로 echo하면 진단 리포트에 원본
 * 입력이 누출된다. 따라서 이 allowlist에 속한 알려진 MIME만 sample로 노출하고, 그 외 값은
 * 호출처가 `'unknown'`으로 치환해 누출을 차단한다(fail-closed).
 *
 * 보존 대상 raster(`SAFE_RASTER_IMAGE_MIME_TYPES`)에 더해, 차단되더라도 진단상 식별 가치가 있는
 * 알려진 타입을 포함한다.
 */
const RECOGNIZED_DATA_URL_MIME_TYPES = new Set<string>([
  ...SAFE_RASTER_IMAGE_MIME_TYPES,
  'image/svg+xml',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/jxl',
  'application/octet-stream',
  'application/pdf',
  'application/x-shockwave-flash',
  'text/html',
  'text/xml',
  'text/plain',
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
 * @property mimeType     소문자로 정규화된 MIME 타입. metadata가 비어 있으면 `text/plain`.
 * @property isBase64     `;base64` 토큰이 metadata에 포함되어 있는지 여부.
 * @property payload      쉼표 이후의 원본 payload 문자열. 디코딩하지 않는다.
 * @property decodedBytes payload를 디코딩했을 때의 예상 바이트 수. 추정 실패 시 null.
 * @property decodedText  URL-encoded payload의 디코딩 결과. base64이거나 디코딩 실패 시 null.
 *                        같은 payload에 대해 `decodeURIComponent`를 두 번 호출하지 않도록 캐시한다.
 */
export interface SvgDataUrlInfo {
  mimeType: string;
  isBase64: boolean;
  payload: string;
  decodedBytes: number | null;
  decodedText: string | null;
}

/**
 * `data:` URL 문자열을 metadata와 payload로 분해한다.
 *
 * 이 함수는 raw 속성값에 대해 동작하며 HTML entity(`&#59;` 등)를 정규화하지 않는다.
 * 따라서 `data:image/png&#59;base64,...` 같은 입력은 MIME `image/png&#59`로 파싱되어
 * 의도적으로 safe-MIME allowlist에서 떨어진다(안전 측 fail-closed).
 *
 * @param value 검사할 속성값. 앞뒤 공백은 무시한다.
 * @returns `data:` URL이 아닐 경우 null. 그 외에는 구조화된 정보를 반환한다.
 */
export function parseSvgDataUrlRef(value: string): SvgDataUrlInfo | null {
  // 구조 분해(scheme/metadata/payload)는 utils/data-url leaf에 위임한다.
  const parsed = tryParseDataURL(value.trim());
  if (!parsed) return null;

  // metadata 해석은 sanitizer 정책 소유다 — 빈 MIME은 RFC 2397 기본값 text/plain으로,
  // base64 마커는 파라미터 공백 내성으로 판정한다(브라우저 동작 정합).
  const payload = parsed.payload;
  const metadataParts = parsed.metadata.split(';').map((part) => part.trim().toLowerCase());
  const mimeType = metadataParts[0] || 'text/plain';
  const isBase64 = metadataParts.includes('base64');

  if (isBase64) {
    return {
      mimeType,
      isBase64,
      payload,
      decodedBytes: estimateBase64PayloadBytes(payload),
      decodedText: null,
    };
  }

  const decoded = decodeUrlEncodedPayload(payload);
  return {
    mimeType,
    isBase64,
    payload,
    decodedBytes: decoded?.bytes ?? null,
    decodedText: decoded?.text ?? null,
  };
}

/**
 * MIME 타입 문자열이 진단 sample로 노출해도 안전한 인식된 타입인지 판정한다.
 *
 * `parseSvgDataUrlRef()`가 반환하는 `mimeType`은 `data:` metadata 위치의 무검증 값이므로,
 * blocked stage 등에서 sample로 echo하기 전에 본 함수로 걸러 임의 입력 누출을 막는다.
 *
 * @param mimeType 소문자로 정규화된 MIME 타입 문자열
 * @returns allowlist에 속하면 true
 */
export function isRecognizedDataUrlMimeType(mimeType: string): boolean {
  return RECOGNIZED_DATA_URL_MIME_TYPES.has(mimeType);
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
 * 값이 sanitizer가 emit한 canonical `data:image/svg+xml;base64,...` 형식인지 검사한다.
 *
 * `assertSafeSvgContent()` 같은 post-sanitizer guard에서 사용한다. sanitizer는 항상 base64로
 * 재인코딩하므로 다른 형식의 `data:image/svg+xml`이 assert 단계에 도달했다는 것은 sanitizer가
 * 우회되었거나 호출 순서가 깨졌다는 뜻이다. 그 경우 fail-closed로 차단한다.
 *
 * @param value 검사할 속성값
 * @returns canonical form이면서 크기 한계를 통과하면 true
 */
export function isSanitizedSvgDataImageRef(value: string): boolean {
  const info = parseSvgDataUrlRef(value);
  if (!info) return false;
  if (info.mimeType !== 'image/svg+xml') return false;
  if (!info.isBase64) return false;
  if (info.decodedBytes === null) return false;
  return info.decodedBytes <= MAX_EMBEDDED_DATA_IMAGE_BYTES;
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

  if (!info.isBase64) {
    // URL-encoded payload는 parseSvgDataUrlRef 단계에서 이미 decodeURIComponent를 거쳤다.
    return info.decodedText;
  }

  try {
    const normalized = info.payload.replace(/\s+/g, '');
    return new TextDecoder().decode(Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0)));
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
  // TextDecoder('latin1')은 각 바이트를 0~255 코드 포인트로 매핑하므로 btoa의 입력 요건을 충족하며,
  // String.fromCharCode 누적 패턴의 잠재 O(n²) 비용 없이 한 번에 변환한다.
  const bytes = new TextEncoder().encode(svg);
  const binary = new TextDecoder('latin1').decode(bytes);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * base64 payload의 예상 디코딩 바이트 수를 계산한다.
 *
 * 화이트스페이스를 제거한 문자열의 길이로 디코딩 크기를 추정한다.
 * base64 알파벳을 벗어난 문자가 있으면 null을 반환해 호출처가 안전 측 결정을 내리게 한다.
 */
function estimateBase64PayloadBytes(payload: string): number | null {
  const normalized = payload.replace(/\s+/g, '');
  if (!/^[a-z0-9+/]*={0,2}$/i.test(normalized)) return null;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

/**
 * URL-encoded payload를 디코딩하고 결과 텍스트와 UTF-8 바이트 수를 함께 반환한다.
 *
 * `decodeURIComponent`를 한 번만 호출해 결과를 캐시한다. 디코딩 실패 시 null을 반환한다.
 */
function decodeUrlEncodedPayload(payload: string): { text: string; bytes: number } | null {
  try {
    const text = decodeURIComponent(payload);
    return { text, bytes: new TextEncoder().encode(text).length };
  } catch {
    return null;
  }
}
