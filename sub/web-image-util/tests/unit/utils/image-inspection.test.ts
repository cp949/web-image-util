import { describe, expect, it } from 'vitest';

import { hasTransparency } from '../../../src/utils';

// Node 테스트용 Canvas 목이 픽셀 저장을 하지 않으므로 검사할 alpha 값을 직접 주입한다.
function mockAlphaData(ctx: CanvasRenderingContext2D, alphaValues: number[]): void {
  ctx.getImageData = () =>
    ({
      data: new Uint8ClampedArray(alphaValues.flatMap((alpha) => [0, 0, 0, alpha])),
      height: 1,
      width: alphaValues.length,
    }) as ImageData;
}

describe('image inspection utilities', () => {
  it('투명 픽셀이 있으면 true를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');

    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0, 0, 255, 0)';
    ctx.fillRect(1, 0, 1, 1);
    mockAlphaData(ctx, [255, 0]);

    await expect(hasTransparency(canvas)).resolves.toBe(true);
  });

  it('모든 픽셀이 불투명하면 false를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');

    ctx.fillStyle = 'rgb(255, 0, 0)';
    ctx.fillRect(0, 0, 2, 1);
    mockAlphaData(ctx, [255, 255]);

    await expect(hasTransparency(canvas)).resolves.toBe(false);
  });
});
