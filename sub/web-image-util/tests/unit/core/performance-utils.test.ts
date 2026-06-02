/**
 * ResizePerformance 단위 테스트 (버그 수정용 회귀 테스트 포함)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BatchResizer } from '../../../src/core/batch-resizer';
import { autoResize, fastResize, qualityResize, ResizePerformance } from '../../../src/core/performance-utils';
import { SmartProcessor } from '../../../src/core/smart-processor';

/**
 * performance.memory를 복구 가능한 방식으로 주입한다.
 * jsdom/Node 환경에는 performance.memory가 없으므로 원본 descriptor를 저장했다가 복구한다.
 */
function withPerformanceMemory(usedJSHeapSize: number, jsHeapSizeLimit: number): () => void {
  const original = Object.getOwnPropertyDescriptor(performance, 'memory');
  Object.defineProperty(performance, 'memory', {
    configurable: true,
    value: { usedJSHeapSize, jsHeapSizeLimit },
  });

  return () => {
    if (original) {
      Object.defineProperty(performance, 'memory', original);
    } else {
      delete (performance as { memory?: unknown }).memory;
    }
  };
}

describe('ResizePerformance', () => {
  describe('setProfile / getProfile', () => {
    afterEach(() => {
      // 전역 상태 초기화
      ResizePerformance.setProfile('balanced');
      vi.restoreAllMocks();
    });

    it('기본 프로파일은 balanced이다', () => {
      // 모듈 임포트 직후 상태
      expect(ResizePerformance.getProfile()).toBe('balanced');
    });

    it('setProfile로 프로파일을 변경할 수 있다', () => {
      ResizePerformance.setProfile('fast');
      expect(ResizePerformance.getProfile()).toBe('fast');
    });

    it('setProfile 이후 getConfig는 변경된 프로파일 기준 config를 반환한다', () => {
      ResizePerformance.setProfile('quality');
      const config = ResizePerformance.getConfig();
      expect(config.concurrency).toBe(1);
      expect(config.timeout).toBe(60);
    });
  });

  describe('getConfig', () => {
    afterEach(() => {
      // 전역 상태 초기화
      ResizePerformance.setProfile('balanced');
    });

    it('profile 인자 없이 호출하면 현재 전역 프로파일 config를 반환한다', () => {
      ResizePerformance.setProfile('fast');
      const config = ResizePerformance.getConfig();
      expect(config.concurrency).toBe(4);
      expect(config.memoryLimitMB).toBe(128);
    });

    it('profile 인자를 넘기면 해당 프로파일 config를 반환한다', () => {
      const config = ResizePerformance.getConfig('quality');
      expect(config.concurrency).toBe(1);
      expect(config.memoryLimitMB).toBe(512);
    });
  });

  describe('getRecommendation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('메모리 압박이 high일 때 fast 프로파일을 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 900,
        limitMB: 1000,
        pressureLevel: 'high',
      });

      const result = ResizePerformance.getRecommendation(1, 1_000_000);

      expect(result.profile).toBe('fast');
      expect(result.reason).toBe('Fast profile recommended due to high memory pressure');
    });

    it('이미지가 10개 초과이고 평균 크기가 2MP 초과이면 fast를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(11, 2_100_000);

      expect(result.profile).toBe('fast');
    });

    it('이미지가 5개 이하이면 quality를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(3, 500_000);

      expect(result.profile).toBe('quality');
    });

    it('일반 상황(6~10개, 압박 없음)이면 balanced를 추천한다', () => {
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 100,
        limitMB: 1000,
        pressureLevel: 'low',
      });

      const result = ResizePerformance.getRecommendation(7, 500_000);

      expect(result.profile).toBe('balanced');
    });
  });

  describe('getMemoryInfo', () => {
    let restoreMemory: (() => void) | undefined;

    afterEach(() => {
      restoreMemory?.();
      restoreMemory = undefined;
    });

    it('performance.memory가 없는 환경에서는 기본 pressureLevel low를 반환한다', () => {
      // jsdom은 performance.memory를 제공하지 않으므로 폴백 경로를 탄다
      const info = ResizePerformance.getMemoryInfo();

      expect(info.pressureLevel).toBe('low');
      expect(info.usedMB).toBe(0);
      expect(info.limitMB).toBe(0);
    });

    it('압박 비율이 0.5 미만이면 pressureLevel low를 반환한다', () => {
      // 300MB / 1000MB = 0.3 < 0.5
      restoreMemory = withPerformanceMemory(300 * 1024 * 1024, 1000 * 1024 * 1024);

      const info = ResizePerformance.getMemoryInfo();

      expect(info.pressureLevel).toBe('low');
      expect(info.usedMB).toBe(300);
      expect(info.limitMB).toBe(1000);
    });

    it('압박 비율이 0.5 이상 0.8 미만이면 pressureLevel medium을 반환한다', () => {
      // 650MB / 1000MB = 0.65
      restoreMemory = withPerformanceMemory(650 * 1024 * 1024, 1000 * 1024 * 1024);

      const info = ResizePerformance.getMemoryInfo();

      expect(info.pressureLevel).toBe('medium');
      expect(info.usedMB).toBe(650);
    });

    it('압박 비율이 0.8 이상이면 pressureLevel high를 반환한다', () => {
      // 900MB / 1000MB = 0.9
      restoreMemory = withPerformanceMemory(900 * 1024 * 1024, 1000 * 1024 * 1024);

      const info = ResizePerformance.getMemoryInfo();

      expect(info.pressureLevel).toBe('high');
      expect(info.usedMB).toBe(900);
    });
  });

  describe('배치 프리셋 라우팅', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fastBatch는 SmartProcessor.resizeBatch에 fast performance/strategy를 전달한다', async () => {
      const spy = vi
        .spyOn(SmartProcessor, 'resizeBatch')
        .mockResolvedValue([] as HTMLCanvasElement[]);
      const images = [] as HTMLImageElement[];

      await ResizePerformance.fastBatch(images, 300, 200);

      expect(spy).toHaveBeenCalledWith(images, 300, 200, {
        performance: 'fast',
        strategy: 'fast',
      });
    });

    it('qualityBatch는 SmartProcessor.resizeBatch에 quality performance/strategy를 전달한다', async () => {
      const spy = vi
        .spyOn(SmartProcessor, 'resizeBatch')
        .mockResolvedValue([] as HTMLCanvasElement[]);
      const images = [] as HTMLImageElement[];

      await ResizePerformance.qualityBatch(images, 300, 200);

      expect(spy).toHaveBeenCalledWith(images, 300, 200, {
        performance: 'quality',
        strategy: 'quality',
      });
    });

    it('memoryEfficientBatch는 concurrency 1, canvas pool 비활성, 64MB 정책으로 BatchResizer를 구성한다', async () => {
      // processAll spy 안에서 this.config로 생성자에 전달된 정책을 검증한다
      let capturedConfig: Record<string, unknown> | undefined;
      const processAllSpy = vi
        .spyOn(BatchResizer.prototype, 'processAll')
        .mockImplementation(async function (this: BatchResizer) {
          capturedConfig = (this as unknown as { config: Record<string, unknown> }).config;
          return [] as unknown[];
        });
      const processSpy = vi.spyOn(SmartProcessor, 'process').mockResolvedValue({} as HTMLCanvasElement);

      const images = [{}, {}] as HTMLImageElement[];
      await ResizePerformance.memoryEfficientBatch(images, 300, 200);

      expect(capturedConfig).toMatchObject({
        concurrency: 1,
        useCanvasPool: false,
        memoryLimitMB: 64,
        timeout: 120,
      });
      // 이미지 수만큼 작업이 구성된다
      expect(processAllSpy.mock.calls[0]![0]).toHaveLength(2);

      // 각 작업은 SmartProcessor.process를 memory-efficient strategy로 호출한다
      const jobs = processAllSpy.mock.calls[0]![0] as Array<{ operation: () => Promise<unknown> }>;
      await jobs[0]!.operation();
      expect(processSpy).toHaveBeenCalledWith(images[0], 300, 200, {
        strategy: 'memory-efficient',
      });
    });
  });

  describe('단일 리사이즈 프리셋 라우팅', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fastResize는 SmartProcessor.process에 fast performance/strategy를 전달한다', async () => {
      const spy = vi.spyOn(SmartProcessor, 'process').mockResolvedValue({} as HTMLCanvasElement);
      const img = {} as HTMLImageElement;

      await fastResize(img, 300, 200);

      expect(spy).toHaveBeenCalledWith(img, 300, 200, {
        performance: 'fast',
        strategy: 'fast',
      });
    });

    it('qualityResize는 SmartProcessor.process에 quality performance/strategy를 전달한다', async () => {
      const spy = vi.spyOn(SmartProcessor, 'process').mockResolvedValue({} as HTMLCanvasElement);
      const img = {} as HTMLImageElement;

      await qualityResize(img, 300, 200);

      expect(spy).toHaveBeenCalledWith(img, 300, 200, {
        performance: 'quality',
        strategy: 'quality',
      });
    });

    it('autoResize는 추천 프로파일과 auto strategy를 SmartProcessor.process에 전달한다', async () => {
      const spy = vi.spyOn(SmartProcessor, 'process').mockResolvedValue({} as HTMLCanvasElement);
      // 픽셀 수 1MP, 단일 이미지 → getRecommendation은 quality 추천(5개 이하)
      const img = { width: 1000, height: 1000 } as HTMLImageElement;

      await autoResize(img, 300, 200);

      expect(spy).toHaveBeenCalledWith(img, 300, 200, {
        performance: 'quality',
        strategy: 'auto',
      });
    });

    it('autoResize는 메모리 압박이 high이면 fast 프로파일을 전달한다', async () => {
      const spy = vi.spyOn(SmartProcessor, 'process').mockResolvedValue({} as HTMLCanvasElement);
      vi.spyOn(ResizePerformance, 'getMemoryInfo').mockReturnValue({
        usedMB: 900,
        limitMB: 1000,
        pressureLevel: 'high',
      });
      const img = { width: 1000, height: 1000 } as HTMLImageElement;

      await autoResize(img, 300, 200);

      expect(spy).toHaveBeenCalledWith(img, 300, 200, {
        performance: 'fast',
        strategy: 'auto',
      });
    });
  });
});
