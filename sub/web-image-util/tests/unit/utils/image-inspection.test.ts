import { describe, expect, it, vi } from 'vitest';

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

describe('이미지 검사 유틸', () => {
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

  it('크기가 없는 캔버스는 픽셀을 읽지 않고 false를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 0;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    const getImageDataSpy = vi.spyOn(ctx, 'getImageData');

    await expect(hasTransparency(canvas)).resolves.toBe(false);
    expect(getImageDataSpy).not.toHaveBeenCalled();
  });

  it('sampleStep으로 건너뛴 투명 픽셀은 검사하지 않는다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 3;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    mockAlphaData(ctx, [255, 0, 255]);

    await expect(hasTransparency(canvas, { sampleStep: 2 })).resolves.toBe(false);
  });

  it('유효하지 않은 sampleStep은 1로 보정해 투명 픽셀을 검사한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    mockAlphaData(ctx, [255, 0]);

    await expect(hasTransparency(canvas, { sampleStep: Number.NaN })).resolves.toBe(true);
  });
});
