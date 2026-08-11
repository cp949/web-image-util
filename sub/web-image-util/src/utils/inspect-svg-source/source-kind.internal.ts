import { isDataUrlSvg } from '../../core/source-converter/svg/data-url.internal';
import { hasExplicitUrlScheme, isProtocolRelativeUrl } from '../../core/source-converter/url/policy.internal';
// 타입만 import — JS 런타임 순환 차단. 런타임 값 import 추가 시 순환이 남는다.
import type { InspectSvgSourceInput, InspectSvgSourceMeta } from './types.internal';

const textEncoder = new TextEncoder();

/**
 * 입력값의 originalKind를 판정한다.
 * File은 Blob 하위 타입이므로 Blob 분기보다 먼저 평가해야 한다(D4).
 */
export function detectOriginalKind(source: InspectSvgSourceInput): InspectSvgSourceMeta['originalKind'] {
  if (source instanceof File) return 'file';
  if (source instanceof Blob) return 'blob';
  if (source instanceof URL) return 'url-string';
  // 위 instanceof 분기로 string 외 타입은 모두 제거됐다.
  if (isDataUrlSvg(source) || source.startsWith('data:')) return 'data-url';
  if (hasExplicitUrlScheme(source) || isProtocolRelativeUrl(source)) return 'url-string';
  return 'string';
}

/**
 * 입력 소스의 byte 수를 추정한다.
 * - Blob/File: .size 사용.
 * - url-string: 추정 불가 → null.
 * - string/data-url: UTF-8 인코딩 후 byte 수 계산.
 */
export function estimateSourceBytes(
  source: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind']
): number | null {
  if (originalKind === 'blob' || originalKind === 'file') {
    return (source as Blob).size;
  }
  if (originalKind === 'url-string') {
    return null;
  }
  // 'string' | 'data-url'
  return textEncoder.encode(source as string).byteLength;
}
