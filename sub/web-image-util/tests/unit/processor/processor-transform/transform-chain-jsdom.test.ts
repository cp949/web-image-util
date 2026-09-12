/**
 * processImage().transform() 체인 end-to-end 검증 (Canvas 입력, jsdom-safe)
 *
 * 출력 크기, 픽셀 위치(node-canvas getImageData), 오류 코드, 호출 순서 가드를 본다.
 * Blob 입력은 jsdom의 Blob URL 로딩 제약 때문에 브라우저 스모크가 담당한다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../../src/processor';
import { ImageProcessError } from '../../../../src/types';
import type { TransformOptions } from '../../../../src/types/transform-config';
import { createTestCanvas } from '../../../utils/canvas-helper';

/** 좌반 빨강(255,0,0), 우반 파랑(0,0,255)인 캔버스 */
function createHalfCanvas(width: number, height: number): HTMLCanvasElement {
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

async function expectRejectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
    expect.fail('ImageProcessError가 발생해야 한다');
  } catch (error) {
    expect(error).toBeInstanceOf(ImageProcessError);
    if (error instanceof ImageProcessError) {
      expect(error.code).toBe(code);
    }
  }
}

describe('transform 체인 — 출력 크기', () => {
  it('crop만 하면 출력이 crop 크기다 (resize 없음)', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({ crop: { x: 50, y: 50, width: 200, height: 100 } })
      .toBlob();

    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
  });

  it('90° 회전만 하면 폭·높이가 바뀐다', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({ rotate: 90 })
      .toBlob();

    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
  });

  it('45° expand는 AABB 크기, clip은 원본 크기다', async () => {
    const expanded = await processImage(createTestCanvas(200, 200, 'blue'))
      .transform({ rotate: 45 })
      .toBlob();
    const clipped = await processImage(createTestCanvas(200, 200, 'blue'))
      .transform({ rotate: { degrees: 45, expand: false } })
      .toBlob();

    expect([expanded.width, expanded.height]).toEqual([283, 283]);
    expect([clipped.width, clipped.height]).toEqual([200, 200]);
  });

  it('flip만 하면 크기가 그대로다', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({ flip: { horizontal: true } })
      .toBlob();

    expect([result.width, result.height]).toEqual([400, 300]);
  });

  it('빈 transform은 no-op이다', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({})
      .toBlob();

    expect([result.width, result.height]).toEqual([400, 300]);
  });

  it('transform 뒤 resize는 프레임을 원본으로 보고 목표 크기를 낸다', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({ crop: { x: 0, y: 0, width: 100, height: 100 }, rotate: 90 })
      .resize({ fit: 'cover', width: 50, height: 80 })
      .toBlob();

    expect([result.width, result.height]).toEqual([50, 80]);
  });

  it('metadata.operations에 transform이 포함된다', async () => {
    const result = await processImage(createTestCanvas(400, 300, 'blue'))
      .transform({ rotate: 90 })
      .blur(1)
      .toBlob();

    expect(result.operations).toBe(2);
  });
});

describe('transform 체인 — 픽셀', () => {
  it('우반 crop은 파랑만 남긴다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50))
      .transform({ crop: { x: 50, y: 0, width: 50, height: 50 } })
      .toCanvas();

    expect(pixelAt(canvas, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas, 49, 49)).toEqual([0, 0, 255, 255]);
  });

  it('좌우 flip은 빨강·파랑 위치를 바꾼다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50))
      .transform({ flip: { horizontal: true } })
      .toCanvas();

    expect(pixelAt(canvas, 10, 25)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas, 90, 25)).toEqual([255, 0, 0, 255]);
  });

  it('시계 방향 90° 회전은 좌반(빨강)을 상단으로 보낸다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50)).transform({ rotate: 90 }).toCanvas();

    expect([canvas.width, canvas.height]).toEqual([50, 100]);
    expect(pixelAt(canvas, 25, 10)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(canvas, 25, 90)).toEqual([0, 0, 255, 255]);
  });

  it('flip과 rotate를 함께 쓰면 반전 후 회전 순서로 적용된다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50))
      .transform({ rotate: 90, flip: { horizontal: true } })
      .toCanvas();

    // createHalfCanvas: 좌반(0~49) 빨강, 우반(50~99) 파랑, 100x50
    // flip(horizontal)이 먼저 적용되어 좌반 파랑·우반 빨강이 된 상태에서 시계 방향 90도 회전한다.
    // flip 없이 rotate 90만 하면 좌측(빨강)이 상단으로 가지만(위 "시계 방향 90° 회전은
    // 좌반(빨강)을 상단으로 보낸다" 테스트), flip이 먼저 적용되면 반대로 파랑이 상단, 빨강이
    // 하단으로 간다 — flip → rotate 순서(decisions.md 연산 순서 고정 계약)의 실측 결과다.
    expect([canvas.width, canvas.height]).toEqual([50, 100]);
    expect(pixelAt(canvas, 25, 10)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas, 25, 90)).toEqual([255, 0, 0, 255]);
  });

  it('원본 밖 crop 영역은 투명이다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50))
      .transform({ crop: { x: -50, y: 0, width: 100, height: 50 } })
      .toCanvas();

    expect(pixelAt(canvas, 10, 25)[3]).toBe(0);
    expect(pixelAt(canvas, 75, 25)).toEqual([255, 0, 0, 255]);
  });

  it('box background는 letterbox와 crop 이탈 영역을 같은 색으로 채운다', async () => {
    const { canvas } = await processImage(createHalfCanvas(100, 50))
      .transform({ crop: { x: -50, y: 0, width: 100, height: 50 } })
      .resize({ fit: 'contain', width: 100, height: 100 })
      .box({ background: '#ffff00' })
      .toCanvas();

    // 프레임(100x50)은 y 25~74에 놓인다. letterbox와 이탈 영역 모두 노랑
    expect(pixelAt(canvas, 50, 5)).toEqual([255, 255, 0, 255]);
    expect(pixelAt(canvas, 10, 50)).toEqual([255, 255, 0, 255]);
    expect(pixelAt(canvas, 75, 50)).toEqual([255, 0, 0, 255]);
  });
});

describe('transform 체인 — 오류와 순서', () => {
  it('두 번째 transform()은 OPTION_INVALID다', () => {
    const processor = processImage(createTestCanvas(100, 100, 'blue'));
    processor.transform({ rotate: 90 });

    expect(() => processor.transform({ rotate: 180 })).toThrow(ImageProcessError);
    try {
      processor.transform({ rotate: 180 });
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });

  it('resize() 뒤 transform()은 런타임에서도 OPTION_INVALID다', () => {
    const resized = processImage(createTestCanvas(100, 100, 'blue')).resize({ fit: 'cover', width: 50, height: 50 });
    const options: TransformOptions = { rotate: 90 };

    try {
      resized.transform(options);
      expect.fail('ImageProcessError가 발생해야 한다');
    } catch (error) {
      expect((error as ImageProcessError).code).toBe('OPTION_INVALID');
    }
  });

  it('원본과 교집합 없는 crop은 출력 시점에 INVALID_DIMENSIONS로 거부한다', async () => {
    await expectRejectCode(
      processImage(createTestCanvas(100, 100, 'blue'))
        .transform({ crop: { x: 500, y: 500, width: 10, height: 10 } })
        .toBlob(),
      'INVALID_DIMENSIONS'
    );
  });

  it('잘못된 옵션은 호출 즉시 던지고 이후 호출은 정상이다', async () => {
    const processor = processImage(createTestCanvas(100, 100, 'blue'));

    expect(() => processor.transform({ rotate: Number.NaN })).toThrow(ImageProcessError);

    const result = await processor.transform({ rotate: 90 }).toBlob();
    expect([result.width, result.height]).toEqual([100, 100]);
  });

  it('별도 인스턴스는 독립적으로 transform할 수 있다', async () => {
    const source = createTestCanvas(400, 300, 'blue');
    const a = await processImage(source).transform({ rotate: 90 }).toBlob();
    const b = await processImage(source)
      .transform({ crop: { x: 0, y: 0, width: 10, height: 10 } })
      .toBlob();

    expect([a.width, a.height]).toEqual([300, 400]);
    expect([b.width, b.height]).toEqual([10, 10]);
  });
});
