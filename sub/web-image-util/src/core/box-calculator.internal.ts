/**
 * box 기하 계산
 *
 * @description
 * - 정규화된 box 옵션과 content(transform·resize 결과) 크기로 바깥 상자 크기, radius의
 *   px 해석과 CSS 겹침 축소, padding box 사각형·반지름, border stroke 사각형·반지름을 계산한다.
 * - 순수 함수다. Canvas를 만지지 않으며 렌더링은 single-renderer의 renderLayout이 담당한다.
 * - 크기 계약: 바깥 상자 = content + padding + (border.inset이면 0, 아니면 border.width*2).
 * - radius는 CSS border-radius와 같은 의미다: %는 가로/세로 축별로 상자 너비/높이 기준,
 *   인접 반지름 합이 변 길이를 넘으면 전체를 같은 비율로 축소한다(CSS 표준 알고리즘).
 * - padding box 반지름(paddingBoxRadii) = 바깥 반지름 - border.width(0 이하면 각짐, inset 여부와 무관).
 *   이름의 "padding box"는 CSS box model 용어대로 border 안쪽 전체(padding + content)를 가리킨다 —
 *   content(패딩을 뺀 안쪽)만을 좁혀 자르지는 않는다(알려진 cover-fit 오버플로우 특성, README 참조).
 * - border stroke는 경로 중심에 그려지므로 stroke 반지름 = 바깥 반지름 - border.width/2,
 *   stroke 사각형은 바깥 상자를 border.width/2만큼 안으로 들인 자리다(inset 여부와 무관 —
 *   inset은 바깥 크기 성장 여부와 content 밀림 여부에만 영향을 준다).
 */

import type { GeometryPoint, GeometryRectangle, GeometrySize } from '../types/base';
import type { BoxRadius, NormalizedBox } from '../types/box-config';

export interface BoxCornerRadius {
  rx: number;
  ry: number;
}

/** CSS 순서: TL, TR, BR, BL */
export type BoxCornerRadii = [BoxCornerRadius, BoxCornerRadius, BoxCornerRadius, BoxCornerRadius];

/**
 * 렌더러가 소비하는 box 기하
 */
export interface BoxGeometry {
  /** 바깥 상자(캔버스) 크기 */
  outerSize: GeometrySize;
  /** 바깥 상자 모서리 반지름(px로 해석·CSS 겹침 축소까지 끝난 값) */
  outerRadii: BoxCornerRadii;
  /** 기존 layout.position에 더할 오프셋 */
  contentOrigin: GeometryPoint;
  /** padding box 사각형(바깥 상자에서 outside border 폭만큼 안쪽 — content clip이 아니라 border 안쪽 전체다) */
  paddingBoxRect: GeometryRectangle;
  /** padding box 반지름(바깥 반지름 - border.width, 0 이하면 각짐) */
  paddingBoxRadii: BoxCornerRadii;
  /** paddingBoxRadii 중 하나라도 0보다 크면 true — 렌더러가 clip 경로를 걸어야 하는지 */
  needsPaddingBoxClip: boolean;
  background: string;
  border: {
    width: number;
    color: string;
    /** stroke 경로 사각형(바깥 상자를 width/2만큼 안으로 들인 자리) */
    strokeRect: GeometryRectangle;
    /** stroke 경로 반지름(바깥 반지름 - width/2, 0 이하면 각짐) */
    strokeRadii: BoxCornerRadii;
  } | null;
}

/** 단일 모서리 값(px 숫자 또는 % 문자열)을 축 크기 기준 px로 바꾼다 */
function resolveCornerValue(value: number | `${number}%`, axisSize: number): number {
  if (typeof value === 'number') {
    return value;
  }
  const percent = Number.parseFloat(value) / 100;
  return percent * axisSize;
}

/** radius 입력(단일 값 또는 배열)을 4개 모서리 각각의 {rx, ry}로 편다(CSS 겹침 축소 전) */
function resolveRawRadii(radius: BoxRadius, width: number, height: number): BoxCornerRadii {
  const perCorner = Array.isArray(radius) ? radius : [radius, radius, radius, radius];

  return perCorner.map((value) => ({
    rx: resolveCornerValue(value, width),
    ry: resolveCornerValue(value, height),
  })) as BoxCornerRadii;
}

/**
 * CSS border-radius 겹침 축소 알고리즘.
 *
 * 네 변 각각에서 인접한 두 모서리의 관련 축 반지름 합이 그 변의 길이를 넘으면,
 * 모든 변에서 구한 축소 비율 중 최솟값을 전체 모서리(rx, ry 전부)에 곱한다.
 */
function clampOverlap(radii: BoxCornerRadii, width: number, height: number): BoxCornerRadii {
  const [tl, tr, br, bl] = radii;

  const topSum = tl.rx + tr.rx;
  const rightSum = tr.ry + br.ry;
  const bottomSum = bl.rx + br.rx;
  const leftSum = tl.ry + bl.ry;

  const ratioOf = (sum: number, length: number): number => (sum > 0 ? length / sum : Number.POSITIVE_INFINITY);
  const factor = Math.min(
    1,
    ratioOf(topSum, width),
    ratioOf(rightSum, height),
    ratioOf(bottomSum, width),
    ratioOf(leftSum, height)
  );

  if (factor >= 1) {
    return radii;
  }
  return radii.map((corner) => ({ rx: corner.rx * factor, ry: corner.ry * factor })) as BoxCornerRadii;
}

/** 각 모서리 반지름에서 amount만큼 줄인다(0 이하면 각짐) */
function shrinkRadii(radii: BoxCornerRadii, amount: number): BoxCornerRadii {
  if (amount <= 0) {
    return radii;
  }
  return radii.map((corner) => ({
    rx: Math.max(0, corner.rx - amount),
    ry: Math.max(0, corner.ry - amount),
  })) as BoxCornerRadii;
}

function hasAnyRadius(radii: BoxCornerRadii): boolean {
  return radii.some((corner) => corner.rx > 0 || corner.ry > 0);
}

/**
 * content 크기와 정규화된 box 옵션으로 렌더 기하를 계산한다.
 *
 * @param contentWidth transform·resize 결과(둘 다 없으면 원본) 너비
 * @param contentHeight transform·resize 결과(둘 다 없으면 원본) 높이
 * @param box validateBoxOptions·normalizeBoxOptions를 거친 값
 */
export function computeBoxGeometry(contentWidth: number, contentHeight: number, box: NormalizedBox): BoxGeometry {
  const { padding, background, radius, border } = box;

  // outside border만 바깥 크기를 늘리고 content를 안쪽으로 민다. inset은 자리를 차지하지 않는다.
  const borderBand = border && !border.inset ? border.width : 0;

  const outerWidth = contentWidth + padding.left + padding.right + borderBand * 2;
  const outerHeight = contentHeight + padding.top + padding.bottom + borderBand * 2;

  const outerRadii = clampOverlap(resolveRawRadii(radius, outerWidth, outerHeight), outerWidth, outerHeight);

  const paddingBoxRect: GeometryRectangle = {
    x: borderBand,
    y: borderBand,
    width: outerWidth - borderBand * 2,
    height: outerHeight - borderBand * 2,
  };
  const paddingBoxRadii = shrinkRadii(outerRadii, border ? border.width : 0);

  const contentOrigin: GeometryPoint = {
    x: paddingBoxRect.x + padding.left,
    y: paddingBoxRect.y + padding.top,
  };

  const borderGeometry = border
    ? {
        width: border.width,
        color: border.color,
        strokeRect: {
          x: border.width / 2,
          y: border.width / 2,
          width: outerWidth - border.width,
          height: outerHeight - border.width,
        },
        strokeRadii: shrinkRadii(outerRadii, border.width / 2),
      }
    : null;

  return {
    outerSize: { width: outerWidth, height: outerHeight },
    outerRadii,
    contentOrigin,
    paddingBoxRect,
    paddingBoxRadii,
    needsPaddingBoxClip: hasAnyRadius(paddingBoxRadii),
    background,
    border: borderGeometry,
  };
}
