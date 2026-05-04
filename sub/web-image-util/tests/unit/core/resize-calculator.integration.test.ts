/**
 * ResizeCalculator의 성능·회귀·통합 동작을 검증하는 테스트다.
 *
 * 성능 기대치, 과거 버그 회귀 방지, 여러 기능을 조합한 복합 시나리오를 확인한다.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ResizeCalculator } from '../../../src/core/resize-calculator';
import type { ResizeConfig } from '../../../src/types/resize-config';

const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

describe('ResizeCalculator - 성능', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

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

    // 1000회 계산이 100ms 이내여야 한다.
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

    // 모든 fit 모드가 유사한 성능을 보여야 한다.
    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    durations.forEach((duration) => {
      // 평균의 ±50% 이내
      expect(Math.abs(duration - avgDuration) / avgDuration).toBeLessThan(0.5);
    });
  });
});

describe('ResizeCalculator - 회귀 테스트', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  describe('maxFit 확대 버그', () => {
    it('91x114 이미지를 300x200으로 확대하지 않는다 (원래 버그)', () => {
      // 과거 버그: maxFit이 소형 이미지를 확대하는 문제가 있었다.
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

describe('ResizeCalculator - 통합 테스트', () => {
  let calculator: ResizeCalculator;

  beforeEach(() => {
    calculator = new ResizeCalculator();
  });

  it('cover + 대형 패딩 + 극단 종횡비 복합 시나리오를 처리한다', () => {
    const result = calculator.calculateFinalLayout(3000, 1000, {
      fit: 'cover',
      width: 800,
      height: 800,
      padding: { top: 50, right: 30, bottom: 50, left: 30 },
    });

    // 이미지: 3:1 비율 → 정사각형 캔버스를 cover하려면 높이 기준으로 맞춤
    expect(result.imageSize.width).toBe(2400);
    expect(result.imageSize.height).toBe(800);

    // Canvas: 800 + 60 (패딩) = 860
    expect(result.canvasSize).toEqual({ width: 860, height: 900 });

    // 가운데 정렬 + 패딩
    expect(result.position.x).toBeLessThan(0); // 가로 잘림
    expect(result.position.y).toBe(50); // 상단 패딩
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

    // cover: 캔버스 전체를 채운다.
    expect(coverResult.imageSize.width).toBeGreaterThanOrEqual(target.width);
    expect(coverResult.imageSize.height).toBeGreaterThanOrEqual(target.height);

    // contain: 캔버스 안쪽에 내접한다.
    expect(containResult.imageSize.width).toBeLessThanOrEqual(target.width);
    expect(containResult.imageSize.height).toBeLessThanOrEqual(target.height);

    // fill: 정확히 일치한다.
    expect(fillResult.imageSize).toEqual(target);

    // maxFit: 원본보다 크지 않다.
    expect(maxFitResult.imageSize.width).toBeLessThanOrEqual(input.width);
    expect(maxFitResult.imageSize.height).toBeLessThanOrEqual(input.height);

    // minFit: 이미 충분히 크므로 원본 크기 유지
    expect(minFitResult.imageSize.width).toBe(input.width);
    expect(minFitResult.imageSize.height).toBe(input.height);
  });
});
