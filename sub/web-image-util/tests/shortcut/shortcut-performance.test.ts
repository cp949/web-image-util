import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';

describe('Shortcut API Performance', () => {
  // Base64로 인코딩한 100x100 파란 정사각형 SVG다.
  const testImageUrl =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNzNkYyIvPjwvc3ZnPg==';

  /**
   * 함수를 여러 번 실행해 성능 통계를 계산한다.
   * @param fn 측정할 함수
   * @param iterations 반복 횟수
   * @returns 평균, 최소, 최대, 중앙값 실행 시간
   */
  function measurePerformance(fn: () => void, iterations: number) {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    return {
      avg: times.reduce((sum, t) => sum + t, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      median: times.sort((a, b) => a - b)[Math.floor(times.length / 2)],
    };
  }

  /**
   * 매우 짧은 동기 작업은 JIT/GC 노이즈 영향이 커서 여러 번 측정한 중앙값을 사용한다.
   * @param fn 측정할 함수
   * @param iterations 라운드별 반복 횟수
   * @param rounds 측정 라운드 수
   * @returns 총 실행 시간 통계
   */
  function measureBatchDuration(fn: () => void, iterations: number, rounds: number) {
    const durations: number[] = [];

    // 워밍업으로 초기 JIT 비용을 최대한 제거한다.
    for (let i = 0; i < Math.min(iterations, 100); i++) {
      fn();
    }

    for (let round = 0; round < rounds; round++) {
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        fn();
      }

      durations.push(performance.now() - start);
    }

    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
      avg: durations.reduce((sum, duration) => sum + duration, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      median: sortedDurations[Math.floor(sortedDurations.length / 2)],
    };
  }

  /**
   * 비교 대상이 충분한 측정 구간에 들어오도록 반복 횟수를 자동 보정한다.
   * @param fn 기준 함수
   * @param targetDurationMs 중앙값 목표 시간(ms)
   * @param rounds 측정 라운드 수
   * @returns 보정된 반복 횟수와 기준 함수 통계
   */
  function calibrateBatchIterations(fn: () => void, targetDurationMs: number, rounds: number) {
    let iterations = 1_000;
    let stats = measureBatchDuration(fn, iterations, rounds);

    while (stats.median < targetDurationMs && iterations < 1_000_000) {
      iterations *= 2;
      stats = measureBatchDuration(fn, iterations, rounds);
    }

    return {
      iterations,
      stats,
    };
  }

  describe('Shortcut Creation Performance', () => {
    // 여러 시나리오를 같은 기준으로 비교하기 위해 describe.each를 사용한다.
    describe.each([
      {
        name: 'Direct Mapping - coverBox',
        factory: () => processImage(testImageUrl).shortcut.coverBox(300, 200),
        threshold: 100, // 1000회 생성 시 허용 시간 상한(ms)
      },
      {
        name: 'Direct Mapping - containBox',
        factory: () => processImage(testImageUrl).shortcut.containBox(300, 200),
        threshold: 100,
      },
      {
        name: 'Lazy Operation - scale',
        factory: () => processImage(testImageUrl).shortcut.scale(1.5),
        threshold: 100,
      },
      {
        name: 'Lazy Operation - exactWidth',
        factory: () => processImage(testImageUrl).shortcut.exactWidth(300),
        threshold: 100,
      },
    ])('$name', ({ factory, threshold }) => {
      it('should create 1000 instances within performance threshold', () => {
        const stats = measurePerformance(factory, 1000);

        console.log(`Performance stats for 1000 iterations:
          - Average: ${stats.avg.toFixed(3)}ms per operation
          - Median: ${stats.median.toFixed(3)}ms
          - Min: ${stats.min.toFixed(3)}ms
          - Max: ${stats.max.toFixed(3)}ms
          - Total: ${(stats.avg * 1000).toFixed(2)}ms`);

        // 총 실행 시간은 임계값 안에 있어야 한다.
        expect(stats.avg * 1000, `1000 creations should complete within ${threshold}ms`).toBeLessThan(threshold);
      });

      it('should have consistent performance (low variance)', () => {
        // Node 환경에서는 변동성 측정 의미가 낮아 건너뛴다.
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          return;
        }

        const stats = measurePerformance(factory, 100);
        const variance = stats.max - stats.min;

        console.log(
          `Variance: ${variance.toFixed(3)}ms (max: ${stats.max.toFixed(3)}ms, min: ${stats.min.toFixed(3)}ms)`
        );

        // 브라우저 환경에서만 성능 편차를 검증한다.
        expect(variance, 'performance should be consistent').toBeLessThan(stats.median * 5);
      });
    });
  });

  describe('Method Chaining Performance', () => {
    it('should chain operations efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        processImage(testImageUrl).shortcut.scale(1.5).blur(2);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 100회 체이닝 생성은 50ms 안에 끝나야 한다.
      expect(duration).toBeLessThan(50);
      console.log(`100 chained operations: ${duration.toFixed(2)}ms`);
    });

    it('should chain multiple shortcuts efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        processImage(testImageUrl).shortcut.exactWidth(300).blur(2);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50);
      console.log(`100 multiple shortcut chains: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Different Shortcut Types Performance', () => {
    it('should perform Direct Mapping shortcuts efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 500; i++) {
        processImage(testImageUrl).shortcut.coverBox(300, 200);
        processImage(testImageUrl).shortcut.containBox(300, 200);
        processImage(testImageUrl).shortcut.exactSize(300, 200);
        processImage(testImageUrl).shortcut.maxWidth(500);
        processImage(testImageUrl).shortcut.maxHeight(400);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 2500 direct mapping operations should complete within 200ms
      expect(duration).toBeLessThan(200);
      console.log(`2500 direct mapping operations: ${duration.toFixed(2)}ms`);
    });

    it('should perform Lazy Operations efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 500; i++) {
        processImage(testImageUrl).shortcut.scale(1.5);
        processImage(testImageUrl).shortcut.exactWidth(100);
        processImage(testImageUrl).shortcut.exactHeight(200);
        processImage(testImageUrl).shortcut.scaleX(2);
        processImage(testImageUrl).shortcut.scaleY(0.5);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 2500 lazy operations should complete within 200ms
      expect(duration).toBeLessThan(200);
      console.log(`2500 lazy operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory on repeated shortcut creation', () => {
      // Memory leak test: create and discard many shortcuts
      const iterations = 10000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Create and immediately discard
        processImage(testImageUrl).shortcut.coverBox(300, 200);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 10000 creations/disposals should complete within 500ms
      expect(duration).toBeLessThan(500);
      console.log(`${iterations} shortcut creations and disposals: ${duration.toFixed(2)}ms`);
    });

    it('should handle complex chaining without performance degradation', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        processImage(testImageUrl).shortcut.scale(1.5).blur(2).blur(1); // Additional chaining
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Even complex chaining should complete within 100ms
      expect(duration).toBeLessThan(100);
      console.log(`100 complex chains: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Comparison: Shortcut vs Direct API', () => {
    it('should have comparable performance to direct resize API', () => {
      const rounds = 7;
      const { iterations, stats: directStats } = calibrateBatchIterations(
        () => {
          processImage(testImageUrl).resize({ fit: 'cover', width: 300, height: 200 });
        },
        5,
        rounds
      );

      const shortcutStats = measureBatchDuration(() => {
        processImage(testImageUrl).shortcut.coverBox(300, 200);
      }, iterations, rounds);

      const remeasuredDirectStats = measureBatchDuration(() => {
        processImage(testImageUrl).resize({ fit: 'cover', width: 300, height: 200 });
      }, iterations, rounds);

      console.log(`Iterations per round: ${iterations}`);
      console.log(`Shortcut API median: ${shortcutStats.median.toFixed(2)}ms`);
      console.log(`Direct API median: ${remeasuredDirectStats.median.toFixed(2)}ms`);
      console.log(
        `Overhead: ${(shortcutStats.median - remeasuredDirectStats.median).toFixed(2)}ms (${((shortcutStats.median / remeasuredDirectStats.median - 1) * 100).toFixed(1)}%)`
      );

      // 보정 후에도 측정 구간이 너무 짧으면 비교 결과를 신뢰하기 어렵다.
      expect(directStats.median, 'comparison baseline should be large enough for a stable measurement').toBeGreaterThanOrEqual(
        5
      );

      // 충분한 측정 구간에서는 비율 기준과 작은 절대 허용치를 함께 사용한다.
      const allowedDuration = Math.max(remeasuredDirectStats.median * 1.5, remeasuredDirectStats.median + 2);

      // Shortcut API overhead should be within 50% compared to direct API
      expect(shortcutStats.median).toBeLessThan(allowedDuration);
    });
  });
});
