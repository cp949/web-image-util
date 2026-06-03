/**
 * composition canvas drawing helper의 공통 동작을 검증한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { requireCanvasContext, withCanvasState } from '../../../src/composition/canvas-drawing.internal';
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
});
