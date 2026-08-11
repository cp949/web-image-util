/**
 * composeImages(spec) — 이미지 합성 단일 진입점
 *
 * layers / grid / collage 합성을 discriminated union spec 데이터로 받아
 * 호출자 소유 canvas 하나를 반환한다.
 *
 * 소유권: 결과 canvas는 `createOwnedCanvas`로 생성한 호출자 소유이며
 * CanvasPool을 거치지 않는다. 라이브러리는 반환 후 참조를 보관하지 않는다.
 *
 * 결정성: 동일 spec + 동일 난수 시퀀스(collage의 `random`)는 동일한 픽셀을
 * 만든다. 난수 소비 횟수·순서는 공개 계약이 아니다 — 배치 알고리즘 개선의
 * 자유를 남기기 위해 결정성만 보장한다.
 *
 * 검증: 모든 spec 검증은 canvas 할당 전에 끝나며 실패는 전부
 * `ImageProcessError`다. 오류 경로에서 canvas가 만들어지지 않는다.
 */

import { createOwnedCanvas } from '../base/canvas-utils.internal';
import { ImageProcessError } from '../errors.internal';
import {
  drawImageLayer,
  drawPlacedImage,
  drawShadowedImage,
  fillCanvasBackground,
  withCanvasState,
} from './canvas-drawing.internal';

/** [0, 1) 구간 난수를 반환하는 함수. 각 호출은 독립 표본이어야 한다. */
export type RandomSource = () => number;

/**
 * 합성 레이어 하나. 배열 순서가 z-order다 — 뒤 원소가 위에 그려진다.
 */
export interface ComposeLayer {
  image: HTMLImageElement;
  /** canvas 좌상단 기준 px */
  x: number;
  y: number;
  /** 생략 시 소스 원본 크기. 지정 시 양수 필수 — 0을 원본 크기로 대체하지 않는다 */
  width?: number;
  height?: number;
  /** 0..1, 기본 1. 0은 완전 투명으로 존중된다 */
  opacity?: number;
  /** 기본 'source-over' */
  blendMode?: GlobalCompositeOperation;
  /** 도(degree), 레이어 중심 기준 회전 */
  rotation?: number;
  /** false면 이 레이어는 그리지 않는다. 기본 true */
  visible?: boolean;
}

/** 좌표 지정 레이어 합성 */
export interface ComposeLayersSpec {
  type: 'layers';
  /** 출력 canvas 크기(px). 0 이하·비유한수는 오류 */
  width: number;
  height: number;
  /** CSS 색상. 생략 시 투명 배경 */
  background?: string;
  /** 빈 배열 허용 — 배경만 그린 canvas */
  layers: readonly ComposeLayer[];
}

/**
 * 균일 격자 합성 — 행 우선(row-major) 배치.
 *
 * 행 수는 항상 `ceil(images.length / columns)`로 파생되므로 이미지가
 * 잘리는 조합이 없다. 셀·canvas 크기는 입력에서 파생된다:
 * `cellW = max(이미지 너비)`, `canvasW = columns*cellW + (columns+1)*spacing`
 * (높이 동형).
 */
export interface ComposeGridSpec {
  type: 'grid';
  /** 1개 이상 */
  images: readonly HTMLImageElement[];
  /** 열 수(정수 >= 1). 기본 ceil(sqrt(images.length)) */
  columns?: number;
  /** 셀 간·외곽 공통 여백 px (>= 0). 기본 10 */
  spacing?: number;
  /**
   * 셀 내 이미지 맞춤. 기본 'contain'.
   * 'cover'는 셀 밖으로 넘치는 부분을 셀 영역으로 클리핑한다.
   */
  fit?: 'contain' | 'cover' | 'fill';
  /** 기본 '#ffffff' */
  background?: string;
}

/** 무작위 배치 콜라주 합성 */
export interface ComposeCollageSpec {
  type: 'collage';
  /** 빈 배열 허용 — 배경만 그린 canvas */
  images: readonly HTMLImageElement[];
  /** 출력 canvas 크기(px). 0 이하·비유한수는 오류 */
  width: number;
  height: number;
  /** 기본 '#ffffff' */
  background?: string;
  /**
   * 원본 대비 배치 배율 구간 [min, max]. 0 < min <= max. 기본 [0.15, 0.3].
   * 배율 적용 결과가 canvas보다 크면 canvas 안에 들어가도록 클램프된다.
   */
  scaleRange?: readonly [number, number];
  /** 회전 최대각(도, >= 0). 회전각은 ±maxRotation 균등분포. 0이면 회전 없음. 기본 15 */
  maxRotation?: number;
  /** 기본 true. false면 기배치 영역과 겹치지 않는 위치를 최선 노력으로 재시도한다 */
  allowOverlap?: boolean;
  /**
   * allowOverlap=false일 때 위치 재시도 상한(정수 >= 1). 기본 50.
   * 상한 도달 시 마지막 후보를 채택하고 겹침을 허용한다 — 오류가 아니다.
   */
  maxPlacementAttempts?: number;
  /** [0, 1) 난수원. 기본 Math.random. 테스트에서 시드 PRNG를 주입해 재현한다 */
  random?: RandomSource;
}

export type ComposeSpec = ComposeLayersSpec | ComposeGridSpec | ComposeCollageSpec;

/**
 * spec 하나를 받아 합성 결과 canvas를 반환한다.
 *
 * 반환 canvas는 호출자 소유다 — 라이브러리가 재사용·수정하지 않는다.
 */
export async function composeImages(spec: ComposeSpec): Promise<HTMLCanvasElement> {
  switch (spec.type) {
    case 'layers':
      return composeLayers(spec);
    case 'grid':
      return composeGrid(spec);
    case 'collage':
      return composeCollage(spec);
    default: {
      // TS는 never 소진으로 도달 불가 — JS 호출자의 잘못된 spec 방어
      const invalidType = (spec as { type?: unknown }).type;
      throw new ImageProcessError(`Unknown compose spec type: ${String(invalidType)}`, 'PROCESSING_FAILED');
    }
  }
}

// ============================================================================
// 공통 헬퍼
// ============================================================================

interface PlacedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 소스의 그리기 기준 크기 — HTMLImageElement는 natural, canvas 소스는 width/height */
function sourceSize(image: HTMLImageElement): { width: number; height: number } {
  return {
    width: image.naturalWidth ?? image.width,
    height: image.naturalHeight ?? image.height,
  };
}

function validateCanvasSize(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ImageProcessError(
      `Invalid canvas size: ${width}x${height}. Both dimensions must be > 0.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-canvas-size', width, height } }
    );
  }
}

function requireOption(condition: boolean, option: string, message: string, minimum?: number): void {
  if (!condition) {
    throw new ImageProcessError(message, 'OPTION_INVALID', {
      details: minimum === undefined ? { option } : { option, minimum },
    });
  }
}

// ============================================================================
// layers
// ============================================================================

function composeLayers(spec: ComposeLayersSpec): HTMLCanvasElement {
  validateCanvasSize(spec.width, spec.height);

  // 검증은 visible 여부와 무관하게 전체 레이어에 적용한다
  spec.layers.forEach((layer, index) => {
    if (layer.width !== undefined) {
      requireOption(
        Number.isFinite(layer.width) && layer.width > 0,
        `layers[${index}].width`,
        `layers[${index}].width must be > 0 when specified`
      );
    }
    if (layer.height !== undefined) {
      requireOption(
        Number.isFinite(layer.height) && layer.height > 0,
        `layers[${index}].height`,
        `layers[${index}].height must be > 0 when specified`
      );
    }
    if (layer.opacity !== undefined) {
      requireOption(
        Number.isFinite(layer.opacity) && layer.opacity >= 0 && layer.opacity <= 1,
        `layers[${index}].opacity`,
        `layers[${index}].opacity must be in [0, 1]`
      );
    }
  });

  const { canvas, ctx } = createOwnedCanvas(spec.width, spec.height);
  fillCanvasBackground(ctx, spec.width, spec.height, spec.background);

  for (const layer of spec.layers) {
    // opacity 0 = 완전 투명 — 그리기 자체를 생략한다.
    // (drawImageLayer의 `opacity || 1`이 0을 1로 만드는 경로를 타지 않기 위한 처리이기도 하다)
    if (layer.visible === false || layer.opacity === 0) {
      continue;
    }

    const natural = sourceSize(layer.image);
    drawImageLayer(ctx, {
      image: layer.image,
      x: layer.x,
      y: layer.y,
      width: layer.width ?? natural.width,
      height: layer.height ?? natural.height,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      rotation: layer.rotation,
    });
  }

  return canvas;
}

// ============================================================================
// grid
// ============================================================================

function composeGrid(spec: ComposeGridSpec): HTMLCanvasElement {
  if (spec.images.length === 0) {
    throw new ImageProcessError('No images provided', 'INVALID_SOURCE', {
      details: { label: 'empty-image-list' },
    });
  }
  if (spec.columns !== undefined) {
    requireOption(Number.isInteger(spec.columns) && spec.columns >= 1, 'columns', 'columns must be an integer >= 1', 1);
  }
  if (spec.spacing !== undefined) {
    requireOption(Number.isFinite(spec.spacing) && spec.spacing >= 0, 'spacing', 'spacing must be >= 0', 0);
  }

  const count = spec.images.length;
  const columns = spec.columns ?? Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const spacing = spec.spacing ?? 10;
  const fit = spec.fit ?? 'contain';
  const background = spec.background ?? '#ffffff';

  const sizes = spec.images.map(sourceSize);
  const cellWidth = Math.max(...sizes.map((size) => size.width));
  const cellHeight = Math.max(...sizes.map((size) => size.height));
  const canvasWidth = columns * cellWidth + (columns + 1) * spacing;
  const canvasHeight = rows * cellHeight + (rows + 1) * spacing;
  // 크기 0 소스만 있고 spacing도 0이면 canvas가 축퇴한다 — 파생값도 검증한다
  validateCanvasSize(canvasWidth, canvasHeight);

  const { canvas, ctx } = createOwnedCanvas(canvasWidth, canvasHeight);
  fillCanvasBackground(ctx, canvasWidth, canvasHeight, background);

  for (let i = 0; i < count; i++) {
    const image = spec.images[i];
    const size = sizes[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const cellX = spacing + col * (cellWidth + spacing);
    const cellY = spacing + row * (cellHeight + spacing);

    const fitted = fitToCell(size.width, size.height, cellWidth, cellHeight, fit);
    const placement = {
      x: cellX + fitted.x,
      y: cellY + fitted.y,
      width: fitted.width,
      height: fitted.height,
    };

    if (fit === 'cover') {
      // cover는 셀보다 커질 수 있다 — 셀 영역으로 클리핑해 이웃 셀·spacing 침범을 막는다
      withCanvasState(ctx, () => {
        ctx.beginPath();
        ctx.rect(cellX, cellY, cellWidth, cellHeight);
        ctx.clip();
        drawPlacedImage(ctx, image, placement);
      });
    } else {
      drawPlacedImage(ctx, image, placement);
    }
  }

  return canvas;
}

/** 셀 내 이미지 맞춤 계산 — 셀 좌상단 기준 offset과 그리기 크기 */
function fitToCell(
  imageWidth: number,
  imageHeight: number,
  cellWidth: number,
  cellHeight: number,
  fit: 'contain' | 'cover' | 'fill'
): PlacedRect {
  switch (fit) {
    case 'contain': {
      const scale = Math.min(cellWidth / imageWidth, cellHeight / imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;
      return { x: (cellWidth - width) / 2, y: (cellHeight - height) / 2, width, height };
    }
    case 'cover': {
      const scale = Math.max(cellWidth / imageWidth, cellHeight / imageHeight);
      const width = imageWidth * scale;
      const height = imageHeight * scale;
      return { x: (cellWidth - width) / 2, y: (cellHeight - height) / 2, width, height };
    }
    case 'fill':
      return { x: 0, y: 0, width: cellWidth, height: cellHeight };
  }
}

// ============================================================================
// collage
// ============================================================================

function composeCollage(spec: ComposeCollageSpec): HTMLCanvasElement {
  validateCanvasSize(spec.width, spec.height);
  if (spec.scaleRange !== undefined) {
    const [min, max] = spec.scaleRange;
    requireOption(
      Number.isFinite(min) && Number.isFinite(max) && min > 0 && min <= max,
      'scaleRange',
      'scaleRange must satisfy 0 < min <= max'
    );
  }
  if (spec.maxRotation !== undefined) {
    requireOption(
      Number.isFinite(spec.maxRotation) && spec.maxRotation >= 0,
      'maxRotation',
      'maxRotation must be >= 0',
      0
    );
  }
  if (spec.maxPlacementAttempts !== undefined) {
    requireOption(
      Number.isInteger(spec.maxPlacementAttempts) && spec.maxPlacementAttempts >= 1,
      'maxPlacementAttempts',
      'maxPlacementAttempts must be an integer >= 1',
      1
    );
  }

  const [minScale, maxScale] = spec.scaleRange ?? [0.15, 0.3];
  const maxRotation = spec.maxRotation ?? 15;
  const allowOverlap = spec.allowOverlap ?? true;
  const maxAttempts = spec.maxPlacementAttempts ?? 50;
  const random = spec.random ?? Math.random;
  const background = spec.background ?? '#ffffff';

  const { canvas, ctx } = createOwnedCanvas(spec.width, spec.height);
  fillCanvasBackground(ctx, spec.width, spec.height, background);

  const usedAreas: PlacedRect[] = [];

  for (const image of spec.images) {
    const natural = sourceSize(image);
    const drawnScale = minScale + random() * (maxScale - minScale);
    // 배치가 항상 canvas 안에 들어가도록 클램프 — 음수 좌표를 원천 차단한다
    const scale =
      natural.width > 0 && natural.height > 0
        ? Math.min(drawnScale, spec.width / natural.width, spec.height / natural.height)
        : drawnScale;
    const width = natural.width * scale;
    const height = natural.height * scale;

    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = random() * (spec.width - width);
      y = random() * (spec.height - height);
      attempts++;
    } while (!allowOverlap && attempts < maxAttempts && overlapsAny({ x, y, width, height }, usedAreas));
    // 상한 도달 시 마지막 후보를 겹침 허용으로 채택한다(최선 노력)
    usedAreas.push({ x, y, width, height });

    drawShadowedImage(ctx, image, {
      x,
      y,
      width,
      height,
      rotation: maxRotation > 0 ? (random() - 0.5) * 2 * maxRotation : undefined,
    });
  }

  return canvas;
}

function overlapsAny(rect: PlacedRect, areas: PlacedRect[]): boolean {
  return areas.some(
    (area) =>
      rect.x < area.x + area.width &&
      rect.x + rect.width > area.x &&
      rect.y < area.y + area.height &&
      rect.y + rect.height > area.y
  );
}
