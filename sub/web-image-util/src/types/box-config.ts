/**
 * box() 설정 타입과 호출 시점 검증
 *
 * @description
 * - 공개 타입 BoxOptions와 하위 타입을 정의한다.
 * - validateBoxOptions: 구조 검증(형식·범위). LazyRenderPipeline.addBox가 호출한다.
 * - normalizeBoxOptions: 생략 필드를 기본값으로 채운 내부 형태로 편다. radius는 원본 형태를
 *   그대로 보존한다 — %를 px로 바꾸려면 바깥 상자 크기가 필요하고, 그건 content 크기가
 *   확정된 뒤(analyzeAllOperations)에야 알 수 있다. box-calculator.internal.ts가 담당한다.
 * - resize.padding/background와의 동시 지정 금지는 파이프라인 상태(다른 연산이 이미 있는지)에
 *   의존하므로 여기서 검사하지 않는다 — LazyRenderPipeline.addBox/addResize가 담당한다.
 */

import { optionInvalid } from '../errors.internal';
import type { Padding } from './resize-config';

/** 모서리 반지름. px 숫자 또는 상자 크기 기준 %. 배열은 CSS 순서(TL, TR, BR, BL) */
export type BoxRadius =
  | number
  | `${number}%`
  | [number | `${number}%`, number | `${number}%`, number | `${number}%`, number | `${number}%`];

/** 테두리 설정 */
export interface BoxBorder {
  /** 선 두께(px) */
  width: number;
  /** CSS 색. alpha 허용 */
  color: string;
  /** true면 바깥 상자 크기를 늘리지 않고 안쪽에 그린다 (기본 false) */
  inset?: boolean;
}

/**
 * box() 옵션
 *
 * @description 모든 필드는 선택이다. 빈 객체는 no-op이며 1회 호출 슬롯만 소비한다.
 */
export interface BoxOptions {
  /** content(transform·resize 결과) 바깥 간격. 기존 Padding 타입 재사용 */
  padding?: Padding;
  /** border 안쪽 전체(content + padding) 아래에 칠하는 CSS 색. 기본 투명 */
  background?: string;
  /** 바깥 상자 모서리 둥글림. CSS border-radius와 동일 의미 */
  radius?: BoxRadius;
  /** 테두리 */
  border?: BoxBorder;
}

/** 검증·기본값 채움을 마친 border 내부 형태 */
export interface NormalizedBoxBorder {
  width: number;
  color: string;
  inset: boolean;
}

/** 검증·정규화를 마친 내부 형태. 렌더 파이프라인은 이 형태만 본다 */
export interface NormalizedBox {
  padding: { top: number; right: number; bottom: number; left: number };
  /** CSS 색 문자열. 기본 'transparent' */
  background: string;
  /** 원본 형태 그대로(px 해석은 box-calculator가 한다). 기본 0 */
  radius: BoxRadius;
  border: NormalizedBoxBorder | null;
}

/**
 * CSS 색 문자열의 유효성을 스크래치 canvas 2D 컨텍스트로 검사한다.
 *
 * Canvas는 잘못된 색을 대입해도 예외를 던지지 않고 이전 값을 조용히 유지한다.
 * 서로 다른 두 기준값(baseline)에서 각각 대입을 시도한 뒤 결과가 같은 값으로
 * 정규화됐는지 비교한다 — 유효한 색이면 두 기준값 모두 같은 정규화 결과로 수렴하고,
 * 무효한 색이면 각 기준값이 그대로 남아 서로 달라진다. 특정 sentinel 문자열과의
 * 충돌을 걱정할 필요가 없는 방식이다.
 *
 * jsdom 환경에서는 Canvas가 모든 문자열을 허용할 수 있으므로, hex 색에 대한
 * 형식 검증을 추가한다. Chrome 75 하한 이상에서 지원하는 3/4/6/8자리 hex를 모두 허용한다.
 */
export function isValidCssColor(value: string): boolean {
  // jsdom 호환성: hex 색은 명시적으로 형식 검증
  if (typeof value === 'string' && value.startsWith('#')) {
    // 3자리, 4자리, 6자리, 8자리 hex 허용 (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
    if (!/^#[0-9a-f]{3}$|^#[0-9a-f]{4}$|^#[0-9a-f]{6}$|^#[0-9a-f]{8}$/i.test(value)) {
      return false;
    }
  }

  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    // 컨텍스트를 못 만들면 검증을 건너뛰고 통과시킨다 — 이 검사는 사용성 보조이지
    // 보안 경계가 아니며, 실제 렌더 시점에도 같은 환경 제약이 적용된다.
    return true;
  }

  ctx.fillStyle = '#000000';
  ctx.fillStyle = value;
  const afterBlack = ctx.fillStyle;

  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = value;
  const afterWhite = ctx.fillStyle;

  return afterBlack === afterWhite;
}

/** padding 검증 — 숫자 또는 객체, 모든 방향이 유한수이고 음수가 아니어야 한다 */
function validatePadding(padding: Padding): void {
  if (typeof padding === 'number') {
    if (!Number.isFinite(padding) || padding < 0) {
      throw optionInvalid('padding', `box padding must be a finite number >= 0 (got ${padding})`);
    }
    return;
  }
  if (typeof padding !== 'object' || padding === null) {
    throw optionInvalid('padding', 'box padding must be a number or an object');
  }
  const values = [padding.top, padding.right, padding.bottom, padding.left].filter(
    (value): value is number => value !== undefined
  );
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw optionInvalid('padding', 'box padding values must be finite numbers >= 0');
  }
}

/** 단일 모서리 반지름 값(px 숫자 또는 % 문자열)의 형식을 검증한다 */
function validateRadiusValue(value: unknown): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw optionInvalid('radius', `box radius must be a finite number >= 0 (got ${value})`);
    }
    return;
  }
  // BoxRadius 타입(`${number}%`)이 허용하는 모든 number 문자열 표현(".5", "1e2", "1.5e-2" 등)을
  // 받아들인다 — 부호(-)는 여기서 금지한다(radius는 음수 불가, 숫자 분기와 동일 규칙).
  if (typeof value === 'string' && /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%$/i.test(value)) {
    return;
  }
  throw optionInvalid('radius', `box radius must be a non-negative number or a "N%" string (got ${String(value)})`);
}

/** radius 검증 — 단일 값 또는 길이 4 배열(TL, TR, BR, BL) */
function validateRadius(radius: BoxRadius): void {
  if (Array.isArray(radius)) {
    // 타입은 길이 4 튜플이지만, 호출자가 타입을 우회해 다른 길이의 배열을 넘길 수 있다 —
    // 그 실제 길이를 검사하려면 튜플 타입을 벗어난 일반 배열로 다뤄야 한다.
    const arr = radius as readonly unknown[];
    if (arr.length !== 4) {
      throw optionInvalid('radius', `box radius array must have exactly 4 entries (got ${arr.length})`);
    }
    for (const value of arr) {
      validateRadiusValue(value);
    }
    return;
  }
  validateRadiusValue(radius);
}

/** border 검증 — width는 유한수 >= 0, color는 유효한 CSS 색, inset은 boolean 또는 생략 */
function validateBorder(border: BoxBorder): void {
  if (typeof border !== 'object' || border === null) {
    throw optionInvalid('border', 'box border must be an object');
  }
  if (!Number.isFinite(border.width) || border.width < 0) {
    throw optionInvalid('border.width', `box border.width must be a finite number >= 0 (got ${border.width})`);
  }
  if (typeof border.color !== 'string' || !isValidCssColor(border.color)) {
    throw optionInvalid('border.color', `box border.color must be a valid CSS color (got ${String(border.color)})`);
  }
  if (border.inset !== undefined && typeof border.inset !== 'boolean') {
    throw optionInvalid('border.inset', 'box border.inset must be a boolean');
  }
}

/**
 * box 옵션 검증
 *
 * 파이프라인 상태가 필요 없는 구조 검사만 한다. 실패 시 어떤 상태도 남기지 않는다.
 * @throws {ImageProcessError} OPTION_INVALID
 */
export function validateBoxOptions(options: BoxOptions): void {
  if (typeof options !== 'object' || options === null) {
    throw optionInvalid('box', 'box options must be an object');
  }
  if (options.padding !== undefined) {
    validatePadding(options.padding);
  }
  if (options.background !== undefined) {
    if (typeof options.background !== 'string' || !isValidCssColor(options.background)) {
      throw optionInvalid('background', `box background must be a valid CSS color (got ${String(options.background)})`);
    }
  }
  if (options.radius !== undefined) {
    validateRadius(options.radius);
  }
  if (options.border !== undefined) {
    validateBorder(options.border);
  }
}

/**
 * padding을 네 방향 값으로 편다. `core/resize-calculator.internal.ts`의 비공개 `normalizePadding`과
 * 같은 규칙(숫자 → 네 방향 동일값, 생략 방향 → 0)이지만 재사용하지 않고 여기서 자체 구현한다 —
 * `src/types/`는 `src/core/`에 런타임 의존성을 두지 않는 방향이 이 코드베이스의 결이다.
 */
function normalizeBoxPadding(padding: Padding | undefined): NormalizedBox['padding'] {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
}

/**
 * 검증을 통과한 옵션을 내부 형태로 편다. validateBoxOptions 뒤에만 호출한다.
 */
export function normalizeBoxOptions(options: BoxOptions): NormalizedBox {
  return {
    padding: normalizeBoxPadding(options.padding),
    background: options.background ?? 'transparent',
    radius: options.radius ?? 0,
    border: options.border
      ? { width: options.border.width, color: options.border.color, inset: options.border.inset ?? false }
      : null,
  };
}
