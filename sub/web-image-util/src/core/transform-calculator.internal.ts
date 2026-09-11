/**
 * transform 기하 계산
 *
 * @description
 * - 정규화된 transform과 원본 크기로 drawImage source/dest rect, 프레임 크기, 회전 라디안을 계산한다.
 * - 순수 함수다. Canvas를 만지지 않으며 렌더링은 single-renderer의 renderLayout이 담당한다.
 * - 연산 순서 계약: crop → flip → rotate → frame. resize는 이 결과의 frameSize를 "원본"으로 본다.
 * - 회전 AABB 계산은 composition의 getRotatedTileBoundingSize를 재사용한다(중심 기준 회전의 단일 정의).
 */

import { getRotatedTileBoundingSize } from '../composition/canvas-drawing.internal';
import { ImageProcessError } from '../errors.internal';
import type { GeometryRectangle, GeometrySize } from '../types/base';
import type { NormalizedTransform, TransformCrop } from '../types/transform-config';

/**
 * 렌더러가 소비하는 transform 기하
 */
export interface TransformGeometry {
  /** crop 후(회전 전) 크기. crop이 없으면 원본 크기 */
  cropSize: GeometrySize;
  /** 최종 프레임 크기. expand면 회전 AABB(반올림), clip이면 cropSize */
  frameSize: GeometrySize;
  /** drawImage source rect — crop ∩ 원본, 원본 픽셀 좌표 */
  sourceRect: GeometryRectangle;
  /** drawImage destination rect — crop 공간 좌표(원점 = crop 좌상단). 이탈량만큼 밀린다 */
  destRect: GeometryRectangle;
  /** 시계 방향 라디안 */
  radians: number;
  flipX: boolean;
  flipY: boolean;
  /** clip 프레임에서 회전 이미지가 프레임을 넘칠 때만 true — 렌더러가 사각형 clip 경로를 건다 */
  needsFrameClip: boolean;
}

/** crop·flip·rotate가 전부 없는지. 빈 transform은 no-op이다 */
export function isTransformIdentity(transform: NormalizedTransform): boolean {
  return transform.crop === null && !transform.flipX && !transform.flipY && transform.degrees === 0;
}

/**
 * crop과 원본의 교집합을 계산한다.
 *
 * 브라우저의 "source rect가 이미지 밖일 때 비례 clip" 스펙 동작에 의존하지 않고
 * 라이브러리가 직접 교집합을 잡는다. 교집합이 없으면 명백한 좌표 실수이므로 오류다.
 */
function intersectCrop(
  crop: TransformCrop,
  sourceWidth: number,
  sourceHeight: number
): { sourceRect: GeometryRectangle; destRect: GeometryRectangle } {
  const left = Math.max(crop.x, 0);
  const top = Math.max(crop.y, 0);
  const right = Math.min(crop.x + crop.width, sourceWidth);
  const bottom = Math.min(crop.y + crop.height, sourceHeight);

  if (right <= left || bottom <= top) {
    throw new ImageProcessError(
      `transform crop (${crop.x}, ${crop.y}, ${crop.width}x${crop.height}) does not intersect the source image (${sourceWidth}x${sourceHeight})`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'crop-outside-source', x: crop.x, y: crop.y, width: crop.width, height: crop.height } }
    );
  }

  return {
    sourceRect: { x: left, y: top, width: right - left, height: bottom - top },
    destRect: { x: left - crop.x, y: top - crop.y, width: right - left, height: bottom - top },
  };
}

/**
 * 회전 후 축 정렬 경계 크기.
 *
 * 90° 배수는 삼각함수 없이 폭·높이를 교환해 반올림 오차를 없앤다.
 * 그 외 각도는 AABB를 반올림한다.
 */
function rotatedBoundingSize(size: GeometrySize, degrees: number): GeometrySize {
  if (degrees === 0 || degrees === 180) {
    return { width: size.width, height: size.height };
  }
  if (degrees === 90 || degrees === 270) {
    return { width: size.height, height: size.width };
  }
  const bounds = getRotatedTileBoundingSize(size, degrees);
  return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
}

/**
 * 원본 크기와 정규화된 transform으로 렌더 기하를 계산한다.
 *
 * @param sourceWidth 원본 naturalWidth
 * @param sourceHeight 원본 naturalHeight
 * @param transform validateTransformOptions·normalizeTransformOptions를 거친 값
 * @throws {ImageProcessError} crop이 원본과 교집합이 없으면 INVALID_DIMENSIONS
 */
export function computeTransformGeometry(
  sourceWidth: number,
  sourceHeight: number,
  transform: NormalizedTransform
): TransformGeometry {
  // 1. crop — 없으면 원본 전체
  const crop: TransformCrop = transform.crop ?? { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  const { sourceRect, destRect } = intersectCrop(crop, sourceWidth, sourceHeight);
  const cropSize: GeometrySize = { width: crop.width, height: crop.height };

  // 2. rotate → frame
  const rotated = rotatedBoundingSize(cropSize, transform.degrees);
  const frameSize = transform.expand ? rotated : cropSize;
  const needsFrameClip = !transform.expand && (rotated.width > cropSize.width || rotated.height > cropSize.height);

  return {
    cropSize,
    frameSize,
    sourceRect,
    destRect,
    radians: (transform.degrees * Math.PI) / 180,
    flipX: transform.flipX,
    flipY: transform.flipY,
    needsFrameClip,
  };
}
