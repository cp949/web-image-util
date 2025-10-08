/**
 * Position definition (9-point system)
 *
 * @description Defines 9 basic positions and custom position for placing images or text.
 * Similar to CSS position system and used for watermarks or text overlays.
 */
export type Position =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'custom';

/**
 * Position enum constants
 *
 * @description Object that defines all values of Position type as constants.
 * Ensures type safety and supports IDE autocompletion.
 */
export const Position = {
  TOP_LEFT: 'top-left' as const,
  TOP_CENTER: 'top-center' as const,
  TOP_RIGHT: 'top-right' as const,
  MIDDLE_LEFT: 'middle-left' as const,
  MIDDLE_CENTER: 'middle-center' as const,
  MIDDLE_RIGHT: 'middle-right' as const,
  BOTTOM_LEFT: 'bottom-left' as const,
  BOTTOM_CENTER: 'bottom-center' as const,
  BOTTOM_RIGHT: 'bottom-right' as const,
  CUSTOM: 'custom' as const,
} as const;

/**
 * 2D coordinate definition
 *
 * @description Interface representing X, Y coordinates.
 * Represents absolute coordinates in pixels and used for position calculations.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size definition
 *
 * @description Interface representing width and height.
 * Represents size in pixels and used for element size calculations.
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Rectangle definition
 *
 * @description Interface representing rectangular area including coordinates and size.
 * Defines complete rectangle by including x, y coordinates and width, height.
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Position calculation utility class
 *
 * @description Provides static methods to convert Position enum and relative coordinates to actual pixel coordinates.
 * Used for position calculations of watermarks, text overlays, etc.
 */
export class PositionCalculator {
  /**
   * Convert Position enum to actual coordinates
   */
  static calculatePosition(
    position: Position,
    customPoint: Point | null,
    containerSize: Size,
    objectSize: Size,
    margin: Point = { x: 10, y: 10 }
  ): Point {
    if (position === Position.CUSTOM && customPoint) {
      return customPoint;
    }

    const { width: containerWidth, height: containerHeight } = containerSize;
    const { width: objectWidth, height: objectHeight } = objectSize;

    switch (position) {
      case Position.TOP_LEFT:
        return { x: margin.x, y: margin.y };

      case Position.TOP_CENTER:
        return {
          x: (containerWidth - objectWidth) / 2,
          y: margin.y,
        };

      case Position.TOP_RIGHT:
        return {
          x: containerWidth - objectWidth - margin.x,
          y: margin.y,
        };

      case Position.MIDDLE_LEFT:
        return {
          x: margin.x,
          y: (containerHeight - objectHeight) / 2,
        };

      case Position.MIDDLE_CENTER:
        return {
          x: (containerWidth - objectWidth) / 2,
          y: (containerHeight - objectHeight) / 2,
        };

      case Position.MIDDLE_RIGHT:
        return {
          x: containerWidth - objectWidth - margin.x,
          y: (containerHeight - objectHeight) / 2,
        };

      case Position.BOTTOM_LEFT:
        return {
          x: margin.x,
          y: containerHeight - margin.y - objectHeight,
        };

      case Position.BOTTOM_CENTER:
        return {
          x: (containerWidth - objectWidth) / 2,
          y: containerHeight - margin.y - objectHeight,
        };

      case Position.BOTTOM_RIGHT:
        return {
          x: containerWidth - objectWidth - margin.x,
          y: containerHeight - margin.y - objectHeight,
        };

      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * Calculate position based on ratios
   */
  static calculateRelativePosition(
    relativeX: number, // 0-1
    relativeY: number, // 0-1
    containerSize: Size,
    objectSize: Size
  ): Point {
    return {
      x: (containerSize.width - objectSize.width) * relativeX,
      y: (containerSize.height - objectSize.height) * relativeY,
    };
  }
}
