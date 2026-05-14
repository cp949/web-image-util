/**
 * AdvancedImageProcessor.batchProcess concurrency / 콜백 시퀀스 행동 테스트
 *
 * processImage 를 vi.spyOn 으로 stub 해 즉시 더미 결과를 반환하고,
 * 청크 분할·onProgress·onImageComplete·name 전파 계약을 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdvancedProcessingResult } from '../../../src/core/advanced-processor';
import { AdvancedImageProcessor } from '../../../src/core/advanced-processor';

// 더미 AdvancedProcessingResult 생성
function makeDummyResult(): AdvancedProcessingResult {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  return {
    canvas,
    processing: {
      filtersApplied: 0,
      watermarkApplied: false,
    },
    stats: {
      totalProcessingTime: 0.01,
      memoryPeakUsage: 0,
    },
    messages: [],
  };
}

// 서로 다른 객체로 구성된 source 픽스처 배열 생성
// chunks 는 sources.slice() 로 만들어지므로 각 청크 배열은 항상 서로 다른 객체다.
// 단, globalIndex 계산 시 sources 원소를 직접 사용하지 않으므로 객체 동일성은 무관하다.
function createSources(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'width', { value: 100, configurable: true });
    Object.defineProperty(img, 'height', { value: 100, configurable: true });
    return {
      image: img,
      options: {},
      name: `image-${i}`,
    };
  });
}

// microtask 큐를 모두 소진한 뒤 매크로태스크 큐로 넘어가도록 대기
function flushAsync() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

describe('AdvancedImageProcessor.batchProcess concurrency / 콜백 시퀀스', () => {
  let processImageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // processImage 를 stub 해 실제 처리 없이 즉시 더미 결과 반환
    processImageSpy = vi.spyOn(AdvancedImageProcessor, 'processImage').mockResolvedValue(makeDummyResult());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 옵션 없이 호출 — 기본 concurrency (=2) 경로
  // --------------------------------------------------------------------------
  describe('옵션 없이 호출 — 기본 concurrency', () => {
    it('concurrency 기본값이 2 이다 — 동기 구간 in-flight 가 정확히 2 이어야 한다', async () => {
      const resolvers: Array<() => void> = [];
      let inFlight = 0;
      let maxInFlight = 0;

      processImageSpy.mockImplementation(
        () =>
          new Promise<AdvancedProcessingResult>((resolve) => {
            inFlight++;
            if (inFlight > maxInFlight) maxInFlight = inFlight;
            resolvers.push(() => {
              inFlight--;
              resolve(makeDummyResult());
            });
          })
      );

      const batchPromise = AdvancedImageProcessor.batchProcess(createSources(5));

      // 첫 청크는 동기 구간에 즉시 시작되므로 await 없이도 resolver 가 정확히 2개여야 한다.
      // 기본값이 2가 아닌 값으로 바뀌면 이 단정이 실패한다.
      expect(resolvers).toHaveLength(2);
      expect(maxInFlight).toBe(2);

      // 나머지 청크를 순서대로 완료해 batchPromise 를 해소
      while (resolvers.length > 0) {
        resolvers.splice(0).forEach((r) => {
          r();
        });
        await flushAsync();
      }
      await batchPromise;

      // 전 과정에서도 동시 in-flight 가 2 를 초과하지 않았다
      expect(maxInFlight).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 5개 이미지 + concurrency: 2 기본 동작
  // --------------------------------------------------------------------------
  describe('5개 이미지 + concurrency: 2 기본 동작', () => {
    it('결과 배열 길이가 5 이고 모든 원소가 채워진다', async () => {
      const sources = createSources(5);
      const results = await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2 });

      expect(results).toHaveLength(5);
      // 스프레드로 희소 슬롯을 undefined 로 채운 뒤 검사 — .every 는 빈 슬롯을 건너뛰므로
      expect([...results].every((r) => r !== undefined)).toBe(true);
    });

    it('processImage 가 정확히 5회 호출된다', async () => {
      const sources = createSources(5);
      await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2 });

      expect(processImageSpy).toHaveBeenCalledTimes(5);
    });

    it('각 source 의 image/options 쌍이 processImage 에 1:1 로 전달된다', async () => {
      const sources = createSources(5);
      await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2 });

      // 청크 병렬성으로 호출 순서가 비결정적이므로 쌍 집합으로 비교
      const calledPairs = (processImageSpy.mock.calls as [HTMLImageElement, object][]).map(([img, opts]) => ({
        image: img,
        options: opts,
      }));
      for (const source of sources) {
        // 객체 참조 비교 — 다른 source 의 image/options 로 호출되면 실패한다
        expect(calledPairs.some((p) => p.image === source.image && p.options === source.options)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // concurrency 청크 분할 검증
  // --------------------------------------------------------------------------
  describe('concurrency 청크 분할 검증', () => {
    it('concurrency: 2 에서 최대 동시 in-flight 가 2 이고 청크 경계를 지킨다', async () => {
      const resolvers: Array<() => void> = [];
      let inFlight = 0;
      let maxInFlight = 0;

      processImageSpy.mockImplementation(
        () =>
          new Promise<AdvancedProcessingResult>((resolve) => {
            inFlight++;
            if (inFlight > maxInFlight) maxInFlight = inFlight;
            resolvers.push(() => {
              inFlight--;
              resolve(makeDummyResult());
            });
          })
      );

      const batchPromise = AdvancedImageProcessor.batchProcess(createSources(5), { concurrency: 2 });

      // batchProcess 의 동기 구간이 청크 1(items 0,1) 을 즉시 시작한다
      // — await 없이도 resolvers 에 2개가 쌓여야 한다
      expect(resolvers).toHaveLength(2);
      expect(maxInFlight).toBe(2);

      // 청크 1 완료 → 청크 2 시작 대기
      resolvers.splice(0).forEach((r) => {
        r();
      });
      await flushAsync();

      // 청크 2 (items 2,3) 가 동시에 시작됐는지 확인
      expect(resolvers).toHaveLength(2);

      // 청크 2 완료 → 청크 3 시작 대기
      resolvers.splice(0).forEach((r) => {
        r();
      });
      await flushAsync();

      // 청크 3 (item 4 하나만)
      expect(resolvers).toHaveLength(1);

      resolvers.splice(0).forEach((r) => {
        r();
      });
      await batchPromise;

      // 전 과정에서 동시 in-flight 가 2 를 초과하지 않았다
      expect(maxInFlight).toBe(2);
    });

    it('concurrency: 1 에서 최대 동시 in-flight 가 1 이다 (순차 처리)', async () => {
      const resolvers: Array<() => void> = [];
      let inFlight = 0;
      let maxInFlight = 0;

      processImageSpy.mockImplementation(
        () =>
          new Promise<AdvancedProcessingResult>((resolve) => {
            inFlight++;
            if (inFlight > maxInFlight) maxInFlight = inFlight;
            resolvers.push(() => {
              inFlight--;
              resolve(makeDummyResult());
            });
          })
      );

      const batchPromise = AdvancedImageProcessor.batchProcess(createSources(3), { concurrency: 1 });

      // 3개를 concurrency:1 로 처리 — 한 번에 하나씩
      for (let i = 0; i < 3; i++) {
        expect(resolvers).toHaveLength(1);
        resolvers.splice(0).forEach((r) => {
          r();
        });
        await flushAsync();
      }

      await batchPromise;

      expect(maxInFlight).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // onProgress 누적 호출
  // --------------------------------------------------------------------------
  describe('onProgress 누적 호출', () => {
    it('completed 값이 1~5 로 누적 증가하고 total 은 항상 5 이다', async () => {
      const completedValues: number[] = [];
      const totals: number[] = [];
      const onProgress = (completed: number, total: number) => {
        completedValues.push(completed);
        totals.push(total);
      };

      const sources = createSources(5);
      await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2, onProgress });

      expect(completedValues).toHaveLength(5);
      // 순서는 청크 내 병렬 실행 순서에 따라 달라질 수 있으므로 정렬 후 비교
      expect(completedValues.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      for (const t of totals) {
        expect(t).toBe(5);
      }
    });
  });

  // --------------------------------------------------------------------------
  // onImageComplete 콜백
  // --------------------------------------------------------------------------
  describe('onImageComplete 콜백', () => {
    it('globalIndex 0~4 에서 각 1회씩 호출된다', async () => {
      const completedIndices: number[] = [];
      const onImageComplete = (index: number) => completedIndices.push(index);

      const sources = createSources(5);
      await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2, onImageComplete });

      expect(completedIndices).toHaveLength(5);
      expect(completedIndices.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    });
  });

  // --------------------------------------------------------------------------
  // name 필드 전파
  // --------------------------------------------------------------------------
  describe('name 필드 전파', () => {
    it('onProgress 의 currentImage 에 각 이미지의 name 이 전달된다', async () => {
      const currentImages: (string | undefined)[] = [];
      const onProgress = (_completed: number, _total: number, currentImage?: string) => {
        currentImages.push(currentImage);
      };

      const sources = createSources(5);
      await AdvancedImageProcessor.batchProcess(sources, { concurrency: 2, onProgress });

      expect(currentImages).toHaveLength(5);
      // 전달된 name 집합이 sources 의 name 집합과 정확히 일치해야 한다
      // toContain 루프는 같은 name 이 5회 전달되어도 통과하므로 정렬 후 전수 비교
      expect(currentImages.slice().sort()).toEqual(['image-0', 'image-1', 'image-2', 'image-3', 'image-4']);
    });
  });
});
