export const SVG_LIMIT_BYTES = 10 * 1024 * 1024;

// base64 인코딩된 data:image/svg+xml href에서 SVG 본문을 디코딩해 반환한다.
export function extractDecodedNestedSvg(svg: string): string | null {
  const match = svg.match(/href="data:image\/svg\+xml;base64,([^"]+)"/);
  if (!match) return null;
  return new TextDecoder().decode(Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0)));
}

/**
 * 스트리밍 응답 본문을 흉내 내는 최소 Reader 구현을 만든다.
 *
 * @param chunks 순서대로 반환할 텍스트 또는 바이트 청크
 * @param options 읽기 중 예외를 강제로 발생시킬 옵션
 * @returns Response.body 대역 객체
 */
export function createStreamBody(chunks: Array<string | Uint8Array>, options?: { throwOnRead?: Error }) {
  const encoder = new TextEncoder();
  const normalizedChunks = chunks.map((chunk) => (typeof chunk === 'string' ? encoder.encode(chunk) : chunk));

  return {
    getReader() {
      let index = 0;

      return {
        async read() {
          if (options?.throwOnRead) {
            throw options.throwOnRead;
          }

          if (index >= normalizedChunks.length) {
            return { done: true, value: undefined };
          }

          const value = normalizedChunks[index];
          index += 1;
          return { done: false, value };
        },
        async cancel() {},
        releaseLock() {},
      };
    },
  };
}
