import { describe, expect, it } from 'vitest';
import { getImageAspectRatio, getImageOrientation } from '../../../../src/utils';

describe('getImageAspectRatio', () => {
  it('캔버스 이미지 비율을 반환한다', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    await expect(getImageAspectRatio(canvas)).resolves.toBeCloseTo(16 / 9, 5);
  });
});

describe('getImageOrientation', () => {
  it('이미지 방향을 landscape, portrait, square로 반환한다', async () => {
    const landscape = document.createElement('canvas');
    landscape.width = 320;
    landscape.height = 180;

    const portrait = document.createElement('canvas');
    portrait.width = 180;
    portrait.height = 320;

    const square = document.createElement('canvas');
    square.width = 200;
    square.height = 200;

    await expect(getImageOrientation(landscape)).resolves.toBe('landscape');
    await expect(getImageOrientation(portrait)).resolves.toBe('portrait');
    await expect(getImageOrientation(square)).resolves.toBe('square');
  });
});
