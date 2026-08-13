/**
 * 워터마크 배치 seam의 위치 계산과 Canvas 변환 수명을 검증한다.
 */

import { describe, expect, it, vi } from 'vitest';
import { ImageProcessError } from '../../../src';
import {
  computeFrameTileBounds,
  computePerTileBounds,
  iterateTileGrid,
  placeOnce,
  placeTiled,
} from '../../../src/composition/placement.internal';
import { Position } from '../../../src/composition/position-types';
import { createTestCanvas } from '../../utils/canvas-helper';

describe('placement', () => {
  it('computeFrameTileBounds: 회전 없는 프레임에 타일 크기만큼 패딩을 둔다', () => {
    expect(computeFrameTileBounds({ width: 100, height: 80 }, { width: 20, height: 10 }, 0)).toEqual({
      startX: -20,
      endX: 120,
      startY: 0,
      endY: 90,
    });
  });

  it('computePerTileBounds: 회전된 타일의 axis-aligned 크기를 패딩으로 쓴다', () => {
    const bounds = computePerTileBounds({ width: 100, height: 80 }, { width: 40, height: 20 }, 30);

    expect(bounds.startX).toBeCloseTo(-44.6410161514);
    expect(bounds.endX).toBeCloseTo(144.6410161514);
    expect(bounds.startY).toBeCloseTo(-37.3205080757);
    expect(bounds.endY).toBeCloseTo(117.3205080757);
  });

  it('iterateTileGrid: spacing으로 전진하고 홀수 행에 반 간격 stagger를 적용한다', () => {
    const points = Array.from(iterateTileGrid({ startX: -20, endX: 120, startY: 0, endY: 90 }, { x: 60, y: 50 }, true));

    expect(points).toEqual([
      { x: -20, y: 0 },
      { x: 40, y: 0 },
      { x: 100, y: 0 },
      { x: 10, y: 50 },
      { x: 70, y: 50 },
      { x: 130, y: 50 },
    ]);
  });

  it('placeOnce: 위치를 계산하고 객체 중심 회전 안에서 draw를 호출한다', () => {
    const canvas = createTestCanvas(100, 80);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');
    const draw = vi.fn();

    const origin = placeOnce(
      ctx,
      {
        containerSize: { width: 100, height: 80 },
        objectSize: { width: 20, height: 10 },
        position: Position.BOTTOM_RIGHT,
        margin: { x: 5, y: 7 },
        rotation: 90,
      },
      draw
    );

    expect(origin).toEqual({ x: 75, y: 63 });
    expect(translateSpy).toHaveBeenNthCalledWith(1, 85, 68);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, -85, -68);
    expect(draw).toHaveBeenCalledWith(origin);
    expect(translateSpy.mock.invocationCallOrder[0]).toBeLessThan(rotateSpy.mock.invocationCallOrder[0]);
    expect(rotateSpy.mock.invocationCallOrder[0]).toBeLessThan(translateSpy.mock.invocationCallOrder[1]);
    expect(translateSpy.mock.invocationCallOrder[1]).toBeLessThan(draw.mock.invocationCallOrder[0]);
  });

  it('placeTiled: spacing이 유한 양수가 아니면 그리기 전에 OPTION_INVALID를 던진다', () => {
    const canvas = createTestCanvas(100, 80);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    const draw = vi.fn();

    const place = () =>
      placeTiled(
        ctx,
        {
          containerSize: { width: 100, height: 80 },
          tileSize: { width: 20, height: 10 },
          spacing: { x: 0, y: 50 },
          rotationMode: 'frame',
          context: 'placement test',
        },
        draw
      );

    expect(place).toThrow(ImageProcessError);
    expect(place).toThrowError(expect.objectContaining({ code: 'OPTION_INVALID', details: { option: 'spacing.x' } }));
    expect(draw).not.toHaveBeenCalled();
  });

  it('placeTiled: frame 모드는 프레임을 한 번 회전하고 계산된 격자를 그린다', () => {
    const canvas = createTestCanvas(100, 80);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    const rotateSpy = vi.spyOn(ctx, 'rotate');
    const draw = vi.fn();

    placeTiled(
      ctx,
      {
        containerSize: { width: 100, height: 80 },
        tileSize: { width: 20, height: 10 },
        spacing: { x: 200, y: 200 },
        rotation: 90,
        rotationMode: 'frame',
        context: 'placement test',
      },
      draw
    );

    expect(rotateSpy).toHaveBeenCalledTimes(1);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(draw.mock.calls.map(([origin]) => origin)).toEqual([{ x: -20, y: -100 }]);
  });

  it('placeTiled: per-tile 모드는 각 타일 중심을 회전한 뒤 그린다', () => {
    const canvas = createTestCanvas(100, 80);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot get canvas context');
    }
    const translateSpy = vi.spyOn(ctx, 'translate');
    const rotateSpy = vi.spyOn(ctx, 'rotate');
    const draw = vi.fn();

    placeTiled(
      ctx,
      {
        containerSize: { width: 100, height: 80 },
        tileSize: { width: 20, height: 20 },
        spacing: { x: 200, y: 200 },
        rotation: 90,
        rotationMode: 'per-tile',
        context: 'placement test',
      },
      draw
    );

    expect(draw).toHaveBeenCalledWith({ x: -20, y: -20 });
    expect(translateSpy).toHaveBeenNthCalledWith(1, -10, -10);
    expect(rotateSpy).toHaveBeenCalledWith(Math.PI / 2);
    expect(translateSpy).toHaveBeenNthCalledWith(2, 10, 10);
  });
});
