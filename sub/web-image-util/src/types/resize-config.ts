/**
 * Resize Config type system
 *
 * @description
 * Type-safe resizing configuration system based on Discriminated Union
 * - Type narrowing through fit field
 * - Compile-time type safety guarantee
 * - Enforces required/optional options for each fit mode
 */

import { ImageProcessError } from '../errors.internal';

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
 * Base configuration applied to all ResizeConfig
 */
export interface BaseResizeConfig {
  /** Padding around resize result (pixels) */
  padding?: Padding;
  /** Background color (CSS color string, default: transparent black) */
  background?: string;
}

// ============================================================================
// FIT MODE CONFIGS - Individual configurations for each fit mode
// ============================================================================

/**
 * Cover mode: Fill image to specified size completely (may crop)
 * Same behavior as CSS object-fit: cover
 */
export interface CoverConfig extends BaseResizeConfig {
  fit: 'cover';
  width: number;
  height: number;
}

/**
 * Contain mode: Fit entire image within specified size (may have empty space)
 * Same behavior as CSS object-fit: contain
 */
export interface ContainConfig extends BaseResizeConfig {
  fit: 'contain';
  width: number;
  height: number;
  /** 원본보다 크게 확대하지 않을지 여부. 출력 캔버스 크기는 유지한다 */
  withoutEnlargement?: boolean;
}

/**
 * Fill mode: Fit image to exact specified size (ignore aspect ratio, may stretch or compress)
 * Same behavior as CSS object-fit: fill
 * - 한 축만 지정하면 나머지 축은 렌더 시점에 원본 비율로 계산한다
 * - At least one of width or height is required
 */
export type FillConfig =
  | (BaseResizeConfig & {
      fit: 'fill';
      width: number;
      height?: number;
    })
  | (BaseResizeConfig & {
      fit: 'fill';
      width?: number;
      height: number;
    })
  | (BaseResizeConfig & {
      fit: 'fill';
      width: number;
      height: number;
    });

/**
 * scale 배율 값 — 균일 배율(number) 또는 축별 배율({ sx }, { sy }, { sx, sy })
 */
export type ScaleValue = number | { sx: number } | { sy: number } | { sx: number; sy: number };

/**
 * Scale mode: 원본 크기 기준 배율 리사이즈
 * - 원본 크기는 렌더 시점에 해석되므로 config는 배율만 담는다
 * - 생략한 축의 배율은 1로 처리한다
 */
export interface ScaleConfig extends BaseResizeConfig {
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
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width: number;
      height?: number;
    })
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width?: number;
      height: number;
    })
  | (BaseResizeConfig & {
      fit: 'maxFit';
      width: number;
      height: number;
    });

/**
 * MinFit mode: Minimum size guarantee (enlarge only, no shrinking)
 * - If image is smaller than specified size, enlarge it
 * - If image is larger than specified size, keep original size
 * - At least one of width or height is required
 */
export type MinFitConfig =
  | (BaseResizeConfig & {
      fit: 'minFit';
      width: number;
      height?: number;
    })
  | (BaseResizeConfig & {
      fit: 'minFit';
      width?: number;
      height: number;
    })
  | (BaseResizeConfig & {
      fit: 'minFit';
      width: number;
      height: number;
    });

// ============================================================================
// DISCRIMINATED UNION - Main type definition
// ============================================================================

/**
 * ResizeConfig Discriminated Union type
 *
 * @description
 * Resizing configuration type supporting 6 fit modes:
 * - cover: Fill entire area (may crop)
 * - contain: Fit entire image (may create empty space)
 * - fill: Exact size fit (ignore aspect ratio; 한 축만 지정하면 나머지는 원본 비율)
 * - maxFit: Only allow shrinking (no enlargement)
 * - minFit: Only allow enlargement (no shrinking)
 * - scale: 원본 크기 기준 배율 (렌더 시점에 원본 크기로 해석)
 *
 * Utilizes TypeScript's Discriminated Union to
 * narrow types by fit field and enforce required/optional properties for each mode.
 */
export type ResizeConfig = CoverConfig | ContainConfig | FillConfig | MaxFitConfig | MinFitConfig | ScaleConfig;

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

  // Padding validation (optional)
  if (config.padding !== undefined) {
    if (typeof config.padding === 'number') {
      if (config.padding < 0) {
        throw new ImageProcessError('padding must be non-negative', 'INVALID_DIMENSIONS');
      }
    } else {
      // Object form padding
      const { top = 0, right = 0, bottom = 0, left = 0 } = config.padding;
      if (top < 0 || right < 0 || bottom < 0 || left < 0) {
        throw new ImageProcessError('padding values must be non-negative', 'INVALID_DIMENSIONS');
      }
    }
  }
}
