/**
 * 필터 블렌딩 helper의 픽셀 합성 규칙을 검증한다.
 */

import { describe, expect, it } from 'vitest';
import { applyBlendMode, applyOpacity } from '../../../src/filters/filter-blending.internal';
import { BlendMode } from '../../../src/filters/plugin-system';
import { createSinglePixelImageData } from './plugin-system-helpers';

describe('filter-blending helper', () => {
  it('MULTIPLY는 원본과 필터 RGB 값을 곱한다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(200, 100, 50);
    const result = applyBlendMode(original, filtered, BlendMode.MULTIPLY);

    expect(Array.from(result.data)).toEqual([
      Math.round((200 / 255) * (200 / 255) * 255),
      Math.round((100 / 255) * (100 / 255) * 255),
      Math.round((50 / 255) * (50 / 255) * 255),
      255,
    ]);
  });

  it('DARKEN은 원본과 필터 중 더 어두운 값을 취한다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.DARKEN);

    expect(Array.from(result.data)).toEqual([
      Math.round(Math.min(200 / 255, 100 / 255) * 255),
      Math.round(Math.min(100 / 255, 180 / 255) * 255),
      Math.round(Math.min(50 / 255, 210 / 255) * 255),
      255,
    ]);
  });

  it('LIGHTEN은 원본과 필터 중 더 밝은 값을 취한다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.LIGHTEN);

    expect(Array.from(result.data)).toEqual([
      Math.round(Math.max(200 / 255, 100 / 255) * 255),
      Math.round(Math.max(100 / 255, 180 / 255) * 255),
      Math.round(Math.max(50 / 255, 210 / 255) * 255),
      255,
    ]);
  });

  it('HARD_LIGHT는 필터 값 기준으로 곱하기/스크린 공식을 분기한다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.HARD_LIGHT);

    const hardLight = (cb: number, cs: number) => (cs < 0.5 ? 2 * cb * cs : 1 - 2 * (1 - cb) * (1 - cs));
    expect(Array.from(result.data)).toEqual([
      Math.round(hardLight(200 / 255, 100 / 255) * 255),
      Math.round(hardLight(100 / 255, 180 / 255) * 255),
      Math.round(hardLight(50 / 255, 210 / 255) * 255),
      255,
    ]);
  });

  it('SOFT_LIGHT는 필터 값 0.5 기준으로 다른 보간 공식을 쓴다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.SOFT_LIGHT);

    const d = (x: number) => (x <= 0.25 ? ((16 * x - 12) * x + 4) * x : Math.sqrt(x));
    const softLight = (cb: number, cs: number) =>
      cs <= 0.5 ? cb - (1 - 2 * cs) * cb * (1 - cb) : cb + (2 * cs - 1) * (d(cb) - cb);
    expect(Array.from(result.data)).toEqual([
      Math.round(softLight(200 / 255, 100 / 255) * 255),
      Math.round(softLight(100 / 255, 180 / 255) * 255),
      Math.round(softLight(50 / 255, 210 / 255) * 255),
      255,
    ]);
  });

  it('DIFFERENCE는 원본과 필터의 절대 차다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.DIFFERENCE);

    expect(Array.from(result.data)).toEqual([
      Math.round(Math.abs(200 / 255 - 100 / 255) * 255),
      Math.round(Math.abs(100 / 255 - 180 / 255) * 255),
      Math.round(Math.abs(50 / 255 - 210 / 255) * 255),
      255,
    ]);
  });

  it('EXCLUSION은 대비가 낮은 차이값을 만든다', () => {
    const original = createSinglePixelImageData(200, 100, 50);
    const filtered = createSinglePixelImageData(100, 180, 210);
    const result = applyBlendMode(original, filtered, BlendMode.EXCLUSION);

    expect(Array.from(result.data)).toEqual([
      Math.round((200 / 255 + 100 / 255 - 2 * (200 / 255) * (100 / 255)) * 255),
      Math.round((100 / 255 + 180 / 255 - 2 * (100 / 255) * (180 / 255)) * 255),
      Math.round((50 / 255 + 210 / 255 - 2 * (50 / 255) * (210 / 255)) * 255),
      255,
    ]);
  });

  it('COLOR_DODGE는 원본을 (1-필터)로 나눠 밝게 만든다', () => {
    const original = createSinglePixelImageData(120, 90, 60);
    const filtered = createSinglePixelImageData(80, 150, 100);
    const result = applyBlendMode(original, filtered, BlendMode.COLOR_DODGE);

    const colorDodge = (cb: number, cs: number) => (cb === 0 ? 0 : cs === 1 ? 1 : Math.min(1, cb / (1 - cs)));
    expect(Array.from(result.data)).toEqual([
      Math.round(colorDodge(120 / 255, 80 / 255) * 255),
      Math.round(colorDodge(90 / 255, 150 / 255) * 255),
      Math.round(colorDodge(60 / 255, 100 / 255) * 255),
      255,
    ]);
  });

  it('COLOR_DODGE는 원본이 0이면 0을, 필터가 1이면 1을 고정 반환한다', () => {
    const original = createSinglePixelImageData(0, 100, 50);
    const filtered = createSinglePixelImageData(200, 255, 80);
    const result = applyBlendMode(original, filtered, BlendMode.COLOR_DODGE);

    expect(Array.from(result.data)).toEqual([0, 255, 73, 255]);
  });

  it('COLOR_BURN은 (1-원본)을 필터로 나눠 어둡게 만든다', () => {
    const original = createSinglePixelImageData(180, 90, 60);
    const filtered = createSinglePixelImageData(220, 200, 245);
    const result = applyBlendMode(original, filtered, BlendMode.COLOR_BURN);

    const colorBurn = (cb: number, cs: number) => (cb === 1 ? 1 : cs === 0 ? 0 : 1 - Math.min(1, (1 - cb) / cs));
    expect(Array.from(result.data)).toEqual([
      Math.round(colorBurn(180 / 255, 220 / 255) * 255),
      Math.round(colorBurn(90 / 255, 200 / 255) * 255),
      Math.round(colorBurn(60 / 255, 245 / 255) * 255),
      255,
    ]);
  });

  it('COLOR_BURN은 원본이 1이면 1을, 필터가 0이면 0을 고정 반환한다', () => {
    const original = createSinglePixelImageData(255, 90, 180);
    const filtered = createSinglePixelImageData(50, 0, 220);
    const result = applyBlendMode(original, filtered, BlendMode.COLOR_BURN);

    expect(Array.from(result.data)).toEqual([255, 0, 168, 255]);
  });

  it('NORMAL은 필터 결과를 그대로 통과시킨다', () => {
    const original = createSinglePixelImageData(10, 20, 30);
    const filtered = createSinglePixelImageData(40, 50, 60);
    const result = applyBlendMode(original, filtered, BlendMode.NORMAL);

    expect(Array.from(result.data)).toEqual([40, 50, 60, 255]);
  });

  it('BlendMode에 없는 값을 넘기면 예외를 던진다', () => {
    const original = createSinglePixelImageData(10, 20, 30);
    const filtered = createSinglePixelImageData(40, 50, 60);

    expect(() => applyBlendMode(original, filtered, 'not-a-real-mode' as BlendMode)).toThrow(
      "Blend mode 'not-a-real-mode' is not supported."
    );
  });

  it('opacity는 원본과 필터 RGB 값을 선형 보간한다', () => {
    const original = createSinglePixelImageData(0, 20, 40);
    const filtered = createSinglePixelImageData(100, 120, 140);
    const result = applyOpacity(original, filtered, 0.5);

    expect(Array.from(result.data)).toEqual([50, 70, 90, 255]);
  });
});
