/**
 * image-resizes.ts 단위 테스트
 *
 * canvasToBlob / canvasToDataUrl의 입출력 계약을 검증한다.
 * Canvas API 래퍼이므로 반환 타입, resolve/reject 경로를 확인하는 데 초점을 맞춘다.
 */

import { describe, expect, it, vi } from 'vitest';
import { canvasToBlob, canvasToDataUrl } from '../../../src/base/image-resizes';

// ============================================================================
// canvasToBlob
// ============================================================================

describe('canvasToBlob', () => {
  it('PNG Blob으로 resolve한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const blob = await canvasToBlob(canvas, 'image/png', 1);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('toBlob이 null을 반환하면 reject한다', async () => {
    const canvas = document.createElement('canvas');
    const toBlobSpy = vi
      .spyOn(canvas, 'toBlob')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((cb: any) => cb(null));
    await expect(canvasToBlob(canvas, 'image/png', 1)).rejects.toThrow();
    toBlobSpy.mockRestore();
  });

  it('quality 인자가 toBlob에 전달된다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const toBlobSpy = vi.spyOn(canvas, 'toBlob');
    await canvasToBlob(canvas, 'image/jpeg', 0.5);
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.5);
    toBlobSpy.mockRestore();
  });
});

// ============================================================================
// canvasToDataUrl
// ============================================================================

describe('canvasToDataUrl', () => {
  it('data: 로 시작하는 문자열을 반환한다', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const dataUrl = canvasToDataUrl(canvas, 'image/png', 1);
    expect(dataUrl).toMatch(/^data:/);
  });

  it('PNG 포맷 요청 시 PNG dataURL을 반환한다', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const dataUrl = canvasToDataUrl(canvas, 'image/png', 1);
    expect(dataUrl).toContain('image/png');
  });

  it('toDataURL에 포맷과 quality를 전달한다', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const toDataURLSpy = vi.spyOn(canvas, 'toDataURL');
    canvasToDataUrl(canvas, 'image/jpeg', 0.8);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.8);
    toDataURLSpy.mockRestore();
  });
});
