/**
 * ResizeCalculator: 리사이즈 계산 로직 전담 클래스
 *
 * @description
 * - 새로운 ResizeConfig API의 계산 로직을 담당
 * - 각 fit 모드별로 최적화된 계산 메서드 제공
 * - Sharp 라이브러리의 계산 방식을 참고하여 구현
 * - 단일 책임: 레이아웃 계산만 수행, 렌더링은 OnehotRenderer가 담당
 */

import type { ResizeConfig, Padding } from '../types/resize-config';
import type { GeometryPoint, GeometrySize } from '../types/base';

// ============================================================================
// INTERFACES - 인터페이스 정의
// ============================================================================

/**
 * 정규화된 패딩 값
 *
 * @description
 * 모든 패딩 값을 명시적으로 포함하는 객체
 * - top, right, bottom, left 모두 숫자로 명시
 * - 음수가 아닌 값 보장
 */
export interface NormalizedPadding {
  /** 상단 패딩 (픽셀) */
  top: number;
  /** 우측 패딩 (픽셀) */
  right: number;
  /** 하단 패딩 (픽셀) */
  bottom: number;
  /** 좌측 패딩 (픽셀) */
  left: number;
}

/**
 * 리사이즈 계산 결과
 *
 * @description
 * ResizeCalculator가 계산한 최종 레이아웃 정보
 * - imageSize: 실제로 그려질 이미지의 크기 (스케일 적용됨)
 * - canvasSize: 최종 캔버스의 크기 (padding 포함)
 * - position: 캔버스 내에서 이미지를 그릴 시작 좌표
 */
export interface LayoutResult {
  /** 실제로 그려질 이미지의 크기 (스케일 적용) */
  imageSize: GeometrySize;
  /** 최종 캔버스의 크기 (padding 포함) */
  canvasSize: GeometrySize;
  /** 캔버스 내에서 이미지를 그릴 시작 좌표 */
  position: GeometryPoint;
}

// ============================================================================
// UTILITY FUNCTIONS - 유틸리티 함수들
// ============================================================================

/**
 * 패딩을 정규화된 형태로 변환
 *
 * @param padding - 숫자 또는 객체 형태의 패딩
 * @returns 정규화된 패딩 객체
 *
 * @description
 * 다양한 형태의 패딩 입력을 통일된 형태로 변환:
 * - 숫자: 4방향 모두 동일한 값 적용
 * - 객체: 명시된 값만 적용, 나머지는 0
 * - undefined: 모든 방향 0
 *
 * @example
 * ```typescript
 * normalizePadding(20);
 * // → { top: 20, right: 20, bottom: 20, left: 20 }
 *
 * normalizePadding({ top: 10, left: 20 });
 * // → { top: 10, right: 0, bottom: 0, left: 20 }
 *
 * normalizePadding();
 * // → { top: 0, right: 0, bottom: 0, left: 0 }
 * ```
 */
function normalizePadding(padding?: Padding): NormalizedPadding {
  // 패딩이 숫자인 경우: 4방향 모두 동일하게 적용
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };
  }

  // 패딩이 객체인 경우: 명시된 값만 적용, 나머지는 0
  if (typeof padding === 'object' && padding !== null) {
    return {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    };
  }

  // 패딩이 undefined인 경우: 모든 방향 0
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// ============================================================================
// RESIZE CALCULATOR - 메인 클래스
// ============================================================================

/**
 * ResizeCalculator 클래스
 *
 * @description
 * 새로운 ResizeConfig API의 계산 로직을 전담하는 클래스
 *
 * @example
 * ```typescript
 * const calculator = new ResizeCalculator();
 * const layout = calculator.calculateFinalLayout(
 *   1920, 1080,
 *   { fit: 'cover', width: 800, height: 600 }
 * );
 * // layout = {
 * //   imageSize: { width: 1067, height: 600 },
 * //   canvasSize: { width: 800, height: 600 },
 * //   position: { x: -133, y: 0 }
 * // }
 * ```
 */
export class ResizeCalculator {
  /**
   * 최종 레이아웃 계산 (메인 엔트리포인트)
   *
   * @param originalWidth - 원본 이미지의 너비
   * @param originalHeight - 원본 이미지의 높이
   * @param config - ResizeConfig 설정
   * @returns 계산된 레이아웃 정보
   *
   * @description
   * fit 모드에 따라 적절한 계산 메서드를 호출하고,
   * padding을 적용하여 최종 레이아웃을 반환
   */
  calculateFinalLayout(originalWidth: number, originalHeight: number, config: ResizeConfig): LayoutResult {
    // 1. 이미지 크기 계산 (fit 모드에 따라)
    const imageSize = this.calculateImageSize(originalWidth, originalHeight, config);

    // 2. 캔버스 크기 계산 (padding 적용)
    const canvasSize = this.calculateCanvasSize(imageSize, config);

    // 3. 이미지 위치 계산 (중앙 정렬 + padding)
    const position = this.calculatePosition(imageSize, canvasSize, config);

    return {
      imageSize,
      canvasSize,
      position,
    };
  }

  /**
   * 이미지 크기 계산
   *
   * @param originalWidth - 원본 이미지의 너비
   * @param originalHeight - 원본 이미지의 높이
   * @param config - ResizeConfig 설정
   * @returns 스케일이 적용된 이미지 크기
   *
   * @description
   * fit 모드에 따라 이미지가 실제로 그려질 크기를 계산
   * - cover: 캔버스를 가득 채우도록 확대/축소
   * - contain: 캔버스 안에 들어가도록 축소
   * - fill: 캔버스 크기에 정확히 맞춤
   * - maxFit: 축소만 허용
   * - minFit: 확대만 허용
   */
  private calculateImageSize(originalWidth: number, originalHeight: number, config: ResizeConfig): GeometrySize {
    switch (config.fit) {
      case 'cover':
        return this.calculateCoverSize(originalWidth, originalHeight, config);
      case 'contain':
        return this.calculateContainSize(originalWidth, originalHeight, config);
      case 'fill':
        return this.calculateFillSize(originalWidth, originalHeight, config);
      case 'maxFit':
        return this.calculateMaxFitSize(originalWidth, originalHeight, config);
      case 'minFit':
        return this.calculateMinFitSize(originalWidth, originalHeight, config);
      default:
        throw new Error(`Unknown fit mode: ${(config as any).fit}`);
    }
  }

  /**
   * 캔버스 크기 계산
   *
   * @param imageSize - 계산된 이미지 크기
   * @param config - ResizeConfig 설정
   * @returns padding이 적용된 최종 캔버스 크기
   *
   * @description
   * fit 모드에 따라 캔버스 크기를 계산
   * - cover/contain/fill: target width/height가 캔버스 크기 (고정)
   * - maxFit/minFit: 이미지 크기가 캔버스 크기 (가변)
   * - padding이 있으면 추가로 적용
   *
   * @example
   * ```typescript
   * // cover: 캔버스는 target 크기 고정
   * calculateCanvasSize({ width: 1422, height: 800 }, { fit: 'cover', width: 800, height: 800 });
   * // → { width: 800, height: 800 }
   *
   * // maxFit: 이미지 크기가 캔버스 크기
   * calculateCanvasSize({ width: 100, height: 100 }, { fit: 'maxFit', width: 300, height: 200 });
   * // → { width: 100, height: 100 }
   *
   * // 패딩 적용
   * calculateCanvasSize({ width: 800, height: 450 }, { fit: 'contain', width: 800, height: 800, padding: 20 });
   * // → { width: 840, height: 840 }
   * ```
   */
  private calculateCanvasSize(imageSize: GeometrySize, config: ResizeConfig): GeometrySize {
    // 패딩 정규화
    const padding = normalizePadding(config.padding);

    // fit 모드에 따라 기본 캔버스 크기 결정
    let baseWidth: number;
    let baseHeight: number;

    if (config.fit === 'cover' || config.fit === 'contain' || config.fit === 'fill') {
      // cover/contain/fill: target 크기가 캔버스 크기
      baseWidth = config.width;
      baseHeight = config.height;
    } else {
      // maxFit/minFit: 이미지 크기가 캔버스 크기
      baseWidth = imageSize.width;
      baseHeight = imageSize.height;
    }

    // 패딩 적용
    return {
      width: baseWidth + padding.left + padding.right,
      height: baseHeight + padding.top + padding.bottom,
    };
  }

  /**
   * 이미지 위치 계산
   *
   * @param imageSize - 계산된 이미지 크기
   * @param canvasSize - 계산된 캔버스 크기
   * @param config - ResizeConfig 설정
   * @returns 캔버스 내에서 이미지를 그릴 시작 좌표
   *
   * @description
   * 캔버스 내에서 이미지를 그릴 시작 좌표를 계산
   * - cover: 중앙 정렬, 음수 좌표 가능 (잘림)
   * - contain: 중앙 정렬, 여백 생김
   * - fill: (0, 0) 좌표에서 시작
   * - padding 고려
   *
   * @example
   * ```typescript
   * // 패딩 없는 경우 (중앙 정렬)
   * calculatePosition({ width: 100, height: 100 }, { width: 200, height: 200 }, config);
   * // → { x: 50, y: 50 }
   *
   * // 숫자 패딩이 있는 경우
   * calculatePosition({ width: 100, height: 100 }, { width: 140, height: 140 }, { ...config, padding: 20 });
   * // → { x: 20, y: 20 } (패딩 만큼 이동)
   *
   * // 객체 패딩이 있는 경우
   * calculatePosition({ width: 100, height: 100 }, { width: 120, height: 110 }, { ...config, padding: { top: 10, left: 20 } });
   * // → { x: 20, y: 10 } (각 방향의 패딩 만큼 이동)
   * ```
   */
  private calculatePosition(imageSize: GeometrySize, canvasSize: GeometrySize, config: ResizeConfig): GeometryPoint {
    // 패딩 정규화
    const padding = normalizePadding(config.padding);

    // 패딩을 제외한 실제 배치 영역 크기 계산
    const availableWidth = canvasSize.width - padding.left - padding.right;
    const availableHeight = canvasSize.height - padding.top - padding.bottom;

    // 중앙 정렬: 여백을 절반씩 나누어 배치
    // - cover: 이미지가 더 크면 음수 좌표 (잘림)
    // - contain: 이미지가 더 작으면 양수 좌표 (여백)
    const x = padding.left + Math.round((availableWidth - imageSize.width) / 2);
    const y = padding.top + Math.round((availableHeight - imageSize.height) / 2);

    return { x, y };
  }

  // ============================================================================
  // FIT MODE CALCULATIONS - fit 모드별 계산 메서드
  // ============================================================================

  /**
   * Cover fit 크기 계산
   *
   * @description
   * 비율 유지하며 영역을 가득 채우는 로직
   * - 이미지가 캔버스를 완전히 덮도록 스케일링
   * - 초과 부분은 잘림
   * - CSS object-fit: cover와 동일
   */
  private calculateCoverSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // 가로/세로 비율 중 더 큰 것을 선택하여 캔버스를 완전히 덮음
    const scaleX = targetW / originalWidth;
    const scaleY = targetH / originalHeight;
    const scale = Math.max(scaleX, scaleY);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Contain fit 크기 계산
   *
   * @description
   * 비율 유지하며 전체 이미지가 들어가는 로직
   * - 이미지 전체가 캔버스 안에 들어가도록 스케일링
   * - 여백이 생길 수 있음
   * - CSS object-fit: contain과 동일
   */
  private calculateContainSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // 가로/세로 비율 중 더 작은 것을 선택하여 전체가 들어가도록 함
    const scaleX = targetW / originalWidth;
    const scaleY = targetH / originalHeight;
    const scale = Math.min(scaleX, scaleY);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * Fill fit 크기 계산
   *
   * @description
   * 비율 무시하고 정확히 맞추는 로직
   * - 이미지가 늘어나거나 압축될 수 있음
   * - CSS object-fit: fill과 동일
   */
  private calculateFillSize(
    originalWidth: number,
    originalHeight: number,
    config: { width: number; height: number }
  ): GeometrySize {
    const { width: targetW, height: targetH } = config;

    // 타겟 크기를 그대로 반환 (비율 무시)
    return {
      width: targetW,
      height: targetH,
    };
  }

  /**
   * MaxFit 크기 계산
   *
   * @description
   * 최대 크기 제한 로직 (확대 안함)
   * - 작은 이미지는 크기 변경 없음
   * - 큰 이미지는 축소
   * - 비율 유지
   */
  private calculateMaxFitSize(
    originalWidth: number,
    originalHeight: number,
    config: { width?: number; height?: number }
  ): GeometrySize {
    const { width: maxW, height: maxH } = config;

    // 최소 1배 스케일 (확대 안함)
    let scale = 1;

    // 각 차원의 최대값 제한 적용
    if (maxW) scale = Math.min(scale, maxW / originalWidth);
    if (maxH) scale = Math.min(scale, maxH / originalHeight);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }

  /**
   * MinFit 크기 계산
   *
   * @description
   * 최소 크기 보장 로직 (축소 안함)
   * - 작은 이미지는 확대
   * - 큰 이미지는 크기 변경 없음
   * - 비율 유지
   */
  private calculateMinFitSize(
    originalWidth: number,
    originalHeight: number,
    config: { width?: number; height?: number }
  ): GeometrySize {
    const { width: minW, height: minH } = config;

    // 최소 1배 스케일 (축소 안함)
    let scale = 1;

    // 각 차원의 최소값 보장
    if (minW) scale = Math.max(scale, minW / originalWidth);
    if (minH) scale = Math.max(scale, minH / originalHeight);

    return {
      width: Math.round(originalWidth * scale),
      height: Math.round(originalHeight * scale),
    };
  }
}
