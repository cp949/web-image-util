/**
 * ResizeCalculator의 패딩 처리를 검증하는 단위 테스트다.
 *
 * 숫자형·객체형 패딩, 부분 지정, fit 모드와의 조합을 확인한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';

describe('ResizeCalculator - 패딩', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  describe('숫자형 패딩', () => {
    it('모든 변에 동일한 패딩을 적용한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
        padding: 20,
      });

      // Canvas size: 100 + 20*2 = 140
      expect(result.canvasSize).toEqual({ width: 140, height: 140 });
      // 패딩만큼 이미지 위치가 이동한다.
      expect(result.position).toEqual({ x: 20, y: 20 });
    });

    it('cover 모드와 함께 동작한다', () => {
      const result = calculator.calculateFinalLayout(200, 100, {
        fit: 'cover',
        width: 100,
        height: 100,
        padding: 10,
      });

      expect(result.canvasSize).toEqual({ width: 120, height: 120 });
      // cover: 200x100 이미지를 그대로 사용, 가운데 정렬
      expect(result.imageSize.width).toBe(200);
      expect(result.imageSize.height).toBe(100);
    });
  });

  describe('객체형 패딩', () => {
    it('각 변에 서로 다른 패딩을 적용한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
        padding: { top: 10, right: 20, bottom: 30, left: 40 },
      });

      // Canvas size: width=100+20+40=160, height=100+10+30=140
      expect(result.canvasSize).toEqual({ width: 160, height: 140 });
      // Image position: left=40, top=10
      expect(result.position).toEqual({ x: 40, y: 10 });
    });

    it('부분 객체 패딩을 처리한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
        padding: { top: 15, left: 25 },
      });

      // 지정하지 않은 right, bottom은 0으로 처리된다.
      expect(result.canvasSize).toEqual({ width: 125, height: 115 });
      expect(result.position).toEqual({ x: 25, y: 15 });
    });

    it('빈 객체 패딩을 처리한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
        padding: {},
      });

      // 모든 패딩이 0이므로 크기·위치 변화 없음
      expect(result.canvasSize).toEqual({ width: 100, height: 100 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('패딩 없음', () => {
    it('패딩 없이도 정상 동작한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
      });

      expect(result.canvasSize).toEqual({ width: 100, height: 100 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('maxFit/minFit 패딩', () => {
    it('maxFit 캔버스 크기에 패딩을 적용한다', () => {
      // maxFit은 이미지 크기가 캔버스 크기가 된다.
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'maxFit',
        width: 300,
        height: 200,
        padding: 20,
      });

      // 이미지: 100x100 (확대 없음)
      // Canvas: 100+40 = 140
      expect(result.imageSize).toEqual({ width: 100, height: 100 });
      expect(result.canvasSize).toEqual({ width: 140, height: 140 });
      expect(result.position).toEqual({ x: 20, y: 20 });
    });

    it('minFit 캔버스 크기에 패딩을 적용한다', () => {
      // minFit은 이미지 크기가 캔버스 크기가 된다.
      const result = calculator.calculateFinalLayout(200, 150, {
        fit: 'minFit',
        width: 100,
        height: 80,
        padding: 10,
      });

      // 이미지: 200x150 (축소 없음)
      // Canvas: 200+20 = 220, 150+20 = 170
      expect(result.imageSize).toEqual({ width: 200, height: 150 });
      expect(result.canvasSize).toEqual({ width: 220, height: 170 });
      expect(result.position).toEqual({ x: 10, y: 10 });
    });
  });

  describe('대형 패딩 엣지 케이스', () => {
    it('매우 큰 패딩을 처리한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 100,
        height: 100,
        padding: 100,
      });

      // Canvas: 100+200 = 300
      expect(result.canvasSize).toEqual({ width: 300, height: 300 });
      expect(result.position).toEqual({ x: 100, y: 100 });
    });

    it('비대칭 대형 패딩을 처리한다', () => {
      const result = calculator.calculateFinalLayout(50, 50, {
        fit: 'contain',
        width: 50,
        height: 50,
        padding: { top: 200, right: 0, bottom: 0, left: 100 },
      });

      expect(result.canvasSize).toEqual({ width: 150, height: 250 });
      expect(result.position).toEqual({ x: 100, y: 200 });
    });
  });
});
