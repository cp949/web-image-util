import { normalizePolicyUrl } from '../../core/source-converter/url/policy.internal';
import type { InspectSvgSourceFinding, InspectSvgSourceInput, InspectSvgSourceMeta } from '../inspect-svg-source';

/**
 * source.url에 노출할 마스킹된 URL 표현을 반환한다(D10).
 * - url-string(http/https): origin + pathname만 노출. query/fragment 제거.
 * - url-string(blob:): protocol+pathname 반환(query/fragment 제거).
 * - url-string(그 외): protocol://[masked].
 * - data-url: data:<mime>[;base64],[masked] 형태. payload 본문 미포함.
 * - 그 외(string/blob/file): null.
 */
export function maskSourceUrl(
  input: InspectSvgSourceInput,
  originalKind: InspectSvgSourceMeta['originalKind']
): string | null {
  if (originalKind === 'data-url' && typeof input === 'string') {
    const match = input.match(/^data:([^,;]+)/);
    const mime = match ? match[1] : '';
    return `data:${mime}[;base64],[masked]`;
  }

  if (originalKind === 'url-string') {
    const urlStr = typeof input === 'string' ? input : (input as URL).toString();
    try {
      const url = new URL(normalizePolicyUrl(urlStr));
      // blob: URL은 origin+pathname 결합 시 이중 도메인이 생성되므로 protocol+pathname 사용.
      // pathname은 opaque path 전체('https://host/uuid')이며 query/fragment를 포함하지 않는다.
      if (url.protocol === 'blob:') {
        return `${url.protocol}${url.pathname}`;
      }
      // http/https만 origin+pathname 노출 허용. 그 외(data:, file:, ftp: 등)는 마스킹
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return `${url.origin}${url.pathname}`;
      }
      return `${url.protocol}//[masked]`;
    } catch {
      return null;
    }
  }

  return null;
}

/** finding 배열에서 code 기준으로 중복을 제거한다(먼저 등장한 항목 유지). */
export function deduplicateFindings(findings: InspectSvgSourceFinding[]): InspectSvgSourceFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    if (seen.has(f.code)) return false;
    seen.add(f.code);
    return true;
  });
}
