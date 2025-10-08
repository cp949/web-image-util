/**
 * Resize Config type system
 *
 * @description
 * Type-safe resizing configuration system based on Discriminated Union
 * - Type narrowing through fit field
 * - Compile-time type safety guarantee
 * - Enforces required/optional options for each fit mode
 */

import { ImageProcessError } from './index';

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
  /** Whether to trim empty space (default: false) - automatically removes padding with same color as background */
  trimEmpty?: boolean;
  /** Whether to prevent enlargement (default: false) - if true, small images won't be enlarged */
  withoutEnlargement?: boolean;
}

/**
 * Fill mode: Fit image to exact specified size (ignore aspect ratio, may stretch or compress)
 * Same behavior as CSS object-fit: fill
 */
export interface FillConfig extends BaseResizeConfig {
  fit: 'fill';
  width: number;
  height: number;
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
 * Resizing configuration type supporting 5 fit modes:
 * - cover: Fill entire area (may crop)
 * - contain: Fit entire image (may create empty space)
 * - fill: Exact size fit (ignore aspect ratio)
 * - maxFit: Only allow shrinking (no enlargement)
 * - minFit: Only allow enlargement (no shrinking)
 *
 * Utilizes TypeScript's Discriminated Union to
 * narrow types by fit field and enforce required/optional properties for each mode.
 */
export type ResizeConfig = CoverConfig | ContainConfig | FillConfig | MaxFitConfig | MinFitConfig;

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

// ============================================================================
// RUNTIME VALIDATION - Runtime validation function
// ============================================================================

/**
 * ResizeConfig runtime validation function
 * - maxFit/minFit: Either width or height is required
 * - cover/contain/fill: Both width and height are required
 * @throws {ImageProcessError} If configuration is invalid
 */
export function validateResizeConfig(config: ResizeConfig): void {
  // maxFit and minFit require at least one of width or height
  if (config.fit === 'maxFit' || config.fit === 'minFit') {
    if (!config.width && !config.height) {
      throw new ImageProcessError(`${config.fit} requires at least width or height`, 'INVALID_DIMENSIONS');
    }
    // Check if width or height is negative
    if ((config.width && config.width <= 0) || (config.height && config.height <= 0)) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
    }
  }

  // cover, contain, fill require both width and height
  if (config.fit === 'cover' || config.fit === 'contain' || config.fit === 'fill') {
    // First check for undefined/null (0 is invalid but checked separately)
    if (config.width === undefined || config.width === null || config.height === undefined || config.height === null) {
      throw new ImageProcessError(`${config.fit} requires both width and height`, 'INVALID_DIMENSIONS');
    }
    // Check if width or height is 0 or negative
    if (config.width <= 0 || config.height <= 0) {
      throw new ImageProcessError(`${config.fit} width and height must be positive numbers`, 'INVALID_DIMENSIONS');
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
