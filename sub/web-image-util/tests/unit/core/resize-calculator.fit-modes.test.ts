/**
 * ResizeCalculator의 fit 모드별 동작을 검증하는 단위 테스트다.
 *
 * cover / contain / fill / maxFit / minFit 각 모드의 이미지 크기·위치 계산을 확인한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';

describe('ResizeCalculator - fit 모드', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  // cover는 비율을 유지하면서 영역을 채우고 필요하면 잘라낸다.

  describe('cover 모드', () => {
    it('가로형 이미지를 정사각형 영역에 cover 방식으로 채운다', () => {
      // 가로형 이미지를 정사각형 영역에 맞추면 높이를 기준으로 채워진다.
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'cover',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(1422);
      expect(result.imageSize.height).toBe(800);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      // 가운데 정렬되며 좌우가 잘린다.
      expect(result.position.x).toBe(-311); // (800 - 1422) / 2 = -311
      expect(result.position.y).toBe(0);
    });

    it('세로형 이미지를 정사각형 영역에 cover 방식으로 채운다', () => {
      // 세로형 이미지를 정사각형 영역에 맞춘다.
      const result = calculator.calculateFinalLayout(1080, 1920, {
        fit: 'cover',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(1422);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(-311); // 상하가 잘린다.
    });

    it('큰 이미지를 cover 방식으로 축소한다', () => {
      // 큰 정사각형 이미지를 작은 정사각형으로 축소한다.
      const result = calculator.calculateFinalLayout(2000, 2000, {
        fit: 'cover',
        width: 500,
        height: 500,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 500 });
      expect(result.canvasSize).toEqual({ width: 500, height: 500 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('cover 후에도 원본 종횡비를 유지한다', () => {
      // cover 이후에도 원본 종횡비는 유지돼야 한다.
      const result = calculator.calculateFinalLayout(1600, 900, {
        fit: 'cover',
        width: 400,
        height: 400,
      });

      const originalRatio = 1600 / 900;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      // 부동소수점 오차는 조금 허용한다.
      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });

  // contain은 비율을 유지한 채 전체 이미지를 보여 주고 남는 공간은 여백이 된다.

  describe('contain 모드', () => {
    it('가로형 이미지를 contain 방식으로 내접 축소한다', () => {
      // 가로형 이미지는 너비를 기준으로 맞추고 세로 여백이 생긴다.
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'contain',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(450);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      // 가운데 정렬되며 위아래 여백이 남는다.
      expect(result.position.x).toBe(0);
      expect(result.position.y).toBe(175); // (800 - 450) / 2 = 175
    });

    it('세로형 이미지를 contain 방식으로 내접 축소한다', () => {
      // 세로형 이미지도 같은 규칙으로 contain 계산을 검증한다.
      const result = calculator.calculateFinalLayout(1080, 1920, {
        fit: 'contain',
        width: 800,
        height: 800,
      });

      expect(result.imageSize.width).toBe(450);
      expect(result.imageSize.height).toBe(800);
      expect(result.canvasSize).toEqual({ width: 800, height: 800 });
      expect(result.position.x).toBe(175); // Horizontal padding
      expect(result.position.y).toBe(0);
    });

    it('작은 이미지를 contain 방식으로 내접 확대한다', () => {
      const result = calculator.calculateFinalLayout(100, 100, {
        fit: 'contain',
        width: 500,
        height: 500,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 500 });
      expect(result.canvasSize).toEqual({ width: 500, height: 500 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('contain 후에도 원본 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(800, 600, {
        fit: 'contain',
        width: 400,
        height: 400,
      });

      const originalRatio = 800 / 600;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });

    it('withoutEnlargement가 true이면 캔버스는 고정하되 이미지는 확대하지 않는다', () => {
      const result = calculator.calculateFinalLayout(100, 80, {
        fit: 'contain',
        width: 300,
        height: 300,
        withoutEnlargement: true,
      });

      expect(result.imageSize).toEqual({ width: 100, height: 80 });
      expect(result.canvasSize).toEqual({ width: 300, height: 300 });
      expect(result.position).toEqual({ x: 100, y: 110 });
    });
  });

  describe('fill 모드', () => {
    it('이미지를 정확한 목표 크기로 늘린다', () => {
      const result = calculator.calculateFinalLayout(1000, 1000, {
        fit: 'fill',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 800, height: 600 });
      expect(result.canvasSize).toEqual({ width: 800, height: 600 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('이미지를 정확한 목표 크기로 압축한다', () => {
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'fill',
        width: 600,
        height: 800,
      });

      expect(result.imageSize).toEqual({ width: 600, height: 800 });
      expect(result.canvasSize).toEqual({ width: 600, height: 800 });
      expect(result.position).toEqual({ x: 0, y: 0 });
    });

    it('fill 모드는 종횡비를 유지하지 않는다', () => {
      const result = calculator.calculateFinalLayout(1600, 900, {
        fit: 'fill',
        width: 500,
        height: 500,
      });

      const originalRatio = 1600 / 900; // 1.78
      const resultRatio = result.imageSize.width / result.imageSize.height; // 1.0

      expect(Math.abs(resultRatio - originalRatio)).toBeGreaterThan(0.5);
    });
  });

  describe('maxFit 모드', () => {
    it('큰 이미지를 최대 범위 내로 축소한다', () => {
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'maxFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 800, height: 600 });
      expect(result.canvasSize).toEqual({ width: 800, height: 600 });
    });

    it('너비만 제약할 때 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'maxFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(450); // 종횡비 유지
    });

    it('높이만 제약할 때 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'maxFit',
        height: 600,
      });

      expect(result.imageSize.width).toBe(1067);
      expect(result.imageSize.height).toBe(600);
    });

    it('축소 시 원본 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(1600, 1200, {
        fit: 'maxFit',
        width: 400,
        height: 300,
      });

      const originalRatio = 1600 / 1200;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });

  describe('minFit 모드', () => {
    it('소형 이미지를 최소 범위로 확대한다', () => {
      const result = calculator.calculateFinalLayout(100, 80, {
        fit: 'minFit',
        width: 500,
        height: 400,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 400 });
      expect(result.canvasSize).toEqual({ width: 500, height: 400 });
    });

    it('큰 이미지를 축소하지 않는다', () => {
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'minFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 2000, height: 1500 });
      expect(result.canvasSize).toEqual({ width: 2000, height: 1500 });
    });

    it('너비만 제약할 때 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(400, 300, {
        fit: 'minFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(600); // 종횡비 유지
    });

    it('높이만 제약할 때 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(400, 300, {
        fit: 'minFit',
        height: 600,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(600);
    });

    it('확대 시 원본 종횡비를 유지한다', () => {
      const result = calculator.calculateFinalLayout(200, 150, {
        fit: 'minFit',
        width: 800,
        height: 600,
      });

      const originalRatio = 200 / 150;
      const resultRatio = result.imageSize.width / result.imageSize.height;

      expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
    });
  });
});
