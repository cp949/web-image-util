/**
 * box-calculator 단위 테스트
 *
 * content 크기와 정규화된 box 옵션으로 바깥 상자 크기, radius 축별 해석과 CSS 겹침 축소 규칙,
 * padding box 사각형·반지름, border stroke 사각형·반지름을 계산하는 순수 함수를 검증한다.
 * Canvas는 사용하지 않는다.
 */

import { describe, expect, it } from 'vitest';
import { computeBoxGeometry } from '../../../src/core/box-calculator.internal';
import type { NormalizedBox } from '../../../src/types/box-config';
import type { Padding } from '../../../src/types/resize-config';

function makeBox(overrides: Partial<Omit<NormalizedBox, 'padding'>> & { padding?: Padding } = {}): NormalizedBox {
  let normalizedPadding: { top: number; right: number; bottom: number; left: number };
  if (typeof overrides.padding === 'number') {
    const p = overrides.padding;
    normalizedPadding = { top: p, right: p, bottom: p, left: p };
  } else if (overrides.padding && typeof overrides.padding === 'object') {
    normalizedPadding = {
      top: overrides.padding.top ?? 0,
      right: overrides.padding.right ?? 0,
      bottom: overrides.padding.bottom ?? 0,
      left: overrides.padding.left ?? 0,
    };
  } else {
    normalizedPadding = { top: 0, right: 0, bottom: 0, left: 0 };
  }

  return {
    padding: normalizedPadding,
    background: overrides.background ?? 'transparent',
    radius: overrides.radius ?? 0,
    border: overrides.border ?? null,
  };
}

const ZERO_RADII = [
  { rx: 0, ry: 0 },
  { rx: 0, ry: 0 },
  { rx: 0, ry: 0 },
  { rx: 0, ry: 0 },
];

describe('computeBoxGeometry — 크기와 content 배치', () => {
  it('빈 옵션은 content 크기 그대로다', () => {
    const geometry = computeBoxGeometry(100, 50, makeBox());

    expect(geometry.outerSize).toEqual({ width: 100, height: 50 });
    expect(geometry.contentOrigin).toEqual({ x: 0, y: 0 });
    expect(geometry.paddingBoxRect).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(geometry.needsPaddingBoxClip).toBe(false);
    expect(geometry.border).toBeNull();
  });

  it('숫자 padding은 네 방향에 균등히 더해진다', () => {
    const geometry = computeBoxGeometry(100, 50, makeBox({ padding: { top: 10, right: 10, bottom: 10, left: 10 } }));

    expect(geometry.outerSize).toEqual({ width: 120, height: 70 });
    expect(geometry.contentOrigin).toEqual({ x: 10, y: 10 });
  });

  it('비대칭 padding은 각 방향으로 정확히 반영된다', () => {
    const geometry = computeBoxGeometry(100, 50, makeBox({ padding: { top: 5, right: 20, bottom: 15, left: 0 } }));

    expect(geometry.outerSize).toEqual({ width: 120, height: 70 });
    expect(geometry.contentOrigin).toEqual({ x: 0, y: 5 });
  });

  it('background는 그대로 전달된다', () => {
    expect(computeBoxGeometry(10, 10, makeBox({ background: '#ff0000' })).background).toBe('#ff0000');
  });
});

describe('computeBoxGeometry — border(outside)', () => {
  it('outside border는 바깥 크기를 width*2만큼 늘리고 content를 border 안쪽으로 민다', () => {
    const geometry = computeBoxGeometry(100, 100, makeBox({ border: { width: 10, color: '#000', inset: false } }));

    expect(geometry.outerSize).toEqual({ width: 120, height: 120 });
    expect(geometry.paddingBoxRect).toEqual({ x: 10, y: 10, width: 100, height: 100 });
    expect(geometry.contentOrigin).toEqual({ x: 10, y: 10 });
  });

  it('border.strokeRect는 바깥 상자를 width/2만큼 안으로 들인 사각형이다', () => {
    const geometry = computeBoxGeometry(100, 100, makeBox({ border: { width: 10, color: '#000', inset: false } }));

    expect(geometry.border?.strokeRect).toEqual({ x: 5, y: 5, width: 110, height: 110 });
  });

  it('padding과 outside border를 함께 쓰면 content는 padding + border만큼 밀린다', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ padding: { top: 8, right: 8, bottom: 8, left: 8 }, border: { width: 4, color: '#000', inset: false } })
    );

    // outer = 100 + 8*2 + 4*2 = 124
    expect(geometry.outerSize).toEqual({ width: 124, height: 124 });
    expect(geometry.paddingBoxRect).toEqual({ x: 4, y: 4, width: 116, height: 116 });
    expect(geometry.contentOrigin).toEqual({ x: 12, y: 12 }); // border(4) + padding(8)
  });
});

describe('computeBoxGeometry — border(inset)', () => {
  it('inset border는 바깥 크기를 늘리지 않는다', () => {
    const geometry = computeBoxGeometry(100, 100, makeBox({ border: { width: 10, color: '#000', inset: true } }));

    expect(geometry.outerSize).toEqual({ width: 100, height: 100 });
  });

  it('inset border는 content를 border만큼 밀지 않는다 (padding만 반영)', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ padding: 5, border: { width: 10, color: '#000', inset: true } })
    );

    expect(geometry.outerSize).toEqual({ width: 110, height: 110 });
    expect(geometry.paddingBoxRect).toEqual({ x: 0, y: 0, width: 110, height: 110 });
    expect(geometry.contentOrigin).toEqual({ x: 5, y: 5 });
  });

  it('inset border의 strokeRect 계산식은 outside와 같다(바깥 가장자리에서 width/2)', () => {
    const outside = computeBoxGeometry(100, 100, makeBox({ border: { width: 10, color: '#000', inset: false } }));
    const inset = computeBoxGeometry(100, 100, makeBox({ border: { width: 10, color: '#000', inset: true } }));

    // outside: outerSize 120 기준 strokeRect {5,5,110,110}. inset: outerSize 100 기준이라 다른 값이 나오지만
    // "바깥 가장자리에서 width/2 안쪽" 규칙 자체는 각자의 outerSize에 대해 동일하게 적용된다.
    expect(outside.border?.strokeRect).toEqual({ x: 5, y: 5, width: 110, height: 110 });
    expect(inset.border?.strokeRect).toEqual({ x: 5, y: 5, width: 90, height: 90 });
  });
});

describe('computeBoxGeometry — radius 해석', () => {
  it('숫자 radius는 정사각형이면 모든 모서리에 같은 rx, ry다', () => {
    const geometry = computeBoxGeometry(100, 100, makeBox({ radius: 20 }));

    expect(geometry.outerRadii).toEqual([
      { rx: 20, ry: 20 },
      { rx: 20, ry: 20 },
      { rx: 20, ry: 20 },
      { rx: 20, ry: 20 },
    ]);
    expect(geometry.needsPaddingBoxClip).toBe(true);
  });

  it('% radius는 비정사각형에서 축별로 다른 절대값이 된다(타원 모서리)', () => {
    const geometry = computeBoxGeometry(200, 100, makeBox({ radius: '50%' }));

    // 겹침 없음: topSum = 100+100 = 200 = width, rightSum = 50+50 = 100 = height → 정확히 경계, 축소 없음
    expect(geometry.outerRadii).toEqual([
      { rx: 100, ry: 50 },
      { rx: 100, ry: 50 },
      { rx: 100, ry: 50 },
      { rx: 100, ry: 50 },
    ]);
  });

  it('배열 radius는 CSS 순서(TL, TR, BR, BL)로 각 모서리에 적용되고 숫자·% 혼용 가능하다', () => {
    const geometry = computeBoxGeometry(100, 50, makeBox({ radius: [10, '20%', 5, 0] }));

    expect(geometry.outerRadii).toEqual([
      { rx: 10, ry: 10 },
      { rx: 20, ry: 10 }, // 20% of 100(width)=20, 20% of 50(height)=10
      { rx: 5, ry: 5 },
      { rx: 0, ry: 0 },
    ]);
  });

  it('인접 반지름 합이 변 길이를 넘으면 CSS 규칙대로 전체를 같은 비율로 축소한다', () => {
    // 100x50, radius 40(모든 모서리) → 세로 변(50) 기준 합 80 vs 50이 겹치므로 factor = 50/80 = 0.625.
    // 0.625(=5/8)는 이진 부동소수점으로 정확히 떨어지는 값이라 결과도 정확히 25가 된다
    // (2/3처럼 순환소수가 되는 비율은 부동소수 오차 때문에 toEqual로 단언할 수 없다 — 일부러 피한다).
    const geometry = computeBoxGeometry(100, 50, makeBox({ radius: 40 }));

    expect(geometry.outerRadii).toEqual([
      { rx: 25, ry: 25 },
      { rx: 25, ry: 25 },
      { rx: 25, ry: 25 },
      { rx: 25, ry: 25 },
    ]);
  });

  it('비대칭 radius는 한쪽 변만 축소를 유발할 수 있다(다른 모서리는 그대로)', () => {
    // 100x50, radius [80, 0, 0, 0](TL만) → topSum = 80+0 = 80 vs width 100 → ratio 1.25(축소 없음).
    // leftSum = 80+0 = 80 vs height 50 → ratio 50/80 = 0.625(=5/8, 이진 정확). rightSum·bottomSum은
    // 관련 모서리가 전부 0이라 Infinity. factor = min(1, 1.25, Infinity, Infinity, 0.625) = 0.625 —
    // 대칭 케이스(전체가 같은 축소 요인을 받는 경우)와 달리 "변 하나만 제약"이 되는 경로를 검증한다.
    const geometry = computeBoxGeometry(100, 50, makeBox({ radius: [80, 0, 0, 0] }));

    expect(geometry.outerRadii).toEqual([
      { rx: 50, ry: 50 },
      { rx: 0, ry: 0 },
      { rx: 0, ry: 0 },
      { rx: 0, ry: 0 },
    ]);
  });

  it('radius 0은 needsPaddingBoxClip을 false로 만든다', () => {
    expect(computeBoxGeometry(100, 100, makeBox({ radius: 0 })).needsPaddingBoxClip).toBe(false);
    expect(computeBoxGeometry(100, 100, makeBox()).outerRadii).toEqual(ZERO_RADII);
  });
});

describe('computeBoxGeometry — padding box 반지름(border 안쪽)', () => {
  it('border가 없으면 padding box 반지름은 바깥 반지름과 같다', () => {
    const geometry = computeBoxGeometry(100, 100, makeBox({ radius: 20 }));

    expect(geometry.paddingBoxRadii).toEqual(geometry.outerRadii);
  });

  it('border가 있으면 padding box 반지름은 바깥 반지름 - border.width다 (outside)', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ radius: 20, border: { width: 8, color: '#000', inset: false } })
    );

    expect(geometry.paddingBoxRadii).toEqual([
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
    ]);
  });

  it('border.width가 바깥 반지름보다 크면 padding box 반지름은 0으로 각진다', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ radius: 5, border: { width: 20, color: '#000', inset: false } })
    );

    expect(geometry.paddingBoxRadii).toEqual(ZERO_RADII);
  });

  it('inset border도 padding box 반지름 축소 규칙은 동일하다(바깥 반지름 - border.width)', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ radius: 20, border: { width: 8, color: '#000', inset: true } })
    );

    expect(geometry.paddingBoxRadii).toEqual([
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
      { rx: 12, ry: 12 },
    ]);
  });
});

describe('computeBoxGeometry — border stroke 반지름(경로 중심 기준)', () => {
  it('stroke 반지름은 바깥 반지름 - border.width/2다', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ radius: 20, border: { width: 8, color: '#000', inset: false } })
    );

    expect(geometry.border?.strokeRadii).toEqual([
      { rx: 16, ry: 16 },
      { rx: 16, ry: 16 },
      { rx: 16, ry: 16 },
      { rx: 16, ry: 16 },
    ]);
  });

  it('border.width/2가 바깥 반지름보다 크면 stroke 반지름도 0으로 각진다', () => {
    const geometry = computeBoxGeometry(
      100,
      100,
      makeBox({ radius: 2, border: { width: 20, color: '#000', inset: false } })
    );

    expect(geometry.border?.strokeRadii).toEqual(ZERO_RADII);
  });
});
