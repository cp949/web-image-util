/**
 * transform-calculator 단위 테스트
 *
 * 원본 크기와 정규화된 transform으로 source/dest rect, 프레임 크기, clip 필요 여부를 계산하는
 * 순수 함수를 검증한다. Canvas는 사용하지 않는다.
 */

import { describe, expect, it } from 'vitest';
import { computeTransformGeometry, isTransformIdentity } from '../../../src/core/transform-calculator.internal';
import { ImageProcessError } from '../../../src/errors.internal';
import type { NormalizedTransform } from '../../../src/types/transform-config';

function makeTransform(overrides: Partial<NormalizedTransform> = {}): NormalizedTransform {
  return {
    crop: null,
    flipX: false,
    flipY: false,
    degrees: 0,
    expand: true,
    ...overrides,
  };
}

describe('computeTransformGeometry — crop', () => {
  it('crop이 없으면 원본 전체가 source이고 dest는 원점이다', () => {
    const geometry = computeTransformGeometry(800, 600, makeTransform());

    expect(geometry.cropSize).toEqual({ width: 800, height: 600 });
    expect(geometry.frameSize).toEqual({ width: 800, height: 600 });
    expect(geometry.sourceRect).toEqual({ x: 0, y: 0, width: 800, height: 600 });
    expect(geometry.destRect).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('원본 내부 crop은 source = crop, dest = 원점이다', () => {
    const geometry = computeTransformGeometry(
      800,
      600,
      makeTransform({ crop: { x: 100, y: 50, width: 400, height: 300 } })
    );

    expect(geometry.cropSize).toEqual({ width: 400, height: 300 });
    expect(geometry.sourceRect).toEqual({ x: 100, y: 50, width: 400, height: 300 });
    expect(geometry.destRect).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('좌상단으로 이탈한 crop은 교집합만 source로 잡고 dest를 이탈량만큼 민다', () => {
    const geometry = computeTransformGeometry(
      100,
      100,
      makeTransform({ crop: { x: -50, y: -50, width: 200, height: 200 } })
    );

    expect(geometry.cropSize).toEqual({ width: 200, height: 200 });
    expect(geometry.sourceRect).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(geometry.destRect).toEqual({ x: 50, y: 50, width: 100, height: 100 });
  });

  it('우하단으로 이탈한 crop은 source를 원본 끝에서 자르고 dest는 원점이다', () => {
    const geometry = computeTransformGeometry(
      100,
      100,
      makeTransform({ crop: { x: 60, y: 70, width: 80, height: 80 } })
    );

    expect(geometry.sourceRect).toEqual({ x: 60, y: 70, width: 40, height: 30 });
    expect(geometry.destRect).toEqual({ x: 0, y: 0, width: 40, height: 30 });
    expect(geometry.frameSize).toEqual({ width: 80, height: 80 });
  });

  it('원본과 교집합이 없으면 INVALID_DIMENSIONS (kind: crop-outside-source)', () => {
    expect.assertions(3);
    try {
      computeTransformGeometry(100, 100, makeTransform({ crop: { x: 100, y: 0, width: 50, height: 50 } }));
    } catch (error) {
      expect(error).toBeInstanceOf(ImageProcessError);
      if (error instanceof ImageProcessError) {
        expect(error.code).toBe('INVALID_DIMENSIONS');
        expect(error.details?.kind).toBe('crop-outside-source');
      }
    }
  });

  it('한 변만 맞닿은 crop(폭 0 교집합)도 교집합 없음으로 본다', () => {
    expect(() =>
      computeTransformGeometry(100, 100, makeTransform({ crop: { x: -50, y: 0, width: 50, height: 50 } }))
    ).toThrow(ImageProcessError);
  });
});

describe('computeTransformGeometry — rotate 프레임', () => {
  it('0°는 프레임이 cropSize와 같고 clip이 필요 없다', () => {
    const geometry = computeTransformGeometry(400, 300, makeTransform());

    expect(geometry.radians).toBe(0);
    expect(geometry.frameSize).toEqual({ width: 400, height: 300 });
    expect(geometry.needsFrameClip).toBe(false);
  });

  it.each([
    [90, { width: 300, height: 400 }],
    [180, { width: 400, height: 300 }],
    [270, { width: 300, height: 400 }],
  ])('%d° expand는 폭·높이를 정확히 교환한다(반올림 오차 없음)', (degrees, expected) => {
    const geometry = computeTransformGeometry(400, 300, makeTransform({ degrees }));

    expect(geometry.frameSize).toEqual(expected);
    expect(geometry.radians).toBeCloseTo((degrees * Math.PI) / 180, 12);
  });

  it('45° expand는 회전 AABB를 반올림한 프레임이다', () => {
    const geometry = computeTransformGeometry(200, 200, makeTransform({ degrees: 45 }));

    // 200 * (cos45 + sin45) = 282.84 → 283
    expect(geometry.frameSize).toEqual({ width: 283, height: 283 });
    expect(geometry.needsFrameClip).toBe(false);
  });

  it('45° expand: false는 프레임이 cropSize이고 clip 경로가 필요하다', () => {
    const geometry = computeTransformGeometry(200, 200, makeTransform({ degrees: 45, expand: false }));

    expect(geometry.frameSize).toEqual({ width: 200, height: 200 });
    expect(geometry.needsFrameClip).toBe(true);
  });

  it('90° expand: false는 비정사각형에서만 clip 경로가 필요하다', () => {
    expect(computeTransformGeometry(400, 300, makeTransform({ degrees: 90, expand: false })).needsFrameClip).toBe(true);
    expect(computeTransformGeometry(300, 300, makeTransform({ degrees: 90, expand: false })).needsFrameClip).toBe(
      false
    );
  });

  it('180° expand: false는 프레임을 넘치지 않으므로 clip 경로가 필요 없다', () => {
    expect(computeTransformGeometry(400, 300, makeTransform({ degrees: 180, expand: false })).needsFrameClip).toBe(
      false
    );
  });

  it('crop과 rotate를 함께 쓰면 프레임은 crop 크기를 회전한 결과다', () => {
    const geometry = computeTransformGeometry(
      1000,
      800,
      makeTransform({ crop: { x: 100, y: 100, width: 400, height: 300 }, degrees: 90 })
    );

    expect(geometry.cropSize).toEqual({ width: 400, height: 300 });
    expect(geometry.frameSize).toEqual({ width: 300, height: 400 });
    expect(geometry.sourceRect).toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });
});

describe('computeTransformGeometry — flip', () => {
  it('flip 플래그를 그대로 전달하고 프레임 크기는 바꾸지 않는다', () => {
    const geometry = computeTransformGeometry(400, 300, makeTransform({ flipX: true, flipY: true }));

    expect(geometry.flipX).toBe(true);
    expect(geometry.flipY).toBe(true);
    expect(geometry.frameSize).toEqual({ width: 400, height: 300 });
  });
});

describe('isTransformIdentity', () => {
  it('crop·flip·rotate가 모두 없으면 true', () => {
    expect(isTransformIdentity(makeTransform())).toBe(true);
  });

  it('하나라도 있으면 false', () => {
    expect(isTransformIdentity(makeTransform({ crop: { x: 0, y: 0, width: 1, height: 1 } }))).toBe(false);
    expect(isTransformIdentity(makeTransform({ flipX: true }))).toBe(false);
    expect(isTransformIdentity(makeTransform({ degrees: 90 }))).toBe(false);
  });
});
