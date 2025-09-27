/**
 * 위치 정의 (9-point 시스템)
 *
 * @description 이미지나 텍스트를 배치할 수 있는 9개의 기본 위치와 사용자 정의 위치를 정의합니다.
 * CSS의 position 시스템과 유사하며 워터마크나 텍스트 오버레이에 사용됩니다.
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
 * Position 열거형 상수
 *
 * @description Position 타입의 모든 값들을 상수로 정의한 객체입니다.
 * 타입 안전성을 보장하고 IDE 자동완성을 지원합니다.
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
 * 2D 좌표 정의
 *
 * @description X, Y 좌표를 나타내는 인터페이스입니다.
 * 픽셀 단위의 절대 좌표를 표현하며 위치 계산에 사용됩니다.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * 크기 정의
 *
 * @description 너비와 높이를 나타내는 인터페이스입니다.
 * 픽셀 단위의 크기를 표현하며 요소의 크기 계산에 사용됩니다.
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 사각형 정의
 *
 * @description 좌표와 크기를 포함한 사각형 영역을 나타내는 인터페이스입니다.
 * x, y 좌표와 너비, 높이를 모두 포함하여 완전한 사각형을 정의합니다.
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 위치 계산 유틸리티 클래스
 *
 * @description Position 열거형과 상대적 좌표를 실제 픽셀 좌표로 변환하는 정적 메서드들을 제공합니다.
 * 워터마크, 텍스트 오버레이 등의 위치 계산에 사용됩니다.
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
