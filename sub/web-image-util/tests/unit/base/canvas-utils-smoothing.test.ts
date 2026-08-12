import { describe, expect, it } from 'vitest';
import { applySmoothing } from '../../../src/base/canvas-utils.internal';

function createCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('테스트 픽스처: 2d context 생성 실패');
  return ctx;
}

describe('applySmoothing — quality→imageSmoothing 매핑 정본', () => {
  it('fast는 스무딩을 끈다', () => {
    const ctx = createCtx();
    applySmoothing(ctx, 'fast');
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('balanced는 medium 스무딩을 켠다', () => {
    const ctx = createCtx();
    applySmoothing(ctx, 'balanced');
    expect(ctx.imageSmoothingEnabled).toBe(true);
    expect(ctx.imageSmoothingQuality).toBe('medium');
  });

  it('high는 high 스무딩을 켠다', () => {
    const ctx = createCtx();
    applySmoothing(ctx, 'high');
    expect(ctx.imageSmoothingEnabled).toBe(true);
    expect(ctx.imageSmoothingQuality).toBe('high');
  });
});
