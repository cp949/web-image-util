/**
 * ResizeCalculator의 핵심 동작을 검증하는 단위 테스트다.
 *
 * @description fit 모드, 패딩, 극단 입력, 회귀 방지, 성능 기대치를 함께 확인한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

describe('ResizeCalculator', () => {
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
      // Small image (100x100) → Large square (500x500)
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
      // Aspect ratio validation: Original 4:3 → Still 4:3 after contain
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

  // ============================================================================
  // FILL FIT MODE - Ignores aspect ratio for exact fit (may stretch or compress)
  // ============================================================================

  describe('fill 모드', () => {
    it('이미지를 정확한 목표 크기로 늘린다', () => {
      // Square (1000x1000) → Rectangle (800x600)
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
      // Landscape image (1920x1080) → Portrait rectangle (600x800)
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
      // Aspect ratio validation: Original 16:9 → 1:1 after fill (ratio changed)
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

  // ============================================================================
  // MAXFIT MODE - Maximum size limit (scale down only, no enlargement)
  // ============================================================================

  describe('maxFit 모드', () => {
    it('큰 이미지를 최대 범위 내로 축소한다', () => {
      // Large images are scaled down
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'maxFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 800, height: 600 });
      expect(result.canvasSize).toEqual({ width: 800, height: 600 });
    });

    it('너비만 제약할 때 종횡비를 유지한다', () => {
      // Width constraint only
      const result = calculator.calculateFinalLayout(1920, 1080, {
        fit: 'maxFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(450); // Maintain aspect ratio
    });

    it('높이만 제약할 때 종횡비를 유지한다', () => {
      // Height constraint only
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

  // ============================================================================
  // MINFIT MODE - Minimum size guarantee (scale up only, no shrinking)
  // ============================================================================

  describe('minFit 모드', () => {
    it('소형 이미지를 최소 범위로 확대한다', () => {
      // Small images are enlarged
      const result = calculator.calculateFinalLayout(100, 80, {
        fit: 'minFit',
        width: 500,
        height: 400,
      });

      expect(result.imageSize).toEqual({ width: 500, height: 400 });
      expect(result.canvasSize).toEqual({ width: 500, height: 400 });
    });

    it('큰 이미지를 축소하지 않는다', () => {
      // Large images maintain original size
      const result = calculator.calculateFinalLayout(2000, 1500, {
        fit: 'minFit',
        width: 800,
        height: 600,
      });

      expect(result.imageSize).toEqual({ width: 2000, height: 1500 });
      expect(result.canvasSize).toEqual({ width: 2000, height: 1500 });
    });

    it('너비만 제약할 때 종횡비를 유지한다', () => {
      // Width constraint only
      const result = calculator.calculateFinalLayout(400, 300, {
        fit: 'minFit',
        width: 800,
      });

      expect(result.imageSize.width).toBe(800);
      expect(result.imageSize.height).toBe(600); // Maintain aspect ratio
    });

    it('높이만 제약할 때 종횡비를 유지한다', () => {
      // Height constraint only
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

  // ============================================================================
  // PADDING SYSTEM - Padding handling tests
  // ============================================================================

  describe('패딩 시스템', () => {
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
        // Image position: Offset by padding amount
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
        // cover: Image 200x100 → 200x100 (as is), center-aligned
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

        // Unspecified right, bottom default to 0
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

        // All padding values are 0
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
        // maxFit: Image size becomes canvas size
        const result = calculator.calculateFinalLayout(100, 100, {
          fit: 'maxFit',
          width: 300,
          height: 200,
          padding: 20,
        });

        // Image: 100x100 (no enlargement)
        // Canvas: 100+40 = 140
        expect(result.imageSize).toEqual({ width: 100, height: 100 });
        expect(result.canvasSize).toEqual({ width: 140, height: 140 });
        expect(result.position).toEqual({ x: 20, y: 20 });
      });

      it('minFit 캔버스 크기에 패딩을 적용한다', () => {
        // minFit: Image size becomes canvas size
        const result = calculator.calculateFinalLayout(200, 150, {
          fit: 'minFit',
          width: 100,
          height: 80,
          padding: 10,
        });

        // Image: 200x150 (no shrinking)
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

  // ============================================================================
  // EXTREME CASES - Extreme case tests
  // ============================================================================

  describe('극단 입력', () => {
    describe('초대형 이미지', () => {
      it('8K 해상도(7680x4320)를 처리한다', () => {
        const result = calculator.calculateFinalLayout(7680, 4320, {
          fit: 'cover',
          width: 1920,
          height: 1080,
        });

        // 4x scale down
        expect(result.imageSize).toEqual({ width: 1920, height: 1080 });
        expect(result.canvasSize).toEqual({ width: 1920, height: 1080 });
      });

      it('초대형 이미지(100000x100000)를 처리한다', () => {
        const result = calculator.calculateFinalLayout(100000, 100000, {
          fit: 'maxFit',
          width: 1000,
          height: 1000,
        });

        // 100x scale down
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

        // No enlargement
        expect(result.imageSize).toEqual({ width: 1, height: 1 });
      });

      it('초소형 이미지(10x10)를 처리한다', () => {
        const result = calculator.calculateFinalLayout(10, 10, {
          fit: 'contain',
          width: 500,
          height: 500,
        });

        // 50x enlargement
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

        // Maintain aspect ratio
        const ratio = result.imageSize.width / result.imageSize.height;
        expect(Math.abs(ratio - 2560 / 1080)).toBeLessThan(0.01);
      });
    });

    describe('경계 치수', () => {
      it('목표 너비 0을 처리한다', () => {
        // TypeScript doesn't allow this, but can occur at runtime
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
        // Floating point operations may result in decimals
        const result = calculator.calculateFinalLayout(1000, 333, {
          fit: 'contain',
          width: 300,
          height: 100,
        });

        // Converted to integers via Math.round
        expect(Number.isInteger(result.imageSize.width)).toBe(true);
        expect(Number.isInteger(result.imageSize.height)).toBe(true);
      });
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS - Performance tests
  // ============================================================================

  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

  describe('성능', () => {
    it('1000회 반복 계산을 합리적인 시간 내에 완료한다', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculator.calculateFinalLayout(1920, 1080, {
          fit: 'cover',
          width: 800,
          height: 600,
          padding: 10,
        });
      }

      const end = performance.now();
      const duration = end - start;

      // 1000 calculations should complete within 100ms
      expect(duration).toBeLessThan(100);
    });

    it('복잡한 객체 패딩 계산도 효율적으로 처리한다', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculator.calculateFinalLayout(1920, 1080, {
          fit: 'contain',
          width: 800,
          height: 600,
          padding: { top: 10, right: 20, bottom: 15, left: 25 },
        });
      }

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(100);
    });

    it.skipIf(isNode)('fit 모드에 따른 성능 편차가 허용 범위 내에 있다', () => {
      const fitModes: Array<'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit'> = [
        'cover',
        'contain',
        'fill',
        'maxFit',
        'minFit',
      ];

      const durations: number[] = [];

      fitModes.forEach((fit) => {
        const start = performance.now();

        for (let i = 0; i < 500; i++) {
          calculator.calculateFinalLayout(1920, 1080, {
            fit,
            width: 800,
            height: 600,
          } as ResizeConfig);
        }

        const end = performance.now();
        durations.push(end - start);
      });

      // All fit modes should show similar performance
      const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
      durations.forEach((duration) => {
        // Within ±50% of average
        expect(Math.abs(duration - avgDuration) / avgDuration).toBeLessThan(0.5);
      });
    });
  });

  // ============================================================================
  // REGRESSION TESTS - Bug regression prevention tests
  // ============================================================================

  describe('회귀 테스트', () => {
    describe('maxFit 확대 버그', () => {
      it('91x114 이미지를 300x200으로 확대하지 않는다 (원래 버그)', () => {
        // Original bug: maxFit was enlarging small images
        const result = calculator.calculateFinalLayout(91, 114, {
          fit: 'maxFit',
          width: 300,
          height: 200,
        });

        expect(result.imageSize).toEqual({ width: 91, height: 114 });
        expect(result.canvasSize).toEqual({ width: 91, height: 114 });
        expect(result.position).toEqual({ x: 0, y: 0 });
      });

      it('다양한 소형 이미지를 maxFit에서 확대하지 않는다', () => {
        const testCases = [
          { w: 50, h: 50, maxW: 100, maxH: 100 },
          { w: 80, h: 120, maxW: 200, maxH: 300 },
          { w: 150, h: 100, maxW: 500, maxH: 400 },
        ];

        testCases.forEach(({ w, h, maxW, maxH }) => {
          const result = calculator.calculateFinalLayout(w, h, {
            fit: 'maxFit',
            width: maxW,
            height: maxH,
          });

          expect(result.imageSize).toEqual({ width: w, height: h });
        });
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - Integration tests (combining multiple features)
  // ============================================================================

  describe('통합 테스트', () => {
    it('cover + 대형 패딩 + 극단 종횡비 복합 시나리오를 처리한다', () => {
      const result = calculator.calculateFinalLayout(3000, 1000, {
        fit: 'cover',
        width: 800,
        height: 800,
        padding: { top: 50, right: 30, bottom: 50, left: 30 },
      });

      // Image: 3:1 ratio → To cover square canvas, fit height to 800
      expect(result.imageSize.width).toBe(2400);
      expect(result.imageSize.height).toBe(800);

      // Canvas: 800 + 60 (padding) = 860
      expect(result.canvasSize).toEqual({ width: 860, height: 900 });

      // Position: Center-aligned + padding
      expect(result.position.x).toBeLessThan(0); // Horizontal crop
      expect(result.position.y).toBe(50); // Top padding
    });

    it('동일 입력에 대해 모든 fit 모드의 결과가 일관된다', () => {
      const input = { width: 1920, height: 1080 };
      const target = { width: 800, height: 800 };

      const coverResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'cover',
        ...target,
      });
      const containResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'contain',
        ...target,
      });
      const fillResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'fill',
        ...target,
      });
      const maxFitResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'maxFit',
        ...target,
      });
      const minFitResult = calculator.calculateFinalLayout(input.width, input.height, {
        fit: 'minFit',
        ...target,
      });

      // cover: Covers canvas
      expect(coverResult.imageSize.width).toBeGreaterThanOrEqual(target.width);
      expect(coverResult.imageSize.height).toBeGreaterThanOrEqual(target.height);

      // contain: Fits inside canvas
      expect(containResult.imageSize.width).toBeLessThanOrEqual(target.width);
      expect(containResult.imageSize.height).toBeLessThanOrEqual(target.height);

      // fill: Exact fit
      expect(fillResult.imageSize).toEqual(target);

      // maxFit: Scale down only
      expect(maxFitResult.imageSize.width).toBeLessThanOrEqual(input.width);
      expect(maxFitResult.imageSize.height).toBeLessThanOrEqual(input.height);

      // minFit: Maintain original size (already large)
      expect(minFitResult.imageSize.width).toBe(input.width);
      expect(minFitResult.imageSize.height).toBe(input.height);
    });
  });
});
