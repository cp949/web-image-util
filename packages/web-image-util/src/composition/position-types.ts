/**
 * 위치 정의 (9-point 시스템)
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
 * 좌표 정의
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 크기 정의
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 사각형 정의
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 위치 계산 유틸리티
 */
export class PositionCalculator {
  /**
   * Position enum을 실제 좌표로 변환
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
          y: containerHeight - objectHeight - margin.y,
        };

      case Position.BOTTOM_CENTER:
        return {
          x: (containerWidth - objectWidth) / 2,
          y: containerHeight - objectHeight - margin.y,
        };

      case Position.BOTTOM_RIGHT:
        return {
          x: containerWidth - objectWidth - margin.x,
          y: containerHeight - objectHeight - margin.y,
        };

      default:
        return { x: 0, y: 0 };
    }
  }

  /**
   * 비율 기반 위치 계산
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
