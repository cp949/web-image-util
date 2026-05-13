/**
 * unsafe_processImage 에러 처리 중 happy-dom에서만 안전한 케이스를 남긴다.
 * jsdom에서 통과하는 나머지 5개 케이스는 `error-handling-jsdom.test.ts`에 있다.
 */

import { describe, expect, it } from 'vitest';

function createOversizedSvg(): string {
  const oversizedPadding = '가'.repeat(5_300_000);
  return `<svg xmlns="http://www.w3.org/2000/svg"><text>${oversizedPadding}</text></svg>`;
}

function createSvgUint8Array(svg: string): Uint8Array {
  return new TextEncoder().encode(svg);
}

describe('unsafe_processImage — 에러 처리 (Uint8Array 입력 디코딩 경로)', () => {
  it('Uint8Array SVG 입력은 safe 경로에서 크기 제한을 유지하고 unsafe도 동일하게 차단한다', async () => {
    const { processImage, unsafe_processImage } = await import('../../../../src');
    const uint8 = createSvgUint8Array(createOversizedSvg());

    await expect((processImage(uint8) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'SVG_BYTES_EXCEEDED',
      }),
    });

    await expect((unsafe_processImage(uint8) as any).toElement()).rejects.toMatchObject({
      code: 'OUTPUT_FAILED',
      cause: expect.objectContaining({
        code: 'SVG_BYTES_EXCEEDED',
      }),
    });
  });
});
