/**
 * validateNumberInRange()가 12개 filter plugin의 validate() 보일러플레이트를
 * 대신하는 단일 소유 helper로서 정확한지 검증한다.
 *
 * 검증 범위:
 *   - 타입 확인 → 범위 확인(상/하한, 상한 없음) → 경고 임계값(편측/절대값) 순서
 *   - combinedMessage 옵션의 결합 메시지 형태
 *   - NaN이 모든 분기를 통과해 valid:true가 되는 기존 부작용 보존
 */

import { describe, expect, it } from 'vitest';
import { validateNumberInRange } from '../../../src/filters/filter-param-validation.internal';

describe('validateNumberInRange', () => {
  describe('타입 확인', () => {
    it('숫자가 아니면 valid:false와 "{name} must be a number"를 반환한다', () => {
      const result = validateNumberInRange('bad' as unknown as number, 'radius', { min: 0, max: 20 });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['radius must be a number']);
    });
  });

  describe('범위 확인 — 상한 있음', () => {
    it('경계값(min, max)은 valid:true를 반환한다', () => {
      expect(validateNumberInRange(0, 'radius', { min: 0, max: 20 }).valid).toBe(true);
      expect(validateNumberInRange(20, 'radius', { min: 0, max: 20 }).valid).toBe(true);
    });

    it('범위를 벗어나면 "{name} must be between {min} and {max}"를 반환한다', () => {
      const result = validateNumberInRange(21, 'radius', { min: 0, max: 20 });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['radius must be between 0 and 20']);
    });
  });

  describe('범위 확인 — 상한 없음', () => {
    it('min 미만이면 "{name} must be {min} or greater"를 반환한다', () => {
      const result = validateNumberInRange(0, 'pixelSize', { min: 1 });
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['pixelSize must be 1 or greater']);
    });

    it('상한이 없으므로 큰 값도 valid:true를 반환한다', () => {
      expect(validateNumberInRange(100000, 'pixelSize', { min: 1 }).valid).toBe(true);
    });
  });

  describe('경고 임계값 — 편측(warnAbove)', () => {
    it('임계값 이하는 경고가 없다', () => {
      const result = validateNumberInRange(10, 'radius', { min: 0, max: 20, warnAbove: 10, warnMessage: '경고' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it('임계값 초과는 valid:true를 유지한 채 경고를 포함한다', () => {
      const result = validateNumberInRange(15, 'radius', { min: 0, max: 20, warnAbove: 10, warnMessage: '경고' });
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['경고']);
    });
  });

  describe('경고 임계값 — 절대값(warnAboveAbs)', () => {
    it('음수 값도 절대값 기준으로 경고한다', () => {
      const result = validateNumberInRange(-80, 'value', {
        min: -100,
        max: 100,
        warnAboveAbs: 50,
        warnMessage: '경고',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(['경고']);
    });

    it('양수 값도 절대값 기준으로 경고한다', () => {
      const result = validateNumberInRange(80, 'value', { min: -100, max: 100, warnAboveAbs: 50, warnMessage: '경고' });
      expect(result.warnings).toEqual(['경고']);
    });
  });

  describe('combinedMessage — 타입/범위 실패를 하나의 메시지로 합친다', () => {
    it('숫자가 아니면 "{name} must be a number between {min} and {max}"를 반환한다', () => {
      const result = validateNumberInRange('bad' as unknown as number, 'intensity', {
        min: 0,
        max: 1,
        combinedMessage: true,
      });
      expect(result.errors).toEqual(['intensity must be a number between 0 and 1']);
    });

    it('범위를 벗어나도 같은 결합 메시지를 반환한다', () => {
      const result = validateNumberInRange(2, 'intensity', { min: 0, max: 1, combinedMessage: true });
      expect(result.errors).toEqual(['intensity must be a number between 0 and 1']);
    });
  });

  describe('NaN — 기존 부작용 보존', () => {
    it('NaN은 모든 비교가 false가 되어 valid:true를 반환한다', () => {
      const result = validateNumberInRange(Number.NaN, 'radius', {
        min: 0,
        max: 20,
        warnAbove: 10,
        warnMessage: '경고',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
    });
  });
});
