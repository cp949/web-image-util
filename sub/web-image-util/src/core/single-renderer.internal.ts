/**
 * 단일 렌더러 — 분석기 하나(analyzeAllOperations), 렌더러 하나(renderLayout)
 *
 * 핵심 개념: "계산 먼저, 렌더링 한 번"
 * - analyzeAllOperations: 모든 연산(transform, resize, blur, box)을 분석해 최종 레이아웃 계산
 * - renderLayout: 계산된 레이아웃을 검증하고 단 한 번의 drawImage 로 렌더링
 * - 중간 Canvas 를 만들지 않고 최종 결과만 생성한다
 */

import { type CanvasLease, leaseCanvas } from '../base/canvas-lease.internal';
import { assertOutputPixelBudget, warnIfCanvasAreaExceedsSafeLimit } from '../base/size-budget.internal';
import { withCanvasState } from '../composition/canvas-drawing.internal';
import { type BlurOptions, ImageProcessError } from '../types';
import type { NormalizedBox } from '../types/box-config';
import type { ResizeConfig } from '../types/resize-config';
import type { NormalizedTransform } from '../types/transform-config';
import { debugLog } from '../utils/debug.internal';
import { type BoxGeometry, computeBoxGeometry } from './box-calculator.internal';
import { calculateFinalLayout } from './resize-calculator.internal';
import { computeTransformGeometry, type TransformGeometry } from './transform-calculator.internal';

/**
 * Operation definition for lazy execution
 *
 * 지연 렌더링 스택의 공유 타입 정의 지점 — 부모(LazyRenderPipeline)가 연산을
 * 누적할 때, 이 파일의 분석기·렌더러가 소비할 때 함께 사용한다.
 */
export type LazyOperation =
  | { type: 'resize'; config: ResizeConfig }
  | { type: 'blur'; options: BlurOptions }
  | { type: 'transform'; transform: NormalizedTransform }
  | { type: 'box'; box: NormalizedBox };

type TransformOperation = Extract<LazyOperation, { type: 'transform' }>;
type BoxOperation = Extract<LazyOperation, { type: 'box' }>;

/**
 * Final layout information - Result of analyzing all operations
 *
 * transform이 있으면 position/imageSize는 "transform 프레임"이 캔버스에서 차지하는 사각형이다.
 * 없으면 종전과 같이 원본 이미지가 차지하는 사각형이다.
 */
export interface FinalLayout {
  width: number;
  height: number;
  position: { x: number; y: number };
  imageSize: { width: number; height: number };
  background: string;
  filters: string[];
  /** transform() 결과. 없으면 원본을 그대로 그린다 */
  transform?: TransformGeometry;
  /** box() 결과. 없으면 이 단계에서 크기·위치를 바꾸지 않는다 */
  box?: BoxGeometry;
}

/**
 * 모든 연산을 분석해 최종 레이아웃을 계산한다.
 *
 * transform은 배열 위치와 무관하게 가장 먼저 해석한다(crop → flip → rotate → resize 고정 순서).
 * resize가 보는 "원본 크기"는 transform 프레임 크기다. box는 배열 위치와 무관하게 가장 나중에
 * 해석한다 — resize/blur 루프가 끝나 "content 크기"(transform·resize 결과, 둘 다 없으면 원본)가
 * 확정된 뒤에야 바깥 상자 크기를 계산할 수 있기 때문이다. transform·box는 각각 최대 1개이며
 * addTransform·addBox가 보장한다.
 */
export function analyzeAllOperations(sourceImage: HTMLImageElement, operations: LazyOperation[]): FinalLayout {
  const sourceWidth = sourceImage.naturalWidth;
  const sourceHeight = sourceImage.naturalHeight;

  const transformOperation = operations.find((op): op is TransformOperation => op.type === 'transform');
  const transform: TransformGeometry | undefined = transformOperation
    ? computeTransformGeometry(sourceWidth, sourceHeight, transformOperation.transform)
    : undefined;

  // resize·기본 레이아웃의 기준 크기 — transform이 있으면 프레임, 없으면 원본
  const baseWidth = transform ? transform.frameSize.width : sourceWidth;
  const baseHeight = transform ? transform.frameSize.height : sourceHeight;

  let layout: FinalLayout = {
    width: baseWidth,
    height: baseHeight,
    position: { x: 0, y: 0 },
    imageSize: { width: baseWidth, height: baseHeight },
    background: 'transparent',
    filters: [],
    transform,
  };

  for (const operation of operations) {
    switch (operation.type) {
      case 'resize':
        layout = analyzeResizeOperation(baseWidth, baseHeight, layout, operation.config);
        break;
      case 'blur':
        analyzeBlurOperation(layout, operation.options);
        break;
      case 'transform':
        // 위에서 이미 해석했다
        break;
      case 'box':
        // content 크기가 필요하므로 루프 뒤에서 해석한다
        break;
    }
  }

  const boxOperation = operations.find((op): op is BoxOperation => op.type === 'box');
  if (boxOperation) {
    layout = applyBoxOperation(layout, boxOperation.box);
  }

  return layout;
}

/**
 * content(현재까지 계산된 layout) 크기를 기준으로 box 기하를 계산하고, 캔버스 크기·위치를
 * 바깥 상자 기준으로 다시 쓴다. background는 box가 소유한다. imageSize는 그대로 둔다 —
 * 이미지 자체 크기는 바뀌지 않고 위치만 밀린다.
 */
function applyBoxOperation(layout: FinalLayout, box: NormalizedBox): FinalLayout {
  const geometry = computeBoxGeometry(layout.width, layout.height, box);

  return {
    width: geometry.outerSize.width,
    height: geometry.outerSize.height,
    position: {
      x: layout.position.x + geometry.contentOrigin.x,
      y: layout.position.y + geometry.contentOrigin.y,
    },
    imageSize: layout.imageSize,
    background: geometry.background,
    filters: layout.filters,
    transform: layout.transform,
    box: geometry,
  };
}

/**
 * calculateFinalLayout으로 resize 연산의 레이아웃을 분석한다.
 *
 * @param baseWidth resize가 원본으로 보는 너비(transform 프레임 또는 naturalWidth)
 * @param baseHeight resize가 원본으로 보는 높이
 */
function analyzeResizeOperation(
  baseWidth: number,
  baseHeight: number,
  layout: FinalLayout,
  config: ResizeConfig
): FinalLayout {
  const result = calculateFinalLayout(baseWidth, baseHeight, config);

  return {
    width: result.canvasSize.width,
    height: result.canvasSize.height,
    position: { x: result.position.x, y: result.position.y },
    imageSize: { width: result.imageSize.width, height: result.imageSize.height },
    background: layout.background,
    filters: layout.filters,
    transform: layout.transform,
  };
}

/**
 * Analyze blur operation
 */
function analyzeBlurOperation(layout: FinalLayout, options: BlurOptions): void {
  const radius = options.radius ?? 2;
  layout.filters.push(`blur(${radius}px)`);
}

/**
 * 🚀 핵심 함수: 계산된 레이아웃을 단 한 번의 drawImage 로 렌더링한다.
 *
 * - 레이아웃 검증(크기·좌표) 후 pool 에서 canvas 를 획득한다.
 * - 배경을 먼저 그린 뒤 모든 필터를 한꺼번에 적용한다.
 * - drawImage 한 번으로 모든 처리를 완료한다 — SVG 품질 보존의 핵심.
 *
 * **Canvas 소유권 규칙 (중요)**
 * - 반환되는 canvas는 {@link leaseCanvas}로 pool에서 임대한다({@link CanvasLease}).
 * - 렌더링 중 오류가 나면 lease가 canvas를 pool로 반환한다.
 *
 * @param layout {@link analyzeAllOperations}가 계산한 최종 레이아웃
 * @param maxOutputPixels 출력 Canvas의 최대 허용 픽셀 수(opt-in). 지정 시 초과하면 PIXEL_BUDGET_EXCEEDED로 거부한다.
 */
export function renderLayout(
  sourceImage: HTMLImageElement,
  layout: FinalLayout,
  maxOutputPixels?: number
): CanvasLease {
  // 1. 레이아웃 검증 — pool 획득 전에 잘못된 값을 걸러낸다
  validateLayout(layout, maxOutputPixels);

  // 2. 최종 Canvas 생성 — pool에서 임대
  const lease = leaseCanvas(Math.round(layout.width), Math.round(layout.height));
  const canvas = lease.canvas;

  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ImageProcessError('Cannot create Canvas 2D context', 'CANVAS_CONTEXT_ERROR');
    }

    // 3. 고품질 스무딩 고정 — 코어 출력 경로는 품질 선택지를 노출하지 않는다
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 4. 배경 채우기 — box가 있으면 바깥 상자 반지름을 따라 둥근 경로로 채운다.
    //    box가 없으면 기존 5인자 fillRect 경로를 그대로 쓴다(회귀 없음).
    if (layout.background && layout.background !== 'transparent') {
      ctx.fillStyle = layout.background;
      if (layout.box) {
        traceRoundedRectPath(ctx, { x: 0, y: 0, width: canvas.width, height: canvas.height }, layout.box.outerRadii);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    // 5. 🎯 drawImage 한 번으로 모든 처리 완료 (필터도 이 시점에 함께 적용)
    // 극단 종횡비에서 imageSize 가 0 으로 반올림되면 그릴 픽셀이 없다 —
    // drawImage 를 건너뛰고 배경만 채운 canvas 를 반환한다.
    const drawWidth = Math.round(layout.imageSize.width);
    const drawHeight = Math.round(layout.imageSize.height);
    if (drawWidth > 0 && drawHeight > 0) {
      const drawX = Math.round(layout.position.x);
      const drawY = Math.round(layout.position.y);

      const drawContent = (): void => {
        if (layout.filters.length > 0) {
          ctx.filter = layout.filters.join(' ');
        }
        if (layout.transform) {
          drawTransformedImage(ctx, sourceImage, layout.transform, {
            x: drawX,
            y: drawY,
            width: drawWidth,
            height: drawHeight,
          });
        } else {
          ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);
        }
        ctx.filter = 'none';
      };

      const box = layout.box;
      if (box?.needsPaddingBoxClip) {
        withCanvasState(ctx, () => {
          traceRoundedRectPath(ctx, box.paddingBoxRect, box.paddingBoxRadii);
          ctx.clip();
          drawContent();
        });
      } else {
        drawContent();
      }
    }

    // 6. border — content 위, clip 밖에서 그린다(clip 안에서 그리면 border 자체가 잘린다).
    //    strokeRect가 퇴화(폭·높이 <= 0)하면 자기 반전된 경로가 되므로 아예 그리지 않는다
    //    (예: inset border의 width가 바깥 상자 절반보다 큰 경우).
    if (
      layout.box?.border &&
      layout.box.border.width > 0 &&
      layout.box.border.strokeRect.width > 0 &&
      layout.box.border.strokeRect.height > 0
    ) {
      const { border } = layout.box;
      ctx.lineWidth = border.width;
      ctx.strokeStyle = border.color;
      traceRoundedRectPath(ctx, border.strokeRect, border.strokeRadii);
      ctx.stroke();
    }

    return lease;
  } catch (error) {
    lease.release();
    throw error;
  }
}

/**
 * transform 프레임을 캔버스의 frame 사각형에 맞춰 drawImage 1회로 그린다.
 *
 * 행렬은 코드 순서의 역순으로 소스 픽셀에 적용된다:
 *   crop 원점 이동 → flip → rotate → resize 배율 → 프레임 중심 이동
 * 즉 crop 결과의 중심이 프레임 중심에 놓이고, 그 중심을 기준으로 회전·반전된 뒤 resize 배율이 곱해진다.
 * 상태 변경(clip·변환)은 withCanvasState가 되돌리므로 pool 재사용에 영향이 없다.
 *
 * @param frame transform 프레임이 캔버스에서 차지하는 사각형(= resize 레이아웃의 position/imageSize)
 */
function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  transform: TransformGeometry,
  frame: { x: number; y: number; width: number; height: number }
): void {
  // resize 배율 — fill 모드는 축별로 다를 수 있다
  const scaleX = frame.width / transform.frameSize.width;
  const scaleY = frame.height / transform.frameSize.height;

  withCanvasState(ctx, () => {
    if (transform.needsFrameClip) {
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.width, frame.height);
      ctx.clip();
    }

    ctx.translate(frame.x + frame.width / 2, frame.y + frame.height / 2);
    ctx.scale(scaleX, scaleY);
    if (transform.radians !== 0) {
      ctx.rotate(transform.radians);
    }
    if (transform.flipX || transform.flipY) {
      ctx.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
    }
    ctx.translate(-transform.cropSize.width / 2, -transform.cropSize.height / 2);

    const { sourceRect, destRect } = transform;
    ctx.drawImage(
      sourceImage,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      destRect.x,
      destRect.y,
      destRect.width,
      destRect.height
    );
  });
}

/**
 * 사각형(rect, radii)으로 둥근 모서리 경로를 ctx에 구성한다.
 *
 * TL 모서리 뒤 지점에서 시작해 시계 방향(TR → BR → BL → TL)으로 돈다.
 * radii의 각 모서리가 (0, 0)이면 그 모서리에서는 ellipse 호출을 건너뛰어
 * lineTo만으로 각진 모서리가 자연스럽게 만들어진다 — radius 전부 0이면
 * 결과는 평범한 사각형 경로와 같다(배경·clip·border 전부 이 하나의 함수로 처리 가능한 이유).
 *
 * Chrome 75 하한: ctx.roundRect()(Chrome 99+)는 쓰지 않는다. ctx.ellipse()(Chrome 48+)로
 * 모서리마다 90도 호를 직접 구성한다.
 */
function traceRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  radii: BoxGeometry['outerRadii']
): void {
  const [tl, tr, br, bl] = radii;
  const { x, y, width, height } = rect;

  ctx.beginPath();
  ctx.moveTo(x + tl.rx, y);
  ctx.lineTo(x + width - tr.rx, y);
  if (tr.rx > 0 && tr.ry > 0) {
    ctx.ellipse(x + width - tr.rx, y + tr.ry, tr.rx, tr.ry, 0, -Math.PI / 2, 0);
  }
  ctx.lineTo(x + width, y + height - br.ry);
  if (br.rx > 0 && br.ry > 0) {
    ctx.ellipse(x + width - br.rx, y + height - br.ry, br.rx, br.ry, 0, 0, Math.PI / 2);
  }
  ctx.lineTo(x + bl.rx, y + height);
  if (bl.rx > 0 && bl.ry > 0) {
    ctx.ellipse(x + bl.rx, y + height - bl.ry, bl.rx, bl.ry, 0, Math.PI / 2, Math.PI);
  }
  ctx.lineTo(x, y + tl.ry);
  if (tl.rx > 0 && tl.ry > 0) {
    ctx.ellipse(x + tl.rx, y + tl.ry, tl.rx, tl.ry, 0, Math.PI, Math.PI * 1.5);
  }
  ctx.closePath();
}

/**
 * 레이아웃 검증 — 잘못된 값이면 렌더링 전에 ImageProcessError 를 던진다.
 *
 * - canvas 크기는 유한수이고 반올림 후에도 양수여야 한다 (실제 acquire 에는 반올림 값이 쓰인다)
 * - imageSize 는 음수·비유한수만 오류다. 반올림 0 은 극단 종횡비 입력에서
 *   calculator 가 산출할 수 있는 유효한 축퇴 케이스로, renderLayout 이 drawImage 를 건너뛴다.
 * - 좌표는 유한수여야 한다
 * - maxOutputPixels가 지정되면(opt-in) 면적 초과 시 PIXEL_BUDGET_EXCEEDED로 거부한다
 * - maxOutputPixels 미지정 시, 초대형 canvas 는 오류 대신 경고만 남긴다 (기기별 메모리 부족 가능성 안내)
 */
function validateLayout(layout: FinalLayout, maxOutputPixels?: number): void {
  const { width, height, imageSize, position } = layout;

  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.round(width) <= 0 || Math.round(height) <= 0) {
    throw new ImageProcessError(
      `Invalid canvas size: ${width}x${height}. Both dimensions must round to > 0.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-canvas-size', width, height } }
    );
  }

  if (
    !Number.isFinite(imageSize.width) ||
    !Number.isFinite(imageSize.height) ||
    imageSize.width < 0 ||
    imageSize.height < 0
  ) {
    throw new ImageProcessError(
      `Invalid image size: ${imageSize.width}x${imageSize.height}. Both dimensions must be finite and >= 0.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-image-size', width: imageSize.width, height: imageSize.height } }
    );
  }

  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
    throw new ImageProcessError(
      `Invalid position: (${position.x}, ${position.y}). Must be finite numbers.`,
      'INVALID_DIMENSIONS',
      { details: { kind: 'invalid-position', x: position.x, y: position.y } }
    );
  }

  // opt-in 상한 — 지정한 호출자에게만 하드 거부를 적용한다.
  assertOutputPixelBudget(width, height, maxOutputPixels);

  // 상한 값은 browser-capabilities/canvas-limits.internal.ts가 단일 소유한다(compose.ts의
  // DIMENSION_TOO_LARGE 게이트, high-res-detector.internal.ts의 getMaxSafeDimension()과 같은 값).
  // 면적 = 한 변 상한의 제곱을 메모리 위험 사전 경고 임계값으로 쓴다(RGBA 기준, 일부 기기에서 메모리 부족 가능).
  warnIfCanvasAreaExceedsSafeLimit(width, height);
}

/**
 * For debugging: Output layout information
 */
export function debugLayout(layout: FinalLayout, operationCount: number): void {
  debugLog.log('🎯 Single rendering layout:', {
    canvasSize: `${layout.width}x${layout.height}`,
    imagePosition: `(${layout.position.x}, ${layout.position.y})`,
    imageSize: `${layout.imageSize.width}x${layout.imageSize.height}`,
    background: layout.background,
    filters: layout.filters,
    transform: layout.transform
      ? {
          frameSize: `${layout.transform.frameSize.width}x${layout.transform.frameSize.height}`,
          degrees: (layout.transform.radians * 180) / Math.PI,
          flip: `${layout.transform.flipX ? 'x' : ''}${layout.transform.flipY ? 'y' : ''}` || 'none',
          clip: layout.transform.needsFrameClip,
        }
      : undefined,
    box: layout.box
      ? {
          outerSize: `${layout.box.outerSize.width}x${layout.box.outerSize.height}`,
          hasBackground: layout.box.background !== 'transparent',
          // renderLayout이 실제로 stroke를 그리는 조건(strokeRect가 퇴화하지 않음)과 맞춘다 —
          // inset border의 width가 바깥 상자 절반보다 크면 border.width > 0이어도 그려지지 않는다.
          hasBorder:
            layout.box.border !== null &&
            layout.box.border.width > 0 &&
            layout.box.border.strokeRect.width > 0 &&
            layout.box.border.strokeRect.height > 0,
          needsPaddingBoxClip: layout.box.needsPaddingBoxClip,
        }
      : undefined,
    operationCount,
    renderingApproach: 'single-pass',
    timestamp: Date.now(),
  });
}
