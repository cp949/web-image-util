/**
 * box() 브라우저 스모크
 *
 * jsdom(node-canvas)이 대신하지 못하는 두 가지만 확인한다.
 * 1. 실제 Chromium의 ctx.ellipse() 기반 둥근 모서리 clip이 모서리 바깥을 투명하게 만든다.
 * 2. 반투명 border가 실제 합성 파이프라인에서 background와 올바르게 섞인다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { processImage } from '../../src';
import { CanvasPool } from '../../src/base/canvas-pool.internal';

function createSolidCanvas(width: number, height: number, color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

describe('box() 브라우저 스모크', () => {
  afterEach(() => {
    CanvasPool.getInstance().clear();
  });

  it('radius: 50%인 정사각형은 원 모서리 바깥이 투명하고 중앙은 불투명하다', async () => {
    const { canvas, width, height } = await processImage(createSolidCanvas(64, 64, '#0000ff'))
      .box({ radius: '50%' })
      .toCanvas();

    expect([width, height]).toEqual([64, 64]);
    expect(pixelAt(canvas, 2, 2)[3]).toBe(0); // 코너 — 원 바깥, 투명
    expect(pixelAt(canvas, 32, 32)).toEqual([0, 0, 255, 255]); // 중앙 — 불투명 파랑
  });

  it('반투명 border가 background와 합성돼 완전 불투명 픽셀을 만든다', async () => {
    const { canvas } = await processImage(createSolidCanvas(64, 64, '#0000ff'))
      .box({ padding: 8, background: '#ffffff', border: { width: 6, color: 'rgba(255,0,0,0.5)' } })
      .toCanvas();

    const [r, g, b, a] = pixelAt(canvas, 3, 40);
    expect(a).toBe(255); // 흰 배경과 섞여 완전 불투명
    expect(r).toBe(255);
    expect(g).toBeLessThan(200);
    expect(b).toBeLessThan(200);
  });

  it('padding + border(outside) + radius 조합이 한 번에 렌더된다', async () => {
    const { canvas, width, height } = await processImage(createSolidCanvas(50, 50, '#00ff00'))
      .box({ padding: 5, radius: 10, border: { width: 3, color: '#000000' } })
      .toCanvas();

    // outer = 50 + 5*2 + 3*2 = 66
    expect([width, height]).toEqual([66, 66]);
    expect(pixelAt(canvas, 33, 33)).toEqual([0, 255, 0, 255]); // content 중앙 — 초록 그대로
  });
});
