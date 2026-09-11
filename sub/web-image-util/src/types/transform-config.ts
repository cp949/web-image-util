/**
 * transform() 설정 타입과 호출 시점 검증
 *
 * @description
 * - 공개 타입 TransformOptions와 하위 타입을 정의한다.
 * - validateTransformOptions: 원본 크기와 무관한 검증. LazyRenderPipeline.addTransform이 호출한다.
 * - normalizeTransformOptions: 축약형(rotate: 90)과 생략 필드를 단일 내부 형태로 편다.
 * - 원본 크기에 의존하는 계산(crop 교집합, 프레임 크기)은 core/transform-calculator.internal.ts가 담당한다.
 * - 연산 순서는 crop → flip → rotate → resize로 고정이며 호출 순서와 무관하다.
 */

import { ImageProcessError } from '../errors.internal';

/** 원본 픽셀 좌표 기준 crop 사각형. 원본을 벗어나도 되며 밖은 투명이다 */
export interface TransformCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 반전 축. horizontal은 좌우, vertical은 상하 */
export interface TransformFlip {
  horizontal?: boolean;
  vertical?: boolean;
}

/** 회전 설정(객체형). `rotate: 90`은 `{ degrees: 90 }`과 같다 */
export interface TransformRotate {
  /** 도 단위. 양수 = 시계 방향. 유한수면 어떤 값이든 받고 [0, 360)으로 정규화한다 */
  degrees: number;
  /**
   * 회전 결과를 담는 프레임 정책 (기본 true)
   * - true: 회전된 사각형의 axis-aligned bounding box가 출력 프레임
   * - false: 입력 프레임 크기를 유지하고 벗어난 모서리를 잘라낸다
   */
  expand?: boolean;
}

/**
 * transform() 옵션
 *
 * @description 모든 필드는 선택이다. 빈 객체는 no-op이며 1회 호출 슬롯만 소비한다.
 */
export interface TransformOptions {
  /** 원본 픽셀 좌표 기준 crop. SVG는 getImageDimensions()가 보고하는 유효 크기 기준 */
  crop?: TransformCrop;
  /** 반전. crop 뒤, rotate 앞에 적용된다 */
  flip?: TransformFlip;
  /** 회전. crop 결과의 중심 기준 */
  rotate?: number | TransformRotate;
}

/** 검증·정규화를 마친 내부 형태. 렌더 파이프라인은 이 형태만 본다 */
export interface NormalizedTransform {
  /** 정수로 반올림된 crop. 없으면 null */
  crop: TransformCrop | null;
  flipX: boolean;
  flipY: boolean;
  /** [0, 360) */
  degrees: number;
  /** 기본 true */
  expand: boolean;
}

/** 옵션 오류를 OPTION_INVALID로 만든다. option은 점 표기 경로 */
function optionInvalid(option: string, message: string): ImageProcessError {
  return new ImageProcessError(message, 'OPTION_INVALID', { details: { option } });
}

/** crop 검증 — 유한수, 반올림 후 양수 크기 */
function validateCrop(crop: TransformCrop): void {
  if (typeof crop !== 'object' || crop === null) {
    throw new ImageProcessError('transform crop must be an object', 'INVALID_DIMENSIONS', {
      details: { kind: 'invalid-crop' },
    });
  }
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (!values.every((value) => Number.isFinite(value))) {
    throw new ImageProcessError('transform crop x, y, width, height must be finite numbers', 'INVALID_DIMENSIONS', {
      details: { kind: 'invalid-crop', x: crop.x, y: crop.y, width: crop.width, height: crop.height },
    });
  }
  if (Math.round(crop.width) <= 0 || Math.round(crop.height) <= 0) {
    throw new ImageProcessError(
      `transform crop width and height must round to > 0 (got ${crop.width}x${crop.height})`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-crop', width: crop.width, height: crop.height } }
    );
  }
}

/** rotate 검증 — 숫자 축약형 또는 { degrees, expand? } */
function validateRotate(rotate: number | TransformRotate): void {
  if (typeof rotate === 'number') {
    if (!Number.isFinite(rotate)) {
      throw optionInvalid('rotate.degrees', 'transform rotate must be a finite number');
    }
    return;
  }
  if (typeof rotate !== 'object' || rotate === null || !Number.isFinite(rotate.degrees)) {
    throw optionInvalid('rotate.degrees', 'transform rotate.degrees must be a finite number');
  }
  if (rotate.expand !== undefined && typeof rotate.expand !== 'boolean') {
    throw optionInvalid('rotate.expand', 'transform rotate.expand must be a boolean');
  }
}

/** flip 검증 — 각 축은 boolean 또는 생략 */
function validateFlip(flip: TransformFlip): void {
  if (typeof flip !== 'object' || flip === null) {
    throw optionInvalid('flip', 'transform flip must be an object');
  }
  if (flip.horizontal !== undefined && typeof flip.horizontal !== 'boolean') {
    throw optionInvalid('flip.horizontal', 'transform flip.horizontal must be a boolean');
  }
  if (flip.vertical !== undefined && typeof flip.vertical !== 'boolean') {
    throw optionInvalid('flip.vertical', 'transform flip.vertical must be a boolean');
  }
}

/**
 * transform 옵션 검증
 *
 * 원본 크기가 필요 없는 검사만 한다. 실패 시 어떤 상태도 남기지 않는다.
 * @throws {ImageProcessError} INVALID_DIMENSIONS(crop), OPTION_INVALID(그 외)
 */
export function validateTransformOptions(options: TransformOptions): void {
  if (typeof options !== 'object' || options === null) {
    throw optionInvalid('transform', 'transform options must be an object');
  }
  if (options.crop !== undefined) {
    validateCrop(options.crop);
  }
  if (options.flip !== undefined) {
    validateFlip(options.flip);
  }
  if (options.rotate !== undefined) {
    validateRotate(options.rotate);
  }
}

/** 각도를 [0, 360)으로 정규화한다. -0은 0으로 만든다 */
export function normalizeDegrees(degrees: number): number {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized === 0 ? 0 : normalized;
}

/**
 * 검증을 통과한 옵션을 내부 형태로 편다. validateTransformOptions 뒤에만 호출한다.
 */
export function normalizeTransformOptions(options: TransformOptions): NormalizedTransform {
  const rotate = options.rotate;
  const degrees = typeof rotate === 'number' ? rotate : (rotate?.degrees ?? 0);
  const expand = typeof rotate === 'object' && rotate !== null && rotate.expand !== undefined ? rotate.expand : true;

  return {
    crop: options.crop
      ? {
          x: Math.round(options.crop.x),
          y: Math.round(options.crop.y),
          width: Math.round(options.crop.width),
          height: Math.round(options.crop.height),
        }
      : null,
    flipX: options.flip?.horizontal === true,
    flipY: options.flip?.vertical === true,
    degrees: normalizeDegrees(degrees),
    expand,
  };
}
