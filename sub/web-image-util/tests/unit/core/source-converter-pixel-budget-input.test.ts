/**
 * convertToImageElement의 maxInputPixels(사후 + 헤더 사전) 검사 테스트.
 */

import { describe, expect, it } from 'vitest';
import { convertToImageElement } from '../../../src/core/source-converter/index';

function createDrawableCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function pngArrayBuffer(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes.buffer;
}

describe('convertToImageElement — maxInputPixels', () => {
  it('옵션 미지정 시 초대형 소스도 거부하지 않는다(기존 동작 보존)', async () => {
    const canvas = createDrawableCanvas(2000, 2000);
    const element = await convertToImageElement(canvas);
    expect(element.width).toBe(2000);
  });

  it('canvas 소스가 사후 체크(naturalWidth*naturalHeight)로 거부된다', async () => {
    const canvas = createDrawableCanvas(200, 200);
    await expect(convertToImageElement(canvas, { maxInputPixels: 10_000 })).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
      details: { direction: 'input', stage: 'decoded', actualPixels: 40_000, maxPixels: 10_000 },
    });
  });

  it('canvas 소스가 한도 이하면 통과한다', async () => {
    const canvas = createDrawableCanvas(50, 50);
    const element = await convertToImageElement(canvas, { maxInputPixels: 10_000 });
    expect(element.width).toBe(50);
  });

  it('ArrayBuffer(PNG) 소스는 디코드 전 헤더로 먼저 거부된다(stage: header)', async () => {
    await expect(convertToImageElement(pngArrayBuffer(1000, 1000), { maxInputPixels: 10_000 })).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
      details: { direction: 'input', stage: 'header', actualPixels: 1_000_000, maxPixels: 10_000 },
    });
  });

  it('maxInputPixels가 0이면 OPTION_INVALID다', async () => {
    const canvas = createDrawableCanvas(10, 10);
    await expect(convertToImageElement(canvas, { maxInputPixels: 0 })).rejects.toMatchObject({
      code: 'OPTION_INVALID',
    });
  });
});
