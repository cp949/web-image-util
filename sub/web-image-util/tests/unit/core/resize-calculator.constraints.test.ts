/**
 * ResizeCalculator의 극단 입력 처리를 검증하는 단위 테스트다.
 *
 * 초대형/초소형 이미지, 극단 종횡비, 경계 치수 등 엣지 케이스를 확인한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

describe('ResizeCalculator - 극단 입력', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  describe('초대형 이미지', () => {
    it('8K 해상도(7680x4320)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(7680, 4320, {
        fit: 'cover',
        width: 1920,
        height: 1080,
      });

      // 4x 축소
      expect(result.imageSize).toEqual({ width: 1920, height: 1080 });
      expect(result.canvasSize).toEqual({ width: 1920, height: 1080 });
    });

    it('초대형 이미지(100000x100000)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(100000, 100000, {
        fit: 'maxFit',
        width: 1000,
        height: 1000,
      });

      // 100x 축소
      expect(result.imageSize).toEqual({ width: 1000, height: 1000 });
    });
  });

  describe('초소형 이미지', () => {
    it('1x1 픽셀 이미지를 처리한다', () => {
      const result = calculator.calculateFinalLayout(1, 1, {
        fit: 'maxFit',
        width: 100,
        height: 100,
      });

      // 확대 없음
      expect(result.imageSize).toEqual({ width: 1, height: 1 });
    });

    it('초소형 이미지(10x10)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(10, 10, {
        fit: 'contain',
        width: 500,
        height: 500,
      });

      // 50x 확대
      expect(result.imageSize).toEqual({ width: 500, height: 500 });
    });
  });

  describe('극단 종횡비', () => {
    it('극단 가로 종횡비(10000:1)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(10000, 1, {
        fit: 'contain',
        width: 1000,
        height: 1000,
      });

      expect(result.imageSize.width).toBe(1000);
      expect(result.imageSize.height).toBe(0); // Math.round(1000 * 1/10000)
    });

    it('극단 세로 종횡비(1:10000)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(1, 10000, {
        fit: 'contain',
        width: 1000,
        height: 1000,
      });

      expect(result.imageSize.width).toBe(0); // Math.round(1000 * 1/10000)
      expect(result.imageSize.height).toBe(1000);
    });

    it('파노라마 이미지(21:9)를 처리한다', () => {
      const result = calculator.calculateFinalLayout(2560, 1080, {
        fit: 'cover',
        width: 1920,
        height: 1080,
      });

      // 종횡비 유지
      const ratio = result.imageSize.width / result.imageSize.height;
      expect(Math.abs(ratio - 2560 / 1080)).toBeLessThan(0.01);
    });
  });

  describe('경계 치수', () => {
    it('목표 너비 0을 처리한다', () => {
      // TypeScript 타입으론 허용되지 않지만 런타임에서 발생 가능
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'fill',
        width: 0,
        height: 100,
      } as ResizeConfig);

      expect(result.imageSize.width).toBe(0);
    });

    it('목표 높이 0을 처리한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'fill',
        width: 100,
        height: 0,
      } as ResizeConfig);

      expect(result.imageSize.height).toBe(0);
    });

    it('소수점 치수를 정수로 변환한다', () => {
      // 부동소수점 연산 결과에 소수가 섞일 수 있다.
      const result = calculator.calculateFinalLayout(1000, 333, {
        fit: 'contain',
        width: 300,
        height: 100,
      });

      // Math.round로 정수 변환
      expect(Number.isInteger(result.imageSize.width)).toBe(true);
      expect(Number.isInteger(result.imageSize.height)).toBe(true);
    });
  });
});
