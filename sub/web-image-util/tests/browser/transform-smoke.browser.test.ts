/**
 * transform() 브라우저 스모크
 *
 * jsdom(node-canvas)이 대신하지 못하는 두 가지만 확인한다.
 * 1. 실제 Chromium에서 crop + 회전이 단일 drawImage 경로로 기대 픽셀을 낸다.
 * 2. SVG 소스를 crop 뒤 확대해도 벡터로 다시 래스터화되어 경계가 선명하다.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { processImage } from '../../src';
import { CanvasPool } from '../../src/base/canvas-pool.internal';

/** 좌반 빨강, 우반 파랑 */
function createHalfCanvas(width = 64, height = 32): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#0000ff';
  ctx.fillRect(width / 2, 0, width / 2, height);
  return canvas;
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is unavailable');
  return Array.from(ctx.getImageData(x, y, 1, 1).data);
}

// 100x100 SVG. 좌상단 40x40이 초록, 나머지 흰색.
const SVG_SOURCE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#ffffff"/><rect width="40" height="40" fill="#00ff00"/></svg>';

describe('transform() 브라우저 스모크', () => {
  afterEach(() => {
    CanvasPool.getInstance().clear();
  });

  it('우반 crop + 시계 방향 90° 회전은 파랑 세로 이미지를 만든다', async () => {
    const { canvas, width, height } = await processImage(createHalfCanvas())
      .transform({ crop: { x: 32, y: 0, width: 32, height: 32 }, rotate: 90 })
      .toCanvas();

    expect([width, height]).toEqual([32, 32]);
    expect(pixelAt(canvas, 16, 16)).toEqual([0, 0, 255, 255]);
  });

  it('flip + 이탈 crop이 한 번에 적용되고 이탈 영역은 투명이다', async () => {
    const { canvas } = await processImage(createHalfCanvas())
      .transform({ crop: { x: 0, y: -16, width: 64, height: 64 }, flip: { horizontal: true } })
      .toCanvas();

    // 위 16px는 투명, 가운데 띠는 flip되어 좌측이 파랑
    expect(pixelAt(canvas, 32, 4)[3]).toBe(0);
    expect(pixelAt(canvas, 8, 32)).toEqual([0, 0, 255, 255]);
    expect(pixelAt(canvas, 56, 32)).toEqual([255, 0, 0, 255]);
  });

  it('SVG를 crop 뒤 확대해도 경계 안쪽 픽셀이 순수 초록이다 (벡터 재래스터화)', async () => {
    const { canvas, width, height } = await processImage(SVG_SOURCE)
      .transform({ crop: { x: 20, y: 20, width: 40, height: 40 } })
      .resize({ fit: 'fill', width: 400, height: 400 })
      .toCanvas();

    expect([width, height]).toEqual([400, 400]);
    // crop 공간 (0..20) = 초록 → 10배 확대 시 0..200. 경계에서 충분히 떨어진 지점만 확인
    expect(pixelAt(canvas, 100, 100)).toEqual([0, 255, 0, 255]);
    expect(pixelAt(canvas, 300, 300)).toEqual([255, 255, 255, 255]);
    // 경계 바로 안쪽(비트맵 확대였다면 보간으로 섞였을 위치)
    expect(pixelAt(canvas, 196, 196)).toEqual([0, 255, 0, 255]);
  });
});
