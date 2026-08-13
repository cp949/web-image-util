/**
 * composition canvas drawing helper의 공통 동작을 검증한다.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyRotation,
  drawImageLayer,
  drawShadowedImage,
  requireCanvasContext,
  withCanvasState,
} from '../../../src/composition/canvas-drawing.internal';
import { ImageProcessError } from '../../../src/errors.internal';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('canvas-drawing', () => {
  it('2D context를 만들 수 없으면 ImageProcessError를 던진다', () => {
    const canvas = createTestCanvas(10, 10);
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);

    expect(() => requireCanvasContext(canvas, '테스트 렌더링')).toThrow(ImageProcessError);
    expect(() => requireCanvasContext(canvas, '테스트 렌더링')).toThrow('Failed to get Canvas 2D context');
    expect(() => requireCanvasContext(canvas, '테스트 렌더링')).toThrow(
      expect.objectContaining({
        details: { operation: '테스트 렌더링' },
      })
    );
  });

  it('callback이 실패해도 save 이후 restore를 호출한다', () => {
    const canvas = createTestCanvas(10, 10);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const saveSpy = vi.spyOn(ctx, 'save');
    const restoreSpy = vi.spyOn(ctx, 'restore');

    expect(() =>
      withCanvasState(ctx, () => {
        throw new Error('draw failed');
      })
    ).toThrow('draw failed');

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
  });

  it('applyRotation: 배치 영역 중심을 기준으로 translate·rotate·translate를 건다', () => {
    const canvas = createTestCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');

    applyRotation(ctx, { x: 10, y: 20, width: 40, height: 20, rotation: 90 });

    // 중심 = (10 + 40/2, 20 + 20/2) = (30, 30)
    expect(translateSpy).toHaveBeenNthCalledWith(1, 30, 30);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, -30, -30);
  });

  it('applyRotation: rotation이 0이거나 없으면 변환을 걸지 않는다', () => {
    const canvas = createTestCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');

    applyRotation(ctx, { x: 10, y: 20, width: 40, height: 20, rotation: 0 });
    applyRotation(ctx, { x: 10, y: 20, width: 40, height: 20 });

    expect(translateSpy).not.toHaveBeenCalled();
    expect(rotateSpy).not.toHaveBeenCalled();
  });

  it('레이어 이미지의 투명도·블렌드·회전을 적용한 뒤 Canvas 상태를 복구한다', () => {
    const canvas = createTestCanvas(100, 100);
    const image = createTestCanvas(20, 10) as unknown as HTMLImageElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }

    const saveSpy = vi.spyOn(ctx, 'save');
    const restoreSpy = vi.spyOn(ctx, 'restore');
    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    drawImageLayer(ctx, {
      image,
      x: 10,
      y: 15,
      width: 20,
      height: 10,
      opacity: 0.5,
      blendMode: 'multiply',
      rotation: 90,
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(translateSpy).toHaveBeenNthCalledWith(1, 20, 20);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(drawImageSpy).toHaveBeenCalledWith(image, 10, 15, 20, 10);
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.globalCompositeOperation).toBe('source-over');
  });

  it('그림자 이미지도 실패 여부와 무관하게 Canvas 상태 범위 안에서 그린다', () => {
    const canvas = createTestCanvas(100, 100);
    const image = createTestCanvas(20, 10) as unknown as HTMLImageElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    const initialShadowColor = ctx.shadowColor;

    const saveSpy = vi.spyOn(ctx, 'save');
    const restoreSpy = vi.spyOn(ctx, 'restore');
    const drawImageSpy = vi.spyOn(ctx, 'drawImage');

    drawShadowedImage(ctx, image, {
      x: 5,
      y: 7,
      width: 20,
      height: 10,
      rotation: 0,
    });

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(restoreSpy).toHaveBeenCalledTimes(1);
    expect(drawImageSpy).toHaveBeenCalledWith(image, 5, 7, 20, 10);
    expect(ctx.shadowBlur).toBe(0);
    expect(ctx.shadowColor).toBe(initialShadowColor);
  });
});
