/**
 * processImage(source, { maxInputPixels, maxOutputPixels })의 엔드투엔드 통합 테스트.
 *
 * Task 1~8이 만든 배선 전체(convertToImageElement → OutputPipeline →
 * LazyRenderPipeline → renderLayout)를 공개 API 레벨에서 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { processImage } from '../../../src/processor';

function createDrawableCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

describe('processImage — pixel budget 엔드투엔드', () => {
  it('두 옵션 모두 생략하면 기존 동작과 동일하게 성공한다(회귀 없음)', async () => {
    const result = await processImage(createDrawableCanvas(500, 500))
      .resize({ fit: 'cover', width: 300, height: 300 })
      .toBlob('png');
    expect(result.width).toBe(300);
    expect(result.height).toBe(300);
  });

  it('maxInputPixels 초과 입력은 resize() 전에도 toBlob()에서 PIXEL_BUDGET_EXCEEDED로 거부된다', async () => {
    const processor = processImage(createDrawableCanvas(200, 200), { maxInputPixels: 10_000 }).resize({
      fit: 'cover',
      width: 50,
      height: 50,
    });
    await expect(processor.toBlob('png')).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
      details: { direction: 'input', stage: 'decoded' },
    });
  });

  it('maxInputPixels 이하 입력은 정상 처리된다', async () => {
    const result = await processImage(createDrawableCanvas(50, 50), { maxInputPixels: 10_000 })
      .resize({ fit: 'cover', width: 30, height: 30 })
      .toBlob('png');
    expect(result.width).toBe(30);
  });

  it('maxOutputPixels 초과 출력은 PIXEL_BUDGET_EXCEEDED로 거부된다', async () => {
    const processor = processImage(createDrawableCanvas(500, 500), { maxOutputPixels: 10_000 }).resize({
      fit: 'cover',
      width: 200,
      height: 200,
    });
    await expect(processor.toBlob('png')).rejects.toMatchObject({
      code: 'PIXEL_BUDGET_EXCEEDED',
      details: { direction: 'output', actualPixels: 40_000, maxPixels: 10_000 },
    });
  });

  it('maxOutputPixels 이하 출력은 정상 처리된다', async () => {
    const result = await processImage(createDrawableCanvas(500, 500), { maxOutputPixels: 10_000 })
      .resize({ fit: 'cover', width: 80, height: 80 })
      .toBlob('png');
    expect(result.width).toBe(80);
  });

  it('maxInputPixels가 음수면 OPTION_INVALID로 즉시 거부된다', async () => {
    await expect(
      processImage(createDrawableCanvas(10, 10), { maxInputPixels: -1 })
        .resize({ fit: 'cover', width: 5, height: 5 })
        .toBlob('png')
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });

  it('maxOutputPixels가 음수면 OPTION_INVALID로 즉시 거부된다', async () => {
    await expect(
      processImage(createDrawableCanvas(10, 10), { maxOutputPixels: -1 })
        .resize({ fit: 'cover', width: 5, height: 5 })
        .toBlob('png')
    ).rejects.toMatchObject({ code: 'OPTION_INVALID' });
  });
});
