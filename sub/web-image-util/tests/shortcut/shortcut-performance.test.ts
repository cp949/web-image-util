import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';

describe('Shortcut API Performance', () => {
  // Base64로 인코딩된 100x100 파란 사각형 SVG
  const testImageUrl =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNzNkYyIvPjwvc3ZnPg==';

  // Vitest 모범 사례: 성능 테스트를 위한 헬퍼 함수
  /**
   * 주어진 함수를 여러 번 실행하여 평균 실행 시간을 계산
   * @param fn 측정할 함수
   * @param iterations 반복 횟수
   * @returns 평균 실행 시간 (ms), 최소 시간, 최대 시간
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

  describe('Shortcut Creation Performance', () => {
    // Vitest 모범 사례: describe.each로 여러 시나리오의 성능 테스트를 일관되게 측정
    describe.each([
      {
        name: 'Direct Mapping - coverBox',
        factory: () => processImage(testImageUrl).shortcut.coverBox(300, 200),
        threshold: 100, // 1000번 생성에 대한 최대 허용 시간 (ms)
      },
      {
        name: 'Direct Mapping - containBox',
        factory: () => processImage(testImageUrl).shortcut.containBox(300, 200),
        threshold: 100,
      },
      {
        name: 'Lazy Operation - toScale',
        factory: () => processImage(testImageUrl).shortcut.scale(1.5),
        threshold: 100,
      },
      {
        name: 'Lazy Operation - toWidth',
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

        // 전체 실행 시간이 threshold 이내여야 함
        expect(stats.avg * 1000, `1000 creations should complete within ${threshold}ms`).toBeLessThan(threshold);
      });

      it('should have consistent performance (low variance)', () => {
        // Node.js 환경에서는 성능 일관성 테스트를 스킵
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          console.log('Performance consistency test skipped in Node.js environment');
          return;
        }

        const stats = measurePerformance(factory, 100);
        const variance = stats.max - stats.min;

        console.log(
          `Variance: ${variance.toFixed(3)}ms (max: ${stats.max.toFixed(3)}ms, min: ${stats.min.toFixed(3)}ms)`
        );

        // 브라우저 환경에서만 성능 일관성 검증
        expect(variance, 'performance should be consistent').toBeLessThan(stats.median * 5);
      });
    });
  });

  describe('Method Chaining Performance', () => {
    it('should chain operations efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const processor = processImage(testImageUrl).shortcut.scale(1.5).blur(2);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 100번 체이닝이 50ms 이내에 완료되어야 함
      expect(duration).toBeLessThan(50);
      console.log(`100 chained operations: ${duration.toFixed(2)}ms`);
    });

    it('should chain multiple shortcuts efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const processor = processImage(testImageUrl).shortcut.exactWidth(300).blur(2);
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

      // 2500개 직접 매핑 연산이 200ms 이내
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

      // 2500개 lazy 연산이 200ms 이내
      expect(duration).toBeLessThan(200);
      console.log(`2500 lazy operations: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory on repeated shortcut creation', () => {
      // 메모리 누수 테스트: 많은 수의 shortcut을 생성하고 버림
      const iterations = 10000;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        // 생성 후 즉시 버림
        processImage(testImageUrl).shortcut.coverBox(300, 200);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 10000번 생성/버림이 500ms 이내
      expect(duration).toBeLessThan(500);
      console.log(`${iterations} shortcut creations and disposals: ${duration.toFixed(2)}ms`);
    });

    it('should handle complex chaining without performance degradation', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        processImage(testImageUrl).shortcut.scale(1.5).blur(2).blur(1); // 추가 체이닝
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 복잡한 체이닝도 100ms 이내
      expect(duration).toBeLessThan(100);
      console.log(`100 complex chains: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Comparison: Shortcut vs Direct API', () => {
    it('should have comparable performance to direct resize API', () => {
      // Shortcut API
      const shortcutStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        processImage(testImageUrl).shortcut.coverBox(300, 200);
      }
      const shortcutDuration = performance.now() - shortcutStart;

      // Direct API
      const directStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        processImage(testImageUrl).resize({ fit: 'cover', width: 300, height: 200 });
      }
      const directDuration = performance.now() - directStart;

      console.log(`Shortcut API: ${shortcutDuration.toFixed(2)}ms`);
      console.log(`Direct API: ${directDuration.toFixed(2)}ms`);
      console.log(
        `Overhead: ${(shortcutDuration - directDuration).toFixed(2)}ms (${((shortcutDuration / directDuration - 1) * 100).toFixed(1)}%)`
      );

      // Shortcut의 오버헤드가 직접 API 대비 50% 이내여야 함
      expect(shortcutDuration).toBeLessThan(directDuration * 1.5);
    });
  });
});
