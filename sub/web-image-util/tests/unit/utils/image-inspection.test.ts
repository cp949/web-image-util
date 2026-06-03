import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImageProcessError } from '../../../src/errors';
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

/** decode 없이 "로드 완료" 상태로 보이는 HTMLImageElement를 만든다. */
function createLoadedImage(width: number, height: number): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'complete', { value: true });
  Object.defineProperty(img, 'naturalWidth', { value: width });
  Object.defineProperty(img, 'naturalHeight', { value: height });
  return img;
}

describe('이미지 검사 유틸', () => {
  // 프로토타입/인스턴스 spy는 다음 테스트로 누수되지 않도록 매번 복구한다.
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('height가 0인 캔버스도 픽셀을 읽지 않고 false를 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 0;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    const getImageDataSpy = vi.spyOn(ctx, 'getImageData');

    await expect(hasTransparency(canvas)).resolves.toBe(false);
    expect(getImageDataSpy).not.toHaveBeenCalled();
  });

  it('sampleStep이 0이면 1로 보정해 투명 픽셀을 검사한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    // x=0은 불투명, x=1은 투명 — sampleStep 1로 보정되면 x=1도 검사해 true
    mockAlphaData(ctx, [255, 0]);

    await expect(hasTransparency(canvas, { sampleStep: 0 })).resolves.toBe(true);
  });

  it('sampleStep이 음수이면 1로 보정해 투명 픽셀을 검사한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is required');
    // sampleStep -5는 max(1, -5) = 1로 보정되어 모든 픽셀을 검사한다
    mockAlphaData(ctx, [255, 0]);

    await expect(hasTransparency(canvas, { sampleStep: -5 })).resolves.toBe(true);
  });

  it('캔버스가 아닌 이미지 소스는 내부 캔버스로 변환해 투명도를 검사한다', async () => {
    // 로드 완료 상태의 img는 convertToImageElement가 그대로 반환하므로 decode가 없다.
    const img = createLoadedImage(1, 1);
    // 내부에서 생성하는 캔버스 컨텍스트의 draw/getImageData를 프로토타입에서 가로챈다.
    const proto = Object.getPrototypeOf(document.createElement('canvas').getContext('2d') as object);
    vi.spyOn(proto, 'drawImage').mockReturnValue(undefined);
    vi.spyOn(proto, 'getImageData').mockReturnValue({
      data: new Uint8ClampedArray([0, 0, 0, 128]),
      width: 1,
      height: 1,
    } as ImageData);

    await expect(hasTransparency(img)).resolves.toBe(true);
  });

  it('Canvas 2D 컨텍스트를 얻지 못하면 CANVAS_CREATION_FAILED로 던진다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    await expect(hasTransparency(canvas)).rejects.toMatchObject({
      code: 'CANVAS_CREATION_FAILED',
    });
    await expect(hasTransparency(canvas)).rejects.toBeInstanceOf(ImageProcessError);
  });
});
