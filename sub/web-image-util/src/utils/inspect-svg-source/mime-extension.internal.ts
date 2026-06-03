import { isDataUrlSvg } from '../../core/source-converter/svg/data-url.internal';
import { normalizePolicyUrl } from '../../core/source-converter/url/policy.internal';
// 타입만 import — JS 런타임 순환 차단. 런타임 값 import 추가 시 순환이 남는다.
import type { InspectSvgSourceInput, InspectSvgSourceMeta } from '../inspect-svg-source';

/**
 * 입력의 MIME 타입과 파일 확장자를 추출한다.
 * File 분기는 Blob보다 먼저 평가된다(originalKind로 이미 구분됨).
 */
export function detectMimeAndExtension(
  source: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind']
): { mime: string | null; extension: string | null } {
  if (originalKind === 'data-url') {
    const str = source as string;
    // isDataUrlSvg가 true이면 mime을 'image/svg+xml'로 확정한다(확장 sniff 우선).
    if (isDataUrlSvg(str)) {
      return { mime: 'image/svg+xml', extension: null };
    }
    const match = str.match(/^data:([^;,]+)/i);
    return { mime: match ? match[1].toLowerCase() : null, extension: null };
  }

  if (originalKind === 'url-string') {
    try {
      const urlObj = source instanceof URL ? source : new URL(normalizePolicyUrl(source as string));
      const lastDot = urlObj.pathname.lastIndexOf('.');
      const ext = lastDot >= 0 ? urlObj.pathname.slice(lastDot + 1).toLowerCase() : null;
      return { mime: null, extension: ext || null };
    } catch {
      return { mime: null, extension: null };
    }
  }

  if (originalKind === 'string') {
    return { mime: null, extension: null };
  }

  if (originalKind === 'file') {
    const file = source as File;
    const mime = file.type || null;
    const lastDot = file.name ? file.name.lastIndexOf('.') : -1;
    const ext = lastDot >= 0 ? file.name.slice(lastDot + 1).toLowerCase() : null;
    return { mime, extension: ext || null };
  }

  // 'blob'
  return { mime: (source as Blob).type || null, extension: null };
}
