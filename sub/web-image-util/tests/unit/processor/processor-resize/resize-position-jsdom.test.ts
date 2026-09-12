/**
 * processImage().resize({ position }) 체인 end-to-end 검증 (jsdom-safe)
 *
 * 픽셀로 실제 크롭/배치 방향을 확인하고, 잘못된 position은 공개 체인에서도
 * OPTION_INVALID로 거부되는지 본다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { ImageProcessError, type ResizeConfig } from '../../../../src/types';

/** 왼쪽 절반은 빨강, 오른쪽 절반은 파랑인 캔버스 — 가로 방향 gravity/focal-point 확인용 */
function createHorizontalSplitCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(width / 2, 0, width / 2, height);
  return canvas;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): [number, number, number, number] {
  const data = canvas.getContext('2d')!.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
}

describe('resize position 체인 — 픽셀', () => {
  it('cover + gravity top-left는 원본 왼쪽(빨강)을 보여준다', async () => {
    // 200x100(좌:빨강 100px, 우:파랑 100px)을 100x100 cover, top-left
    const { canvas } = await processImage(createHorizontalSplitCanvas(200, 100))
      .resize({ fit: 'cover', width: 100, height: 100, position: 'top-left' })
      .toCanvas();

    expect(pixelAt(canvas, 10, 50)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas, 90, 50)).toEqual([255, 0, 0, 255]);
  });

  it('cover + gravity top-right는 원본 오른쪽(파랑)을 보여준다', async () => {
    const { canvas } = await processImage(createHorizontalSplitCanvas(200, 100))
      .resize({ fit: 'cover', width: 100, height: 100, position: 'top-right' })
      .toCanvas();

    expect(pixelAt(canvas, 10, 50)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas, 90, 50)).toEqual([0, 0, 255, 255]);
  });

  it('cover + focal-point x=0.9는 원본 오른쪽(파랑) 쪽으로 크롭한다', async () => {
    const { canvas } = await processImage(createHorizontalSplitCanvas(200, 100))
      .resize({ fit: 'cover', width: 100, height: 100, position: { x: 0.9, y: 0.5 } })
      .toCanvas();

    expect(pixelAt(canvas, 90, 50)).toEqual([0, 0, 255, 255]);
  });
});

describe('resize position 체인 — 오류', () => {
  // resize()의 position 검증은 validateResizeConfig가 addResize 호출 시점에 동기적으로 던진다
  // (box-chain-jsdom.test.ts의 "addResize가 동기적으로 던진다" 케이스와 동일한 구조).
  // toBlob() 등 출력 메서드까지 가지 않으므로 rejected promise가 아니라 동기 throw로 검증한다.
  it('잘못된 gravity 문자열은 OPTION_INVALID다', () => {
    const processor = processImage(createHorizontalSplitCanvas(100, 100));

    expect(() => processor.resize({ fit: 'cover', width: 50, height: 50, position: 'middle' as never })).toThrow(
      ImageProcessError
    );
    try {
      processor.resize({ fit: 'cover', width: 50, height: 50, position: 'middle' as never });
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });

  it('contain + focal-point 객체(타입 우회)는 OPTION_INVALID다', () => {
    const badConfig = {
      fit: 'contain',
      width: 50,
      height: 50,
      position: { x: 0.5, y: 0.5 },
    } as unknown as ResizeConfig;
    const processor = processImage(createHorizontalSplitCanvas(100, 100));

    expect(() => processor.resize(badConfig)).toThrow(ImageProcessError);
    try {
      processor.resize(badConfig);
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });
});
