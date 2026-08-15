/**
 * 필터 plugin validate()가 반복하던 "타입 확인 → 범위 확인 → 경고 임계값 확인" 3단계를
 * 단일 소유하는 helper다. 관계 연산자(<, >)만 쓰는 원본 구현을 그대로 옮겼으므로
 * NaN을 넣으면 모든 분기가 false가 되어 valid:true를 반환하는 기존 부작용도 동일하게 남는다.
 */

import type { FilterValidationResult } from './plugin-system';

/** {@link validateNumberInRange}에 전달하는 범위·경고 규칙이다. */
export interface NumberRangeRule {
  /** 허용 최솟값 (포함) */
  min: number;
  /** 허용 최댓값 (포함). 생략하면 상한을 검사하지 않는다. */
  max?: number;
  /** 이 값을 초과하면 경고한다. warnAboveAbs와 동시에 쓰지 않는다. */
  warnAbove?: number;
  /** 절대값이 이 값을 초과하면 경고한다. warnAbove와 동시에 쓰지 않는다. */
  warnAboveAbs?: number;
  /** warnAbove/warnAboveAbs 중 하나를 지정하면 함께 지정해야 하는 경고 메시지 */
  warnMessage?: string;
  /**
   * true면 "타입 아님"과 "범위 밖"을 하나의 메시지
   * ("{name} must be a number between {min} and {max}")로 합친다.
   * VignetteFilterPlugin처럼 필드 하나를 단일 `||` 조건으로 검사하던 스타일과
   * 메시지를 맞출 때 쓴다. max가 없으면 쓸 수 없다.
   */
  combinedMessage?: boolean;
}

/** max 유무에 따라 "between A and B" 또는 "A or greater" 메시지를 고른다. */
function rangeErrorMessage(name: string, rule: NumberRangeRule): string {
  if (rule.max !== undefined) {
    return `${name} must be between ${rule.min} and ${rule.max}`;
  }
  return `${name} must be ${rule.min} or greater`;
}

/**
 * 숫자 파라미터 하나를 검증한다 — 타입 확인 → 범위 확인 → 경고 임계값 확인 순.
 *
 * @param value 검증할 값
 * @param name 에러 메시지에 쓰이는 파라미터 이름
 * @param rule 범위·경고 규칙
 */
export function validateNumberInRange(value: number, name: string, rule: NumberRangeRule): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof value !== 'number') {
    errors.push(
      rule.combinedMessage ? `${name} must be a number between ${rule.min} and ${rule.max}` : `${name} must be a number`
    );
  } else if (value < rule.min || (rule.max !== undefined && value > rule.max)) {
    errors.push(
      rule.combinedMessage
        ? `${name} must be a number between ${rule.min} and ${rule.max}`
        : rangeErrorMessage(name, rule)
    );
  } else if (rule.warnAbove !== undefined && value > rule.warnAbove) {
    warnings.push(rule.warnMessage as string);
  } else if (rule.warnAboveAbs !== undefined && Math.abs(value) > rule.warnAboveAbs) {
    warnings.push(rule.warnMessage as string);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
