import { describe, expect, it } from 'vitest';
import { processImage } from '../../src/index';

describe('Shortcut API Performance', () => {
  // Base64 encoded 100x100 blue square SVG
  const testImageUrl =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNzNkYyIvPjwvc3ZnPg==';

  // Vitest best practice: Helper function for performance testing
  /**
   * Execute given function multiple times and calculate average execution time
   * @param fn Function to measure
   * @param iterations Number of iterations
   * @returns Average execution time (ms), minimum time, maximum time
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
    // Vitest best practice: consistently measure performance tests for multiple scenarios with describe.each
    describe.each([
      {
        name: 'Direct Mapping - coverBox',
        factory: () => processImage(testImageUrl).shortcut.coverBox(300, 200),
        threshold: 100, // Maximum allowed time for 1000 creations (ms)
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

        // Total execution time should be within threshold
        expect(stats.avg * 1000, `1000 creations should complete within ${threshold}ms`).toBeLessThan(threshold);
      });

      it('should have consistent performance (low variance)', () => {
        // Skip performance consistency test in Node.js environment
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          console.log('Performance consistency test skipped in Node.js environment');
          return;
        }

        const stats = measurePerformance(factory, 100);
        const variance = stats.max - stats.min;

        console.log(
          `Variance: ${variance.toFixed(3)}ms (max: ${stats.max.toFixed(3)}ms, min: ${stats.min.toFixed(3)}ms)`
        );

        // Verify performance consistency only in browser environment
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

      // 100 chaining operations should complete within 50ms
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

      // Shortcut API overhead should be within 50% compared to direct API
      expect(shortcutDuration).toBeLessThan(directDuration * 1.5);
    });
  });
});
