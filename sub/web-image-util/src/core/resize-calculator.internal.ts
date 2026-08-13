/**
 * 리사이즈 레이아웃 계산 로직
 *
 * @description
 * - ResizeConfig API의 레이아웃 계산을 담당한다.
 * - fit 모드별 계산 함수를 제공한다.
 * - Sharp 라이브러리의 계산 방식을 기준으로 구현했다.
 * - 레이아웃만 계산하며 실제 렌더링은 single-renderer의 renderLayout이 담당한다.
 */

import type { GeometryPoint, GeometrySize } from '../types/base';
import type { Padding, ResizeConfig, ScaleValue } from '../types/resize-config';

// ============================================================================
// 인터페이스
// ============================================================================

/**
 * 네 방향 값을 모두 포함하는 정규화된 padding
 *
 * @description
 * - top, right, bottom, left를 모두 숫자로 지정한다.
 * - 음수가 아닌 값을 전제로 한다.
 */
export interface NormalizedPadding {
  /** 위쪽 padding(px) */
  top: number;

  /** 오른쪽 padding(px) */
  right: number;

  /** 아래쪽 padding(px) */
  bottom: number;

  /** 왼쪽 padding(px) */
  left: number;
}

/**
 * 리사이즈 계산 결과
 *
 * @description
 * 계산된 최종 레이아웃 정보
 * - imageSize: 배율을 적용해 실제로 그릴 이미지 크기
 * - canvasSize: padding을 포함한 최종 canvas 크기
 * - position: canvas 안에 이미지를 그릴 시작 좌표
 */
export interface LayoutResult {
  /** 배율을 적용해 실제로 그릴 이미지 크기 */
  imageSize: GeometrySize;

  /** padding을 포함한 최종 canvas 크기 */
  canvasSize: GeometrySize;

  /** canvas 안에 이미지를 그릴 시작 좌표 */
  position: GeometryPoint;
}

// ============================================================================
// 공통 보조 함수
// ============================================================================

/**
 * padding을 네 방향 값으로 정규화한다.
 *
 * @param padding 숫자 또는 객체 형태의 padding
 * @returns 정규화된 padding 객체
 *
 * @description
 * 여러 형태의 padding 입력을 하나의 형식으로 바꾼다.
 * - 숫자: 네 방향에 같은 값 적용
 * - 객체: 지정한 값만 적용하고 나머지는 0
 * - undefined: 네 방향 모두 0
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
  // 숫자는 네 방향에 같은 값으로 적용한다.
  if (typeof padding === 'number') {
    return {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };
  }

  // 객체에서 생략된 방향은 0으로 채운다.
  if (typeof padding === 'object' && padding !== null) {
    return {
      top: padding.top ?? 0,
      right: padding.right ?? 0,
      bottom: padding.bottom ?? 0,
      left: padding.left ?? 0,
    };
  }

  // padding이 없으면 네 방향 모두 0이다.
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// ============================================================================
// 리사이즈 레이아웃 계산 진입점
// ============================================================================

/**
 * 최종 레이아웃을 계산한다.
 *
 * @param originalWidth 원본 이미지 너비
 * @param originalHeight 원본 이미지 높이
 * @param config ResizeConfig 설정
 * @returns 계산된 레이아웃 정보
 *
 * @description
 * fit 모드에 맞는 계산 함수를 호출하고 padding을 적용해 최종 레이아웃을 반환한다.
 *
 * @example
 * ```typescript
 * const layout = calculateFinalLayout(
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
export function calculateFinalLayout(
  originalWidth: number,
  originalHeight: number,
  config: ResizeConfig
): LayoutResult {
  // 1. fit 모드에 따라 이미지 크기를 계산한다.
  const imageSize = calculateImageSize(originalWidth, originalHeight, config);

  // 2. padding을 포함한 canvas 크기를 계산한다.
  const canvasSize = calculateCanvasSize(imageSize, config);

  // 3. 중앙 정렬과 padding을 반영한 이미지 위치를 계산한다.
  const position = calculatePosition(imageSize, canvasSize, config);

  return {
    imageSize,
    canvasSize,
    position,
  };
}

/**
 * fit 모드에 따라 실제로 그릴 이미지 크기를 계산한다.
 *
 * @param originalWidth 원본 이미지 너비
 * @param originalHeight 원본 이미지 높이
 * @param config ResizeConfig 설정
 * @returns 배율을 적용한 이미지 크기
 *
 * @description
 * - cover: canvas를 완전히 채우도록 확대·축소
 * - contain: canvas 안에 전부 들어가도록 확대·축소
 * - fill: canvas 크기에 맞춤(한 축 생략 시 원본 비율로 계산)
 * - maxFit: 축소만 허용
 * - minFit: 확대만 허용
 * - scale: 원본 크기에 배율 적용
 */
function calculateImageSize(originalWidth: number, originalHeight: number, config: ResizeConfig): GeometrySize {
  switch (config.fit) {
    case 'cover':
      return calculateCoverSize(originalWidth, originalHeight, config);
    case 'contain':
      return calculateContainSize(originalWidth, originalHeight, config);
    case 'fill':
      return calculateFillSize(originalWidth, originalHeight, config);
    case 'maxFit':
      return calculateMaxFitSize(originalWidth, originalHeight, config);
    case 'minFit':
      return calculateMinFitSize(originalWidth, originalHeight, config);
    case 'scale':
      return calculateScaleSize(originalWidth, originalHeight, config.scale);
    default:
      throw new Error(`Unknown fit mode: ${(config as any).fit}`);
  }
}

/**
 * fit 모드와 padding을 반영한 최종 canvas 크기를 계산한다.
 *
 * @param imageSize 계산된 이미지 크기
 * @param config ResizeConfig 설정
 * @returns padding을 적용한 최종 canvas 크기
 *
 * @description
 * - cover/contain: 목표 너비·높이가 고정 canvas 크기
 * - fill/maxFit/minFit/scale: 계산된 이미지 크기가 가변 canvas 크기
 *   (fill 양축 지정 시 imageSize == target이므로 기존 결과와 동일)
 * - padding이 있으면 canvas 크기에 추가
 *
 * @example
 * ```typescript
 * // cover: canvas는 목표 크기로 고정
 * calculateCanvasSize({ width: 1422, height: 800 }, { fit: 'cover', width: 800, height: 800 });
 * // → { width: 800, height: 800 }
 *
 * // maxFit: 이미지 크기가 canvas 크기
 * calculateCanvasSize({ width: 100, height: 100 }, { fit: 'maxFit', width: 300, height: 200 });
 * // → { width: 100, height: 100 }
 *
 * // padding 적용
 * calculateCanvasSize({ width: 800, height: 450 }, { fit: 'contain', width: 800, height: 800, padding: 20 });
 * // → { width: 840, height: 840 }
 * ```
 */
function calculateCanvasSize(imageSize: GeometrySize, config: ResizeConfig): GeometrySize {
  // padding을 네 방향 값으로 정규화한다.
  const padding = normalizePadding(config.padding);

  // fit 모드에 따라 padding 전 canvas 크기를 정한다.
  let baseWidth: number;
  let baseHeight: number;

  if (config.fit === 'cover' || config.fit === 'contain') {
    // cover/contain은 목표 크기를 canvas 크기로 쓴다.
    baseWidth = config.width;
    baseHeight = config.height;
  } else {
    // fill/maxFit/minFit/scale은 이미지 크기를 canvas 크기로 쓴다.
    baseWidth = imageSize.width;
    baseHeight = imageSize.height;
  }

  // 네 방향 padding을 canvas 크기에 더한다.
  return {
    width: baseWidth + padding.left + padding.right,
    height: baseHeight + padding.top + padding.bottom,
  };
}

/**
 * canvas 안에서 이미지를 그릴 시작 좌표를 계산한다.
 *
 * @param imageSize 계산된 이미지 크기
 * @param canvasSize 계산된 canvas 크기
 * @param config ResizeConfig 설정
 * @returns canvas 안에서 이미지를 그릴 시작 좌표
 *
 * @description
 * - cover: 중앙 정렬하며 잘리는 영역 때문에 음수 좌표 가능
 * - contain: 중앙 정렬하며 여백 생성
 * - fill: (0, 0)에서 시작
 * - padding 반영
 *
 * @example
 * ```typescript
 * // padding 없이 중앙 정렬
 * calculatePosition({ width: 100, height: 100 }, { width: 200, height: 200 }, config);
 * // → { x: 50, y: 50 }
 *
 * // 숫자 padding
 * calculatePosition({ width: 100, height: 100 }, { width: 140, height: 140 }, { ...config, padding: 20 });
 * // → { x: 20, y: 20 } (padding만큼 이동)
 *
 * // 객체 padding
 * calculatePosition({ width: 100, height: 100 }, { width: 120, height: 110 }, { ...config, padding: { top: 10, left: 20 } });
 * // → { x: 20, y: 10 } (방향별 padding만큼 이동)
 * ```
 */
function calculatePosition(imageSize: GeometrySize, canvasSize: GeometrySize, config: ResizeConfig): GeometryPoint {
  // padding을 네 방향 값으로 정규화한다.
  const padding = normalizePadding(config.padding);

  // padding을 제외한 실제 배치 영역 크기를 계산한다.
  const availableWidth = canvasSize.width - padding.left - padding.right;
  const availableHeight = canvasSize.height - padding.top - padding.bottom;

  // 여백을 절반으로 나눠 중앙에 배치한다.
  // - cover: 이미지가 더 크면 잘리는 영역 때문에 음수 좌표
  // - contain: 이미지가 더 작으면 여백 때문에 양수 좌표
  const x = padding.left + Math.round((availableWidth - imageSize.width) / 2);
  const y = padding.top + Math.round((availableHeight - imageSize.height) / 2);

  return { x, y };
}

// ============================================================================
// fit 모드별 계산 함수
// ============================================================================

/**
 * cover 크기를 계산한다.
 *
 * @description
 * 종횡비를 유지하면서 canvas를 완전히 채우고 초과 영역은 자른다.
 * CSS object-fit: cover와 같은 방식이다.
 */
function calculateCoverSize(
  originalWidth: number,
  originalHeight: number,
  config: { width: number; height: number }
): GeometrySize {
  const { width: targetW, height: targetH } = config;

  // canvas를 완전히 덮도록 가로·세로 배율 중 큰 값을 선택한다.
  const scaleX = targetW / originalWidth;
  const scaleY = targetH / originalHeight;
  const scale = Math.max(scaleX, scaleY);

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * contain 크기를 계산한다.
 *
 * @description
 * 종횡비를 유지하면서 이미지 전체가 canvas 안에 들어가도록 계산한다.
 * 여백이 생길 수 있으며 CSS object-fit: contain과 같은 방식이다.
 */
function calculateContainSize(
  originalWidth: number,
  originalHeight: number,
  config: { width: number; height: number; withoutEnlargement?: boolean }
): GeometrySize {
  const { width: targetW, height: targetH } = config;

  // 이미지 전체가 들어가도록 가로·세로 배율 중 작은 값을 선택한다.
  const scaleX = targetW / originalWidth;
  const scaleY = targetH / originalHeight;
  const scale = config.withoutEnlargement ? Math.min(scaleX, scaleY, 1) : Math.min(scaleX, scaleY);

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * fill 크기를 계산한다.
 *
 * @description
 * 종횡비를 무시하고 목표 크기에 정확히 맞춰 늘이거나 줄인다.
 * CSS object-fit: fill과 같은 방식이다.
 * - 한 축만 지정하면 나머지 축은 원본 비율로 계산한다 (종횡비 유지)
 */
function calculateFillSize(
  originalWidth: number,
  originalHeight: number,
  config: { width?: number; height?: number }
): GeometrySize {
  const { width: targetW, height: targetH } = config;

  // 양축이 있으면 종횡비를 무시하고 목표 크기를 그대로 반환한다.
  if (targetW != null && targetH != null) {
    return { width: targetW, height: targetH };
  }

  // 단일 축 지정: 나머지 축은 원본 비율로 계산 (validateResizeConfig가 최소 1축을 보장)
  if (targetW != null) {
    return { width: targetW, height: Math.round(targetW * (originalHeight / originalWidth)) };
  }
  return { width: Math.round((targetH as number) * (originalWidth / originalHeight)), height: targetH as number };
}

/**
 * maxFit 크기를 계산한다.
 *
 * @description
 * 종횡비를 유지하고 확대하지 않으면서 최대 크기를 제한한다.
 */
function calculateMaxFitSize(
  originalWidth: number,
  originalHeight: number,
  config: { width?: number; height?: number }
): GeometrySize {
  const { width: maxW, height: maxH } = config;

  // 1배를 상한으로 두어 확대하지 않는다.
  let scale = 1;

  // 각 축의 최대 크기 제약을 적용한다.
  if (maxW) scale = Math.min(scale, maxW / originalWidth);
  if (maxH) scale = Math.min(scale, maxH / originalHeight);

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * minFit 크기를 계산한다.
 *
 * @description
 * 종횡비를 유지하고 축소하지 않으면서 최소 크기를 보장한다.
 */
function calculateMinFitSize(
  originalWidth: number,
  originalHeight: number,
  config: { width?: number; height?: number }
): GeometrySize {
  const { width: minW, height: minH } = config;

  // 1배를 하한으로 두어 축소하지 않는다.
  let scale = 1;

  // 각 축의 최소 크기를 보장한다.
  if (minW) scale = Math.max(scale, minW / originalWidth);
  if (minH) scale = Math.max(scale, minH / originalHeight);

  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * scale 크기를 계산한다.
 *
 * @description
 * 원본 크기에 배율을 적용한다
 * - 균일 배율(number): 두 축에 같은 배율
 * - 축별 배율({ sx }, { sy }, { sx, sy }): 생략한 축은 1로 처리 (원본 유지)
 */
function calculateScaleSize(originalWidth: number, originalHeight: number, scale: ScaleValue): GeometrySize {
  if (typeof scale === 'number') {
    return {
      width: Math.max(1, Math.round(originalWidth * scale)),
      height: Math.max(1, Math.round(originalHeight * scale)),
    };
  }

  const sx = 'sx' in scale ? scale.sx : 1;
  const sy = 'sy' in scale ? scale.sy : 1;

  return {
    width: Math.max(1, Math.round(originalWidth * sx)),
    height: Math.max(1, Math.round(originalHeight * sy)),
  };
}
