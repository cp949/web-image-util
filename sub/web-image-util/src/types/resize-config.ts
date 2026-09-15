/**
 * Resize Config type system
 *
 * @description
 * Type-safe resizing configuration system based on Discriminated Union
 * - Type narrowing through fit field
 * - Compile-time type safety guarantee
 * - Enforces required/optional options for each fit mode
 */

import { ImageProcessError, optionInvalid } from '../errors.internal';

// ============================================================================
// BASE TYPES - Base types
// ============================================================================

/**
 * Padding definition to apply to resize result
 * - Single number for uniform padding on all sides
 * - Object for selective padding on specific sides
 */
export type Padding =
  | number
  | {
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

/**
 * cover/contain에서 이미지를 배치할 9방향 gravity 값 목록.
 * `ResizeGravity` 타입과 런타임 검증 Set(`RESIZE_GRAVITY_VALUES`)이 모두 이 배열에서 파생된다 —
 * 값 목록을 여러 곳에 따로 유지하면 한쪽만 갱신했을 때 컴파일 에러 없이 어긋날 수 있다.
 */
const RESIZE_GRAVITIES = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const;

/**
 * cover/contain에서 이미지를 배치할 9방향 gravity.
 * `top-*`/`bottom-*`는 세로, `*-left`/`*-right`는 가로, `center`는 완전 중앙이다.
 *
 * 워터마크/오버레이 배치용 `Position`(`composition/position-types.ts`)과는 별개의 타입이다 —
 * 이름 형태(`middle-*` vs `center-*`)와 좌표 의미(절대 margin+`custom` vs 배치 영역 대비 정렬 비율)가 다르다.
 */
export type ResizeGravity = (typeof RESIZE_GRAVITIES)[number];

/**
 * cover 전용 focal-point. 소스 이미지 기준 0~1 정규화 좌표(가로/세로 비율)로 강조할 지점을 지정한다.
 * transform() crop의 원본 픽셀 좌표계와 의도적으로 다르다 — crop은 절대 좌표, focal-point는
 * 소스 크기와 무관하게 재사용 가능한 상대 지점이 목적이다.
 */
export interface ResizeFocalPoint {
  x: number;
  y: number;
}

// ============================================================================
// FIT MODE CONFIGS - Individual configurations for each fit mode
// ============================================================================

/**
 * Cover mode: Fill image to specified size completely (may crop)
 * Same behavior as CSS object-fit: cover
 */
export interface CoverConfig {
  fit: 'cover';
  width: number;
  height: number;
  /** 배치 기준. gravity 9방향 문자열 또는 focal-point({x, y}, 0~1 정규화). 생략 시 중앙 정렬(기존 동작과 동일) */
  position?: ResizeGravity | ResizeFocalPoint;
}

/**
 * Contain mode: Fit entire image within specified size (may have empty space)
 * Same behavior as CSS object-fit: contain
 */
export interface ContainConfig {
  fit: 'contain';
  width: number;
  height: number;
  /** 원본보다 크게 확대하지 않을지 여부. 출력 캔버스 크기는 유지한다 */
  withoutEnlargement?: boolean;
  /** 배치 기준. gravity 9방향 문자열만 허용(전체를 자르지 않는 fit이라 focal-point는 의미가 없다). 생략 시 중앙 정렬 */
  position?: ResizeGravity;
}

/**
 * Fill mode: Fit image to exact specified size (ignore aspect ratio, may stretch or compress)
 * Same behavior as CSS object-fit: fill
 * - 한 축만 지정하면 나머지 축은 렌더 시점에 원본 비율로 계산한다
 * - At least one of width or height is required
 */
export type FillConfig =
  | {
      fit: 'fill';
      width: number;
      height?: number;
    }
  | {
      fit: 'fill';
      width?: number;
      height: number;
    }
  | {
      fit: 'fill';
      width: number;
      height: number;
    };

/**
 * scale 배율 값 — 균일 배율(number) 또는 축별 배율({ sx }, { sy }, { sx, sy })
 */
export type ScaleValue = number | { sx: number } | { sy: number } | { sx: number; sy: number };

/**
 * Scale mode: 원본 크기 기준 배율 리사이즈
 * - 원본 크기는 렌더 시점에 해석되므로 config는 배율만 담는다
 * - 생략한 축의 배율은 1로 처리한다
 */
export interface ScaleConfig {
  fit: 'scale';
  scale: ScaleValue;
}

/**
 * MaxFit mode: Maximum size limit (shrink only, no enlargement)
 * - If image is larger than specified size, shrink it
 * - If image is smaller than specified size, keep original size
 * - At least one of width or height is required
 */
export type MaxFitConfig =
  | {
      fit: 'maxFit';
      width: number;
      height?: number;
    }
  | {
      fit: 'maxFit';
      width?: number;
      height: number;
    }
  | {
      fit: 'maxFit';
      width: number;
      height: number;
    };

/**
 * MinFit mode: Minimum size guarantee (enlarge only, no shrinking)
 * - If image is smaller than specified size, enlarge it
 * - If image is larger than specified size, keep original size
 * - At least one of width or height is required
 */
export type MinFitConfig =
  | {
      fit: 'minFit';
      width: number;
      height?: number;
    }
  | {
      fit: 'minFit';
      width?: number;
      height: number;
    }
  | {
      fit: 'minFit';
      width: number;
      height: number;
    };

/**
 * ClampFit mode: 최소/최대 크기 범위로 스케일을 자른다(종횡비 유지)
 * - min 계열만 주면 minFit과, max 계열만 주면 maxFit과 동일한 결과
 * - min/max가 동시에 만족 불가능하면(예: 축소 요구와 확대 요구가 상충) max 제약만 적용하고 경고한다
 * - 4개 필드 모두 optional — 다 비어 있으면 에러 없이 원본을 그대로 반환한다(no-op)
 */
export interface ClampFitConfig {
  fit: 'clampFit';
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// ============================================================================
// DISCRIMINATED UNION - Main type definition
// ============================================================================

/**
 * ResizeConfig Discriminated Union type
 *
 * @description
 * Resizing configuration type supporting 7 fit modes:
 * - cover: Fill entire area (may crop)
 * - contain: Fit entire image (may create empty space)
 * - fill: Exact size fit (ignore aspect ratio; 한 축만 지정하면 나머지는 원본 비율)
 * - maxFit: Only allow shrinking (no enlargement)
 * - minFit: Only allow enlargement (no shrinking)
 * - clampFit: min/max 범위로 스케일을 자름(종횡비 유지, 충돌 시 max 우선)
 * - scale: 원본 크기 기준 배율 (렌더 시점에 원본 크기로 해석)
 *
 * Utilizes TypeScript's Discriminated Union to
 * narrow types by fit field and enforce required/optional properties for each mode.
 */
export type ResizeConfig =
  | CoverConfig
  | ContainConfig
  | FillConfig
  | MaxFitConfig
  | MinFitConfig
  | ClampFitConfig
  | ScaleConfig;

// ============================================================================
// TYPE GUARDS - Type guard functions
// ============================================================================

/**
 * CoverConfig type guard
 */
export function isCoverConfig(config: ResizeConfig): config is CoverConfig {
  return config.fit === 'cover';
}

/**
 * ContainConfig type guard
 */
export function isContainConfig(config: ResizeConfig): config is ContainConfig {
  return config.fit === 'contain';
}

/**
 * position 필드를 갖는 fit(cover/contain)인지 판별한다.
 * `validateResizePosition`(이 파일)과 `resolveAlignment`(core/resize-calculator.internal.ts)가
 * 같은 판별 기준을 공유한다 — fit 목록을 두 곳에 따로 하드코딩하지 않기 위함이다.
 */
export function isPositionableConfig(config: ResizeConfig): config is CoverConfig | ContainConfig {
  return config.fit === 'cover' || config.fit === 'contain';
}

/**
 * FillConfig type guard
 */
export function isFillConfig(config: ResizeConfig): config is FillConfig {
  return config.fit === 'fill';
}

/**
 * MaxFitConfig type guard
 */
export function isMaxFitConfig(config: ResizeConfig): config is MaxFitConfig {
  return config.fit === 'maxFit';
}

/**
 * MinFitConfig type guard
 */
export function isMinFitConfig(config: ResizeConfig): config is MinFitConfig {
  return config.fit === 'minFit';
}

/**
 * ClampFitConfig type guard
 */
export function isClampFitConfig(config: ResizeConfig): config is ClampFitConfig {
  return config.fit === 'clampFit';
}

/**
 * ScaleConfig type guard
 */
export function isScaleConfig(config: ResizeConfig): config is ScaleConfig {
  return config.fit === 'scale';
}

// ============================================================================
// RUNTIME VALIDATION - Runtime validation function
// ============================================================================

/** resize 축 값 하나가 유한 양수인지 검사한다 */
function isValidDimension(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** gravity로 허용하는 9방향 값 집합. RESIZE_GRAVITIES에서 파생한다 */
const RESIZE_GRAVITY_VALUES: ReadonlySet<string> = new Set(RESIZE_GRAVITIES);

/** focal-point 좌표가 [0, 1] 경계에서 부동소수점 오차로 살짝 벗어난 값을 봐주는 허용치 */
const FOCAL_POINT_EPSILON = 1e-6;

/** gravity 문자열 검증 — 9방향 값 밖이면 거부 */
function validateGravityValue(value: unknown, option: string): void {
  if (typeof value !== 'string' || !RESIZE_GRAVITY_VALUES.has(value)) {
    throw optionInvalid(
      option,
      `${option} must be one of ${[...RESIZE_GRAVITY_VALUES].join(', ')} (got ${String(value)})`
    );
  }
}

/**
 * focal-point 한 축 검증 — 유한수이고 [0-epsilon, 1+epsilon] 안이어야 한다.
 * epsilon 안쪽으로 벗어난 값은 여기서는 통과시킨다 — 실제 0/1로 자르는 clamp는
 * 계산 시점(resize-calculator.internal.ts)에서 한다. 검증은 "받아들일지"만 결정한다.
 */
function validateFocalPointAxis(value: unknown, option: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw optionInvalid(option, `${option} must be a finite number (got ${String(value)})`);
  }
  if (value < -FOCAL_POINT_EPSILON || value > 1 + FOCAL_POINT_EPSILON) {
    throw optionInvalid(option, `${option} must be within [0, 1] (got ${value})`);
  }
}

/** 값이 focal-point 형태({x, y} 객체)로 보이는지 판별한다. 에러 메시지 선택에만 쓰인다 */
function looksLikeFocalPoint(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && ('x' in value || 'y' in value);
}

/**
 * resize()의 position 필드를 검증한다.
 * - cover: gravity 문자열 또는 focal-point 객체({x, y}) 허용
 * - contain: gravity 문자열만 허용. focal-point 객체가 타입을 우회해 들어오면 거부한다
 * - fill/maxFit/minFit/scale: position 필드 자체가 타입에 없다. 검증 대상이 아니다
 */
function validateResizePosition(config: ResizeConfig): void {
  if (!isPositionableConfig(config)) {
    return;
  }

  const position = config.position;
  if (position === undefined) {
    return;
  }

  if (typeof position === 'string') {
    validateGravityValue(position, 'position');
    return;
  }

  if (config.fit === 'contain') {
    // contain은 gravity 문자열만 허용한다. focal-point 형태({x, y} 객체)로 온 값은
    // "cover 전용" 오해임을 짚어주고, 그 외 형태(숫자·배열 등)는 실제로 focal-point가
    // 아니었으므로 validateGravityValue의 일반 메시지로 원인을 정확히 전달한다.
    if (looksLikeFocalPoint(position)) {
      throw optionInvalid(
        'position',
        'contain의 position은 gravity 문자열만 허용합니다. focal-point 객체는 cover 전용입니다.'
      );
    }
    validateGravityValue(position, 'position');
    return;
  }

  if (typeof position !== 'object' || position === null || Array.isArray(position)) {
    throw optionInvalid('position', 'position은 gravity 문자열 또는 { x, y } 객체여야 합니다.');
  }

  validateFocalPointAxis((position as { x: unknown }).x, 'position.x');
  validateFocalPointAxis((position as { y: unknown }).y, 'position.y');
}

/**
 * ResizeConfig runtime validation function
 * - maxFit/minFit/fill: Either width or height is required
 * - cover/contain: Both width and height are required
 * - scale: 배율(균일 또는 축별)은 유한 양수여야 한다
 * @throws {ImageProcessError} If configuration is invalid
 */
export function validateResizeConfig(config: ResizeConfig): void {
  // maxFit, minFit, fill require at least one of width or height
  if (config.fit === 'maxFit' || config.fit === 'minFit' || config.fit === 'fill') {
    if (config.width == null && config.height == null) {
      throw new ImageProcessError(`${config.fit} requires at least width or height`, 'INVALID_DIMENSIONS');
    }
    if (
      (config.width != null && !isValidDimension(config.width)) ||
      (config.height != null && !isValidDimension(config.height))
    ) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
    }
  }

  // clampFit: 4개 필드(minWidth/minHeight/maxWidth/maxHeight) 전부 optional.
  // "최소 1개" 요구는 없다 — 다 비면 no-op(계산식에서 자연히 나옴). 주어진 값만 유한 양수인지 검사한다.
  if (config.fit === 'clampFit') {
    if (config.minWidth != null && !isValidDimension(config.minWidth)) {
      throw new ImageProcessError('clampFit minWidth must be a positive finite number', 'INVALID_DIMENSIONS');
    }
    if (config.minHeight != null && !isValidDimension(config.minHeight)) {
      throw new ImageProcessError('clampFit minHeight must be a positive finite number', 'INVALID_DIMENSIONS');
    }
    if (config.maxWidth != null && !isValidDimension(config.maxWidth)) {
      throw new ImageProcessError('clampFit maxWidth must be a positive finite number', 'INVALID_DIMENSIONS');
    }
    if (config.maxHeight != null && !isValidDimension(config.maxHeight)) {
      throw new ImageProcessError('clampFit maxHeight must be a positive finite number', 'INVALID_DIMENSIONS');
    }
  }

  // cover and contain require both width and height
  if (config.fit === 'cover' || config.fit === 'contain') {
    // First check for undefined/null (0 is invalid but checked separately)
    if (config.width === undefined || config.width === null || config.height === undefined || config.height === null) {
      throw new ImageProcessError(`${config.fit} requires both width and height`, 'INVALID_DIMENSIONS');
    }
    // Check if width or height is 0 or negative
    if (config.width <= 0 || config.height <= 0) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
    }
  }

  // scale requires finite positive factors (uniform or per-axis)
  if (config.fit === 'scale') {
    const { scale } = config;
    if (typeof scale === 'number') {
      if (!isValidDimension(scale)) {
        throw new ImageProcessError('scale must be a finite positive number', 'INVALID_DIMENSIONS');
      }
    } else {
      const hasSx = typeof scale === 'object' && scale !== null && 'sx' in scale;
      const hasSy = typeof scale === 'object' && scale !== null && 'sy' in scale;
      if (!hasSx && !hasSy) {
        throw new ImageProcessError('scale requires at least sx or sy', 'INVALID_DIMENSIONS');
      }
      if (
        (hasSx && !isValidDimension((scale as { sx: number }).sx)) ||
        (hasSy && !isValidDimension((scale as { sy: number }).sy))
      ) {
        throw new ImageProcessError('scale factors must be finite positive numbers', 'INVALID_DIMENSIONS');
      }
    }
  }

  // position(gravity/focal-point) 검증
  validateResizePosition(config);
}
