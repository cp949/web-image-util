/**
 * 입력/출력 이미지 크기의 안전 상한을 검사하는 단일 정책 소유 모듈이다.
 *
 * @description
 * - 축 길이(변) 상한: `readMaxSafeCanvasDimension()`이 보고하는 브라우저별 물리적 한도.
 *   `compose.ts`(하드 거부)와 `single-renderer.internal.ts`(경고만)가 각자 기존 동작을
 *   유지한 채 이 모듈의 함수를 호출한다 — 두 경로의 정책 차이 자체는 통일하지 않는다.
 * - 픽셀 수(면적) 상한: `maxInputPixels`/`maxOutputPixels`(`ProcessorOptions`, opt-in,
 *   기본 무제한). 지정하지 않으면 어떤 검사도 하지 않는다 — 기존 동작에 영향이 없다.
 * - `maxSourceBytes`(바이트 한도, `source-converter/url/fetch-guards.internal.ts`)는
 *   원격 fetch 스트림에 얽힌 보안 코드라 이 모듈이 흡수하지 않는다.
 */

import { ImageProcessError } from '../errors.internal';
import type { ImageSource } from '../types';
import { readMaxSafeCanvasDimension } from '../utils/browser-capabilities/index';
import { productionLog } from '../utils/debug.internal';
import { readBlobAsArrayBuffer } from '../utils/source-utils/blob-io.internal';
import { parseRasterHeaderDimensions } from '../utils/source-utils/raster-header-dimensions.internal';

/** PNG/GIF/BMP 헤더 사전 검사에 필요한 최대 바이트 수(BMP가 가장 커서 26 필요, 여유를 둔다) */
const HEADER_PRECHECK_BYTE_LENGTH = 32;

/** `maxInputPixels`/`maxOutputPixels` 값 형식을 검사한다 — "무제한"은 필드 생략(undefined)만으로 표현한다 */
function validatePixelBudgetOption(value: number, option: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ImageProcessError(`${option} must be a finite positive number (got ${value})`, 'OPTION_INVALID', {
      details: { option },
    });
  }
}

/** direction/stage를 붙여 PIXEL_BUDGET_EXCEEDED를 던진다. 한도 이하면 아무 일도 하지 않는다 */
function assertPixelBudget(
  direction: 'input' | 'output',
  actualPixels: number,
  maxPixels: number,
  stage?: 'header' | 'decoded'
): void {
  if (actualPixels <= maxPixels) {
    return;
  }
  throw new ImageProcessError(
    `${direction} pixel budget exceeded: ${actualPixels} > ${maxPixels}`,
    'PIXEL_BUDGET_EXCEEDED',
    { details: { direction, actualPixels, maxPixels, ...(stage ? { stage } : {}) } }
  );
}

/**
 * 축 길이(변)가 브라우저 안전 상한을 넘으면 `DIMENSION_TOO_LARGE`로 거부한다.
 * `compose.ts` 전용 — 기존 동작을 그대로 옮긴 것으로, 새 옵션에 좌우되지 않는다.
 */
export function assertAxisWithinSafeLimit(width: number, height: number): void {
  const maxSafeDimension = readMaxSafeCanvasDimension();
  if (width > maxSafeDimension || height > maxSafeDimension) {
    throw new ImageProcessError(
      `Canvas size ${width}x${height} exceeds the ${maxSafeDimension}px per-side browser limit.`,
      'DIMENSION_TOO_LARGE'
    );
  }
}

/**
 * 면적이 브라우저 안전 상한의 제곱을 넘으면 경고만 남긴다(오류 아님).
 * `single-renderer.internal.ts` 전용 — 기존 동작을 그대로 옮긴 것으로, 새 옵션에 좌우되지 않는다.
 */
export function warnIfCanvasAreaExceedsSafeLimit(width: number, height: number): void {
  const maxSafeDimension = readMaxSafeCanvasDimension();
  const maxCanvasArea = maxSafeDimension * maxSafeDimension;
  if (width * height > maxCanvasArea) {
    productionLog.warn(
      `Warning: Large canvas size (${width}x${height}). This may cause memory issues on some devices.`
    );
  }
}

/**
 * 최종 출력 Canvas의 픽셀 수를 검사한다. `maxOutputPixels` 생략 시 아무 일도 하지 않는다.
 * `single-renderer.internal.ts`의 `validateLayout`이 Canvas pool 획득 전에 호출한다.
 */
export function assertOutputPixelBudget(width: number, height: number, maxOutputPixels: number | undefined): void {
  if (maxOutputPixels === undefined) {
    return;
  }
  validatePixelBudgetOption(maxOutputPixels, 'maxOutputPixels');
  assertPixelBudget('output', width * height, maxOutputPixels);
}

/**
 * 디코드된 입력 이미지의 픽셀 수를 검사한다. `maxInputPixels` 생략 시 아무 일도 하지 않는다.
 * `convertToImageElement()`가 소스 타입 무관하게 호출한다(SVG 포함, 별도 분기 없음).
 */
export function assertInputPixelBudget(element: HTMLImageElement, maxInputPixels: number | undefined): void {
  if (maxInputPixels === undefined) {
    return;
  }
  validatePixelBudgetOption(maxInputPixels, 'maxInputPixels');
  const width = element.naturalWidth || element.width;
  const height = element.naturalHeight || element.height;
  assertPixelBudget('input', width * height, maxInputPixels, 'decoded');
}

/** Blob/ArrayBuffer/Uint8Array에서 헤더 사전 검사에 필요한 선두 바이트를 읽는다. 그 외 소스는 대상이 아니다 */
async function tryReadLeadingBytes(source: ImageSource): Promise<Uint8Array | undefined> {
  if (source instanceof Blob) {
    const buffer = await readBlobAsArrayBuffer(source.slice(0, HEADER_PRECHECK_BYTE_LENGTH));
    return new Uint8Array(buffer);
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source, 0, Math.min(HEADER_PRECHECK_BYTE_LENGTH, source.byteLength));
  }
  if (source instanceof Uint8Array) {
    return source.subarray(0, Math.min(HEADER_PRECHECK_BYTE_LENGTH, source.byteLength));
  }
  return undefined;
}

/**
 * PNG/GIF/BMP(고정 오프셋 헤더)에 한해 디코드 전 픽셀 수를 미리 검사한다.
 *
 * `maxInputPixels`가 지정된 경우에만 시도한다(opt-in). 헤더 파싱 실패·미지원 포맷·
 * Blob/ArrayBuffer/Uint8Array가 아닌 소스는 조용히 통과시킨다(fail-open) — 사후
 * `assertInputPixelBudget()`이 디코드 후 여전히 검사하므로 유일한 방어선이 아니다.
 */
export async function precheckInputPixelBudget(source: ImageSource, maxInputPixels: number | undefined): Promise<void> {
  if (maxInputPixels === undefined) {
    return;
  }
  validatePixelBudgetOption(maxInputPixels, 'maxInputPixels');

  let bytes: Uint8Array | undefined;
  try {
    bytes = await tryReadLeadingBytes(source);
  } catch {
    // 선두 바이트를 못 읽으면(예: Blob이 더 이상 유효하지 않음, ArrayBuffer가 detach됨)
    // 조용히 통과시킨다 — 사후 assertInputPixelBudget()이 최종 방어선이다(fail-open).
    return;
  }
  if (!bytes) {
    return;
  }
  const dimensions = parseRasterHeaderDimensions(bytes);
  if (!dimensions) {
    return;
  }
  assertPixelBudget('input', dimensions.width * dimensions.height, maxInputPixels, 'header');
}
