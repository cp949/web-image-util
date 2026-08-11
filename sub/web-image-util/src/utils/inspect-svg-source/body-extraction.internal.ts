/**
 * URL(fetch) 경로를 제외한 모든 소스 타입(string/data-url/blob/file)에서 SVG 본문 문자열을 도출한다.
 * url-string의 fetch 본문 읽기는 orchestrator가 별도 fetch 블록에서 처리하므로 이 함수 범위 밖이다.
 */

import { parseSvgFromDataUrl } from '../../core/source-converter/svg/data-url.internal';
// 타입만 import — JS 런타임 순환 차단. 런타임 값 import 추가 시 순환이 남는다.
import type { InspectSvgSourceMeta } from './types.internal';

const textEncoder = new TextEncoder();

export type ExtractSvgBodySuccess = { svgString: string; consumed: boolean };

export type ExtractSvgBodyFailure = {
  failure: 'data-url-decode-failed' | 'byte-limit-exceeded' | 'fetch-not-attempted-in-this-task';
  /** .text()를 호출했는지 여부. fail 분기에서도 consumed 표기를 정합 있게 유지하기 위함(D11). */
  consumed?: boolean;
};

/**
 * 입력으로부터 SVG 문자열을 도출한다.
 * url-string(fetch) 경로는 orchestrator가 처리하므로 본 함수 범위 밖이다.
 */
export async function extractSvgBody(
  source: string | Blob | File | URL,
  // url-string일 때 source는 URL 인스턴스 또는 url 문자열이며, fetch는 본 함수 범위 밖이다.
  originalKind: InspectSvgSourceMeta['originalKind'],
  byteLimit: number
): Promise<ExtractSvgBodySuccess | ExtractSvgBodyFailure> {
  if (originalKind === 'string') {
    // 문자열은 항상 그대로 반환하고 inspectSvg에 위임한다.
    return { svgString: source as string, consumed: false };
  }

  if (originalKind === 'data-url') {
    try {
      const svgString = parseSvgFromDataUrl(source as string);
      return { svgString, consumed: false };
    } catch {
      return { failure: 'data-url-decode-failed' };
    }
  }

  if (originalKind === 'blob' || originalKind === 'file') {
    const blob = source as Blob;
    // .size 사전 검증으로 큰 Blob의 .text() 호출(메모리 폭발)을 차단한다.
    if (blob.size > byteLimit) {
      return { failure: 'byte-limit-exceeded' };
    }
    const text = await blob.text();
    const byteCount = textEncoder.encode(text).byteLength;
    if (byteCount > byteLimit) {
      // .text()는 이미 호출됐으므로 consumed 정보를 fail 분기에도 함께 보존한다(D11).
      return { failure: 'byte-limit-exceeded', consumed: true };
    }
    return { svgString: text, consumed: true };
  }

  // url-string: fetch 본문 읽기는 orchestrator가 담당하므로 여기서는 시도하지 않는다.
  return { failure: 'fetch-not-attempted-in-this-task' };
}
