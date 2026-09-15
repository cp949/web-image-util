/**
 * 리사이즈 레이아웃 계산 로직
 *
 * @description
 * - ResizeConfig API의 레이아웃 계산을 담당한다.
 * - fit 모드별 계산 함수를 제공한다.
 * - Sharp 라이브러리의 계산 방식을 기준으로 구현했다.
 * - 레이아웃만 계산하며 실제 렌더링은 single-renderer의 renderLayout이 담당한다.
 */

import { ImageProcessError } from '../errors.internal';
import type { GeometryPoint, GeometrySize } from '../types/base';
import { isPositionableConfig, type ResizeConfig, type ResizeGravity, type ScaleValue } from '../types/resize-config';
import { productionLog } from '../utils/debug.internal';

// ============================================================================
// 인터페이스
// ============================================================================

/**
 * 리사이즈 계산 결과
 *
 * @description
 * 계산된 최종 레이아웃 정보
 * - imageSize: 배율을 적용해 실제로 그릴 이미지 크기
 * - canvasSize: 최종 canvas 크기
 * - position: canvas 안에 이미지를 그릴 시작 좌표
 */
export interface LayoutResult {
  /** 배율을 적용해 실제로 그릴 이미지 크기 */
  imageSize: GeometrySize;

  /** 최종 canvas 크기 */
  canvasSize: GeometrySize;

  /** canvas 안에 이미지를 그릴 시작 좌표 */
  position: GeometryPoint;
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
 * fit 모드에 맞는 계산 함수를 호출해 최종 레이아웃을 반환한다.
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

  // 2. canvas 크기를 계산한다.
  const canvasSize = calculateCanvasSize(imageSize, config);

  // 3. 중앙 정렬(또는 gravity/focal-point)을 반영한 이미지 위치를 계산한다.
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
 * - clampFit: min/max 범위로 스케일을 자름(종횡비 유지)
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
    case 'clampFit':
      return calculateClampFitSize(originalWidth, originalHeight, config);
    case 'scale':
      return calculateScaleSize(originalWidth, originalHeight, config.scale);
    default:
      throw new Error(`Unknown fit mode: ${(config as any).fit}`);
  }
}

/**
 * fit 모드에 따른 최종 canvas 크기를 계산한다.
 *
 * @param imageSize 계산된 이미지 크기
 * @param config ResizeConfig 설정
 * @returns 최종 canvas 크기
 *
 * @description
 * - cover/contain: 목표 너비·높이가 고정 canvas 크기
 * - fill/maxFit/minFit/clampFit/scale: 계산된 이미지 크기가 가변 canvas 크기
 *   (fill 양축 지정 시 imageSize == target이므로 기존 결과와 동일)
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
 * ```
 */
function calculateCanvasSize(imageSize: GeometrySize, config: ResizeConfig): GeometrySize {
  if (config.fit === 'cover' || config.fit === 'contain') {
    // cover/contain은 목표 크기를 canvas 크기로 쓴다.
    return { width: config.width, height: config.height };
  }

  // fill/maxFit/minFit/clampFit/scale은 이미지 크기를 canvas 크기로 쓴다.
  return { width: imageSize.width, height: imageSize.height };
}

/** gravity 9방향 → (alignX, alignY) 정렬 비율. 0=시작(위/왼쪽), 1=끝(아래/오른쪽), 0.5=중앙 */
const GRAVITY_ALIGNMENT: Record<ResizeGravity, { alignX: number; alignY: number }> = {
  'top-left': { alignX: 0, alignY: 0 },
  'top-center': { alignX: 0.5, alignY: 0 },
  'top-right': { alignX: 1, alignY: 0 },
  'center-left': { alignX: 0, alignY: 0.5 },
  center: { alignX: 0.5, alignY: 0.5 },
  'center-right': { alignX: 1, alignY: 0.5 },
  'bottom-left': { alignX: 0, alignY: 1 },
  'bottom-center': { alignX: 0.5, alignY: 1 },
  'bottom-right': { alignX: 1, alignY: 1 },
};

/** 0~1로 자른다. epsilon 허용 오차를 통과한 focal-point 경계값(-1e-6~0, 1~1+1e-6)을 흡수한다 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * focal-point 한 축을 정렬 비율(alignX 또는 alignY)로 변환한다.
 *
 * source의 focal 지점(0~1)이 배치 영역 중앙에 오도록 하는 이상적인 오프셋을 구하고,
 * 이미지가 배치 영역을 완전히 덮어야 하는 제약(오프셋 범위 [available-imageLength, 0]) 안으로
 * 자른다. available === imageLength(그 축은 자를 필요가 없음)면 어느 정렬이든 결과가
 * 같으므로 0.5를 반환한다.
 */
function resolveFocalAlign(available: number, imageLength: number, focal: number): number {
  const delta = available - imageLength;
  if (delta === 0) {
    return 0.5;
  }
  const clampedFocal = clamp01(focal);
  const idealOffset = available / 2 - clampedFocal * imageLength;
  return clamp01(idealOffset / delta);
}

/**
 * config.position으로부터 (alignX, alignY) 정렬 비율을 구한다.
 *
 * - position 생략: 중앙 정렬(0.5, 0.5) — 기존 동작과 동일
 * - gravity 문자열: GRAVITY_ALIGNMENT 조회
 * - focal-point 객체({x, y}, cover 전용. contain 조합은 validateResizeConfig가 이미 막는다):
 *   resolveFocalAlign으로 축별 계산
 * - fill/maxFit/minFit/clampFit/scale: 타입에 position 필드가 없다. 이 fit들은 canvas 크기가
 *   imageSize와 같아(calculateCanvasSize 참고) delta가 항상 0이므로 정렬 비율이 결과에
 *   영향을 주지 않는다 — 중앙(0.5, 0.5)을 그대로 반환해도 안전하다.
 */
function resolveAlignment(
  imageSize: GeometrySize,
  availableWidth: number,
  availableHeight: number,
  config: ResizeConfig
): { alignX: number; alignY: number } {
  const position = isPositionableConfig(config) ? config.position : undefined;

  if (position === undefined) {
    return { alignX: 0.5, alignY: 0.5 };
  }

  if (typeof position === 'string') {
    const alignment = GRAVITY_ALIGNMENT[position];
    if (!alignment) {
      // validateResizeConfig가 이미 gravity 값을 검증했으므로 정상 경로에서는 도달하지 않는다.
      // 검증을 통과한 뒤 config가 외부에서 변형되는 경우까지 대비한 방어선이다.
      throw new ImageProcessError(`Invalid resize position gravity: ${String(position)}`, 'OPTION_INVALID', {
        details: { option: 'position' },
      });
    }
    return alignment;
  }

  return {
    alignX: resolveFocalAlign(availableWidth, imageSize.width, position.x),
    alignY: resolveFocalAlign(availableHeight, imageSize.height, position.y),
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
 * - cover: position(gravity 9방향 또는 focal-point)에 따라 정렬하며 잘리는 영역 때문에 음수 좌표 가능
 * - contain: position(gravity)에 따라 정렬하며 margin을 분배
 * - fill: (0, 0)에서 시작(position 필드 자체가 없음)
 * - position 생략 시 중앙 정렬(기존 동작과 동일)
 *
 * @example
 * ```typescript
 * // 중앙 정렬(position 생략)
 * calculatePosition({ width: 100, height: 100 }, { width: 200, height: 200 }, config);
 * // → { x: 50, y: 50 }
 *
 * // gravity: top-left
 * calculatePosition({ width: 200, height: 100 }, { width: 100, height: 100 }, { ...config, position: 'top-left' });
 * // → { x: 0, y: 0 }
 * ```
 */
function calculatePosition(imageSize: GeometrySize, canvasSize: GeometrySize, config: ResizeConfig): GeometryPoint {
  // position(gravity 또는 focal-point)에 따른 정렬 비율. 생략 시 중앙(0.5, 0.5) — 기존 동작과 동일하다.
  const { alignX, alignY } = resolveAlignment(imageSize, canvasSize.width, canvasSize.height, config);

  // 여백(또는 초과분)에 정렬 비율을 곱해 위치를 정한다.
  // - cover: 이미지가 더 크면 잘리는 영역 때문에 음수 좌표
  // - contain: 이미지가 더 작으면 여백 때문에 양수 좌표
  // `|| 0`은 -0을 +0으로 정규화한다(예전에는 이제 없는 padding 덧셈이 이 정규화를 부수 효과로 해줬다).
  const x = Math.round((canvasSize.width - imageSize.width) * alignX) || 0;
  const y = Math.round((canvasSize.height - imageSize.height) * alignY) || 0;

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

  // 가늘고 긴 원본을 한 축만 제약하면 다른 축이 반올림으로 0이 될 수 있어 최소 1px을 보장한다.
  return {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
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
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };
}

/**
 * clampFit 크기를 계산한다.
 *
 * @description
 * 종횡비를 유지한 채 스케일을 [min이 요구하는 배율, max가 허용하는 배율] 범위로 자른다
 * (CSS `clamp(min, 1, max)`와 동형 — 기준값은 "확대·축소 없음"을 뜻하는 1).
 * - min 계열만 있으면 minFit과, max 계열만 있으면 maxFit과 동일한 결과가 나온다.
 * - min이 요구하는 배율이 max가 허용하는 배율보다 크면(동시에 만족 불가능) min 쪽을 통째로
 *   무시하고 max 제약만 적용한다. 에러를 던지지 않고 최선의 결과를 만들어 사용자가 원인을
 *   파악하고 고칠 수 있게 한다(설계 결정, 렌더 시점에만 원본 크기를 알 수 있어 여기서만 검사한다).
 */
function calculateClampFitSize(
  originalWidth: number,
  originalHeight: number,
  config: { minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number }
): GeometrySize {
  const { minWidth, minHeight, maxWidth, maxHeight } = config;

  let requiredMinScale = 0;
  if (minWidth) requiredMinScale = Math.max(requiredMinScale, minWidth / originalWidth);
  if (minHeight) requiredMinScale = Math.max(requiredMinScale, minHeight / originalHeight);

  let requiredMaxScale = Number.POSITIVE_INFINITY;
  if (maxWidth) requiredMaxScale = Math.min(requiredMaxScale, maxWidth / originalWidth);
  if (maxHeight) requiredMaxScale = Math.min(requiredMaxScale, maxHeight / originalHeight);

  let scale: number;
  if (requiredMinScale > requiredMaxScale) {
    scale = Math.min(1, requiredMaxScale);
  } else {
    scale = Math.max(requiredMinScale, Math.min(1, requiredMaxScale));
  }

  // 가늘고 긴 원본을 한 축만 제약하면 다른 축이 반올림으로 0이 될 수 있어 최소 1px을 보장한다.
  const result: GeometrySize = {
    width: Math.max(1, Math.round(originalWidth * scale)),
    height: Math.max(1, Math.round(originalHeight * scale)),
  };

  if (requiredMinScale > requiredMaxScale) {
    productionLog.warn(
      `clampSize: 최소/최대 조건이 충돌해 최대 크기 제약만 적용했습니다. ` +
        `(무시됨 — minWidth: ${minWidth ?? '-'}, minHeight: ${minHeight ?? '-'}, ` +
        `적용됨 — maxWidth: ${maxWidth ?? '-'}, maxHeight: ${maxHeight ?? '-'}, ` +
        `원본: ${originalWidth}x${originalHeight}, 최종 결과: ${result.width}x${result.height})`
    );
  }

  return result;
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
