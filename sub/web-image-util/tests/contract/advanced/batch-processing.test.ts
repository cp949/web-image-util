import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BatchResizer, type BatchResizeJob } from '../../../src/core/batch-resizer';
import type { ResizeProfile, ResizePerformanceOptions } from '../../../src/core/performance-config';

// Context7 베스트 프랙티스: 싱글톤 AutoMemoryManager 모킹
const mockCheckAndOptimize = vi.fn().mockResolvedValue(undefined);
const mockInstance = {
  checkAndOptimize: mockCheckAndOptimize,
};

vi.mock('../../../src/core/auto-memory-manager', () => ({
  AutoMemoryManager: {
    getInstance: vi.fn(() => mockInstance),
  },
}));

// getPerformanceConfig 모킹
vi.mock('../../../src/core/performance-config', () => ({
  getPerformanceConfig: vi.fn((profile: ResizeProfile): ResizePerformanceOptions => {
    const configs = {
      fast: { concurrency: 4, timeout: 5, memoryLimitMB: 100 },
      balanced: { concurrency: 2, timeout: 10, memoryLimitMB: 200 },
      quality: { concurrency: 1, timeout: 30, memoryLimitMB: 500 },
    };
    return configs[profile] || configs.balanced;
  }),
}));

describe('배치 처리 시스템 계약 테스트', () => {
  let batchResizer: BatchResizer;

  beforeEach(() => {
    batchResizer = new BatchResizer();
    vi.clearAllMocks();
    mockCheckAndOptimize.mockClear(); // Context7 베스트 프랙티스: 싱글톤 모킹 초기화
  });

  describe('타입 시스템 검증', () => {
    test('BatchResizeJob 인터페이스 구조', () => {
      const job: BatchResizeJob<string> = {
        operation: () => Promise.resolve('test result'),
        id: 'test-job-1',
      };

      expect(typeof job.operation).toBe('function');
      expect(job.id).toBe('test-job-1');
    });

    test('BatchResizeJob 필수 필드만 포함', () => {
      const minimalJob: BatchResizeJob<number> = {
        operation: () => Promise.resolve(42),
      };

      expect(typeof minimalJob.operation).toBe('function');
      expect(minimalJob.id).toBeUndefined();
    });

    test('ResizeProfile 타입 값들', () => {
      const profiles: ResizeProfile[] = ['fast', 'balanced', 'quality'];

      profiles.forEach(profile => {
        expect(typeof profile).toBe('string');
      });
    });
  });

  describe('BatchResizer 클래스 기본 기능', () => {
    test('클래스 인스턴스 생성', () => {
      expect(batchResizer).toBeInstanceOf(BatchResizer);
    });

    test('기본 프로필로 생성', () => {
      const defaultBatcher = new BatchResizer();
      expect(defaultBatcher).toBeInstanceOf(BatchResizer);
    });

    test('특정 프로필로 생성', () => {
      const profiles: ResizeProfile[] = ['fast', 'balanced', 'quality'];

      profiles.forEach(profile => {
        const profileBatcher = new BatchResizer(profile);
        expect(profileBatcher).toBeInstanceOf(BatchResizer);
      });
    });

    test('커스텀 설정으로 생성', () => {
      const customConfig: ResizePerformanceOptions = {
        concurrency: 3,
        timeout: 15,
        memoryLimitMB: 300,
      };

      const customBatcher = new BatchResizer(customConfig);
      expect(customBatcher).toBeInstanceOf(BatchResizer);
    });

    test('getConfig 메서드', () => {
      const config = batchResizer.getConfig();

      expect(config).toHaveProperty('concurrency');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('memoryLimitMB');
      expect(typeof config.concurrency).toBe('number');
      expect(typeof config.timeout).toBe('number');
      expect(typeof config.memoryLimitMB).toBe('number');
    });
  });

  describe('기본 배치 처리 기능', () => {
    test('빈 작업 배열 처리', async () => {
      const jobs: BatchResizeJob<string>[] = [];

      const results = await batchResizer.processAll(jobs);

      expect(results).toEqual([]);
      expect(Array.isArray(results)).toBe(true);
    });

    test('단일 작업 처리', async () => {
      const jobs: BatchResizeJob<string>[] = [
        {
          operation: () => Promise.resolve('single result'),
          id: 'job-1',
        },
      ];

      const results = await batchResizer.processAll(jobs);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('single result');
    });

    test('여러 작업 순차 처리', async () => {
      const jobs: BatchResizeJob<number>[] = [
        { operation: () => Promise.resolve(1), id: 'job-1' },
        { operation: () => Promise.resolve(2), id: 'job-2' },
        { operation: () => Promise.resolve(3), id: 'job-3' },
      ];

      const results = await batchResizer.processAll(jobs);

      expect(results).toHaveLength(3);
      expect(results).toEqual([1, 2, 3]);
    });

    test('비동기 작업 처리', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      const jobs: BatchResizeJob<string>[] = [
        {
          operation: async () => {
            await delay(10);
            return 'async-1';
          },
        },
        {
          operation: async () => {
            await delay(5);
            return 'async-2';
          },
        },
      ];

      const startTime = Date.now();
      const results = await batchResizer.processAll(jobs);
      const endTime = Date.now();

      expect(results).toHaveLength(2);
      expect(results).toContain('async-1');
      expect(results).toContain('async-2');

      // 병렬 처리로 인해 총 시간이 개별 작업 시간의 합보다 적어야 함
      expect(endTime - startTime).toBeLessThan(20);
    });

    test('다양한 반환 타입 처리', async () => {
      const jobs: BatchResizeJob<any>[] = [
        { operation: () => Promise.resolve('string') },
        { operation: () => Promise.resolve(42) },
        { operation: () => Promise.resolve(true) },
        { operation: () => Promise.resolve({ key: 'value' }) },
        { operation: () => Promise.resolve([1, 2, 3]) },
      ];

      const results = await batchResizer.processAll(jobs);

      expect(results).toHaveLength(5);
      expect(results[0]).toBe('string');
      expect(results[1]).toBe(42);
      expect(results[2]).toBe(true);
      expect(results[3]).toEqual({ key: 'value' });
      expect(results[4]).toEqual([1, 2, 3]);
    });
  });

  describe('동시성 제어', () => {
    test('동시성 제한 적용', async () => {
      const fastBatcher = new BatchResizer('fast'); // concurrency: 4
      const executionOrder: number[] = [];

      const jobs: BatchResizeJob<number>[] = Array.from({ length: 8 }, (_, i) => ({
        operation: async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 10));
          return i;
        },
        id: `job-${i}`,
      }));

      const results = await fastBatcher.processAll(jobs);

      expect(results).toHaveLength(8);
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

      // 동시성 제한으로 인해 첫 4개가 먼저 실행되어야 함
      expect(executionOrder.slice(0, 4)).toEqual([0, 1, 2, 3]);
    });

    test('순차 처리 (concurrency: 1)', async () => {
      const qualityBatcher = new BatchResizer('quality'); // concurrency: 1
      const executionOrder: number[] = [];

      const jobs: BatchResizeJob<number>[] = Array.from({ length: 3 }, (_, i) => ({
        operation: async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 5));
          return i;
        },
      }));

      const results = await qualityBatcher.processAll(jobs);

      expect(results).toEqual([0, 1, 2]);
      expect(executionOrder).toEqual([0, 1, 2]); // 순차 실행
    });

    test('커스텀 동시성 설정', async () => {
      const customBatcher = new BatchResizer({
        concurrency: 3,
        timeout: 10,
        memoryLimitMB: 200,
      });

      const jobs: BatchResizeJob<number>[] = Array.from({ length: 6 }, (_, i) => ({
        operation: () => Promise.resolve(i),
      }));

      const results = await customBatcher.processAll(jobs);

      expect(results).toHaveLength(6);
      expect(results).toEqual([0, 1, 2, 3, 4, 5]);
    });
  });

  describe('에러 처리', () => {
    test('개별 작업 실패 처리', async () => {
      const jobs: BatchResizeJob<string>[] = [
        { operation: () => Promise.resolve('success-1') },
        { operation: () => Promise.reject(new Error('job failed')) },
        { operation: () => Promise.resolve('success-2') },
      ];

      // 하나의 작업이 실패하면 전체 배치가 실패해야 함
      await expect(batchResizer.processAll(jobs)).rejects.toThrow('job failed');
    });

    test('타임아웃 처리', async () => {
      const fastBatcher = new BatchResizer('fast'); // timeout: 5초

      const jobs: BatchResizeJob<string>[] = [
        {
          operation: async () => {
            // 타임아웃보다 긴 작업
            await new Promise(resolve => setTimeout(resolve, 6000));
            return 'should not complete';
          },
        },
      ];

      await expect(fastBatcher.processAll(jobs)).rejects.toThrow(/timed out/);
    });

    test('Promise rejection 처리', async () => {
      const jobs: BatchResizeJob<never>[] = [
        {
          operation: () => Promise.reject(new Error('Custom error message')),
        },
      ];

      await expect(batchResizer.processAll(jobs)).rejects.toThrow('Custom error message');
    });

    test('동기 에러 처리', async () => {
      const jobs: BatchResizeJob<never>[] = [
        {
          operation: () => {
            throw new Error('Synchronous error');
          },
        },
      ];

      await expect(batchResizer.processAll(jobs)).rejects.toThrow('Synchronous error');
    });
  });

  describe('메모리 관리', () => {
    test('메모리 매니저 호출 확인', async () => {
      const jobs: BatchResizeJob<string>[] = [
        { operation: () => Promise.resolve('test-1') },
        { operation: () => Promise.resolve('test-2') },
      ];

      await batchResizer.processAll(jobs);

      // Context7 베스트 프랙티스: 싱글톤 인스턴스의 메모리 매니저 호출 확인
      expect(mockCheckAndOptimize).toHaveBeenCalled();
    });

    test('대량 작업 시 메모리 체크', async () => {
      const largeJobSet: BatchResizeJob<number>[] = Array.from({ length: 20 }, (_, i) => ({
        operation: () => Promise.resolve(i),
        id: `large-job-${i}`,
      }));

      const results = await batchResizer.processAll(largeJobSet);

      expect(results).toHaveLength(20);

      // Context7 베스트 프랙티스: 여러 번의 메모리 체크가 발생해야 함 (청크별로)
      expect(mockCheckAndOptimize).toHaveBeenCalled();
      expect(mockCheckAndOptimize.mock.calls.length).toBeGreaterThan(1); // 청크별로 여러 번 호출
    });
  });

  describe('성능 프로필별 동작', () => {
    test('fast 프로필 설정 확인', () => {
      const fastBatcher = new BatchResizer('fast');
      const config = fastBatcher.getConfig();

      expect(config.concurrency).toBe(4);
      expect(config.timeout).toBe(5);
      expect(config.memoryLimitMB).toBe(100);
    });

    test('balanced 프로필 설정 확인', () => {
      const balancedBatcher = new BatchResizer('balanced');
      const config = balancedBatcher.getConfig();

      expect(config.concurrency).toBe(2);
      expect(config.timeout).toBe(10);
      expect(config.memoryLimitMB).toBe(200);
    });

    test('quality 프로필 설정 확인', () => {
      const qualityBatcher = new BatchResizer('quality');
      const config = qualityBatcher.getConfig();

      expect(config.concurrency).toBe(1);
      expect(config.timeout).toBe(30);
      expect(config.memoryLimitMB).toBe(500);
    });

    test('프로필별 성능 차이', async () => {
      const jobs: BatchResizeJob<number>[] = Array.from({ length: 4 }, (_, i) => ({
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return i;
        },
      }));

      // Fast 프로필 (높은 동시성)
      const fastBatcher = new BatchResizer('fast');
      const fastStart = Date.now();
      await fastBatcher.processAll([...jobs]);
      const fastTime = Date.now() - fastStart;

      // Quality 프로필 (순차 처리)
      const qualityBatcher = new BatchResizer('quality');
      const qualityStart = Date.now();
      await qualityBatcher.processAll([...jobs]);
      const qualityTime = Date.now() - qualityStart;

      // Fast가 Quality보다 빨라야 함
      expect(fastTime).toBeLessThan(qualityTime);
    });
  });

  describe('타임아웃 기능', () => {
    test('runWithTimeout 메서드 존재 확인', () => {
      // private 메서드이므로 직접 테스트 불가, 간접적으로 확인
      expect(typeof (batchResizer as any).runWithTimeout).toBe('function');
    });

    test('정상 완료 시 타임아웃 안됨', async () => {
      const job: BatchResizeJob<string> = {
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'completed normally';
        },
      };

      const result = await batchResizer.processAll([job]);
      expect(result[0]).toBe('completed normally');
    });

    test('타임아웃 에러 메시지 형식', async () => {
      const fastBatcher = new BatchResizer('fast'); // 5초 타임아웃

      const job: BatchResizeJob<never> = {
        operation: () => new Promise(() => {}), // 무한 대기
      };

      try {
        await fastBatcher.processAll([job]);
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).toMatch(/timed out after \d+ms/);
      }
    });
  });

  describe('설정 불변성', () => {
    test('getConfig 반환값 불변성', () => {
      const config1 = batchResizer.getConfig();
      const config2 = batchResizer.getConfig();

      // 다른 객체 참조여야 함 (깊은 복사)
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);

      // 반환된 설정 수정해도 원본에 영향 없어야 함
      config1.concurrency = 999;
      const config3 = batchResizer.getConfig();
      expect(config3.concurrency).not.toBe(999);
    });
  });

  describe('복잡한 시나리오', () => {
    test('혼합 타입 작업 배치 처리', async () => {
      interface ImageResult {
        width: number;
        height: number;
        format: string;
      }

      interface TextResult {
        content: string;
        length: number;
      }

      const mixedJobs: BatchResizeJob<ImageResult | TextResult>[] = [
        {
          operation: (): Promise<ImageResult> =>
            Promise.resolve({ width: 800, height: 600, format: 'jpeg' }),
          id: 'image-job',
        },
        {
          operation: (): Promise<TextResult> =>
            Promise.resolve({ content: 'Hello World', length: 11 }),
          id: 'text-job',
        },
      ];

      const results = await batchResizer.processAll(mixedJobs);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ width: 800, height: 600, format: 'jpeg' });
      expect(results[1]).toEqual({ content: 'Hello World', length: 11 });
    });

    test('중첩된 배치 처리 시뮬레이션', async () => {
      const nestedBatcher = new BatchResizer('balanced');

      const jobs: BatchResizeJob<number[]>[] = [
        {
          operation: async () => {
            // 내부에서 또 다른 배치 처리
            const innerJobs: BatchResizeJob<number>[] = [
              { operation: () => Promise.resolve(1) },
              { operation: () => Promise.resolve(2) },
            ];
            return nestedBatcher.processAll(innerJobs);
          },
        },
      ];

      const results = await batchResizer.processAll(jobs);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual([1, 2]);
    });
  });

  describe('메모리 사용량 및 성능', () => {
    test('대량 배치 처리 성능', async () => {
      const largeBatch: BatchResizeJob<number>[] = Array.from({ length: 100 }, (_, i) => ({
        operation: () => Promise.resolve(i),
        id: `perf-job-${i}`,
      }));

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const results = await batchResizer.processAll(largeBatch);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // 1초 이내
      expect(endMemory - startMemory).toBeLessThan(10 * 1024 * 1024); // 10MB 이하
    });

    test('메모리 누수 검사', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 여러 번의 배치 처리 실행
      for (let batch = 0; batch < 5; batch++) {
        const jobs: BatchResizeJob<string>[] = Array.from({ length: 20 }, (_, i) => ({
          operation: () => Promise.resolve(`batch-${batch}-job-${i}`),
        }));

        await batchResizer.processAll(jobs);
      }

      // 가비지 컬렉션 강제 실행 (Node.js 환경)
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 메모리 증가량이 과도하지 않은지 확인 (5MB 이하)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});