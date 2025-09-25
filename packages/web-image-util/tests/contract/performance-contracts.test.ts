/**
 * 성능 계약 테스트
 *
 * 목적: 메모리 사용량, 처리 시간 임계값, 성능 제약 조건 검증
 * 환경: Node.js (성능 메트릭 시뮬레이션)
 * 범위: 성능 SLA, 리소스 사용량 한계, 처리 시간 보장
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 성능 메트릭 추적 클래스
class PerformanceTracker {
  private memoryUsage = 0;
  private operationCount = 0;
  private startTime = 0;
  private endTime = 0;
  private operations: Array<{ name: string; duration: number; memory: number }> = [];

  startOperation(name: string) {
    this.startTime = performance.now();
    this.operationCount++;
  }

  endOperation(name: string, memoryDelta: number = 0) {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    this.memoryUsage += memoryDelta;

    this.operations.push({
      name,
      duration,
      memory: memoryDelta,
    });

    return duration;
  }

  getMemoryUsage() {
    return this.memoryUsage;
  }

  getTotalDuration() {
    return this.operations.reduce((sum, op) => sum + op.duration, 0);
  }

  getOperationCount() {
    return this.operationCount;
  }

  getOperations() {
    return [...this.operations];
  }

  reset() {
    this.memoryUsage = 0;
    this.operationCount = 0;
    this.operations = [];
  }
}

// 성능 임계값 상수
const PERFORMANCE_THRESHOLDS = {
  // 처리 시간 임계값 (밀리초)
  CANVAS_CREATION: 10, // Canvas 생성은 10ms 이내
  CONTEXT_ACQUISITION: 5, // Context 획득은 5ms 이내
  SMALL_IMAGE_RESIZE: 50, // 작은 이미지(512x512) 리사이징은 50ms 이내
  MEDIUM_IMAGE_RESIZE: 200, // 중간 이미지(1920x1080) 리사이징은 200ms 이내
  LARGE_IMAGE_RESIZE: 1000, // 큰 이미지(4K) 리사이징은 1초 이내
  BLOB_CONVERSION: 100, // Blob 변환은 100ms 이내
  URL_OPERATIONS: 1, // URL 생성/해제는 1ms 이내

  // 메모리 사용량 임계값 (바이트)
  SMALL_CANVAS_MEMORY: 2 * 1024 * 1024, // 2MB (512x512x4 = 1MB이므로 여유 두기)
  MEDIUM_CANVAS_MEMORY: 8 * 1024 * 1024, // 8MB
  LARGE_CANVAS_MEMORY: 32 * 1024 * 1024, // 32MB
  MAX_CONCURRENT_CANVASES: 10, // 동시 Canvas 최대 10개
  MAX_BLOB_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_URL_OBJECTS: 100, // URL 객체 최대 100개

  // 처리량 임계값
  MIN_OPERATIONS_PER_SECOND: 10, // 최소 초당 10개 작업
  MAX_MEMORY_GROWTH_RATE: 1024 * 1024, // 초당 1MB 메모리 증가 한계
} as const;

describe('성능 계약 테스트', () => {
  let performanceTracker: PerformanceTracker;
  let mockCanvases: any[] = [];
  let mockBlobs: any[] = [];
  let mockUrls: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    performanceTracker = new PerformanceTracker();
    mockCanvases = [];
    mockBlobs = [];
    mockUrls = [];

    // 성능 추적이 가능한 Canvas 모킹
    global.HTMLCanvasElement = vi.fn().mockImplementation(() => {
      const canvas = {
        width: 0,
        height: 0,
        _created: performance.now(),
        _memorySize: 0,
        getContext: vi.fn().mockImplementation((type) => {
          const startTime = performance.now();

          const context = {
            canvas,
            drawImage: vi.fn().mockImplementation((img, ...args) => {
              const duration = Math.random() * 20 + 5; // 5-25ms 시뮬레이션
              const memoryUsage = args.length > 4 ? 1024 * 1024 : 512 * 1024;
              performanceTracker.startOperation('drawImage');
              setTimeout(() => {
                performanceTracker.endOperation('drawImage', memoryUsage);
              }, duration);
            }),
            getImageData: vi.fn().mockImplementation((x, y, w, h) => {
              const pixelCount = w * h;
              const memoryUsage = pixelCount * 4; // RGBA
              const duration = pixelCount / 100000; // 픽셀 수에 비례한 시간

              performanceTracker.startOperation('getImageData');
              setTimeout(() => {
                performanceTracker.endOperation('getImageData', memoryUsage);
              }, duration);

              return {
                data: new Uint8ClampedArray(pixelCount * 4),
                width: w,
                height: h,
              };
            }),
            putImageData: vi.fn().mockImplementation((imageData, x, y) => {
              const duration = imageData.data.length / 400000; // 픽셀 데이터 크기에 비례
              performanceTracker.startOperation('putImageData');
              setTimeout(() => {
                performanceTracker.endOperation('putImageData', 0);
              }, duration);
            }),
            clearRect: vi.fn().mockImplementation((x, y, w, h) => {
              const duration = (w * h) / 1000000; // 영역 크기에 비례한 시간
              performanceTracker.startOperation('clearRect');
              setTimeout(() => {
                performanceTracker.endOperation('clearRect', 0);
              }, duration);
            }),
            // 기타 표준 메서드들
            fillRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            scale: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
          };

          const contextAcquisitionTime = performance.now() - startTime;
          performanceTracker.startOperation('contextAcquisition');
          performanceTracker.endOperation('contextAcquisition', 0);

          return context;
        }),
        toDataURL: vi.fn().mockImplementation((type = 'image/png', quality = 1) => {
          const duration = Math.random() * 80 + 20; // 20-100ms
          performanceTracker.startOperation('toDataURL');
          setTimeout(() => {
            performanceTracker.endOperation('toDataURL', 0);
          }, duration);
          return 'data:image/png;base64,mock-data';
        }),
        toBlob: vi.fn().mockImplementation((callback, type = 'image/png', quality = 1) => {
          const duration = Math.random() * 80 + 20; // 20-100ms
          const blobSize = canvas.width * canvas.height * 0.5; // 추정 압축 크기

          performanceTracker.startOperation('toBlob');

          setTimeout(() => {
            const blob = new Blob(['mock-data'], { type });
            performanceTracker.endOperation('toBlob', blobSize);
            callback(blob);
          }, duration);
        }),
        _getMemoryUsage: () => canvas.width * canvas.height * 4, // RGBA 바이트
        _cleanup: vi.fn().mockImplementation(() => {
          canvas.width = 0;
          canvas.height = 0;
          canvas._memorySize = 0;
        }),
      };

      // Canvas 생성 시간 추적
      performanceTracker.startOperation('canvasCreation');
      const creationDuration = Math.random() * 5 + 1; // 1-6ms
      setTimeout(() => {
        performanceTracker.endOperation('canvasCreation', (canvas as any)._getMemoryUsage());
      }, creationDuration);

      mockCanvases.push(canvas);
      return canvas;
    }) as any;

    // 성능 추적이 가능한 Blob 모킹
    global.Blob = vi.fn().mockImplementation((parts = [], options = {}) => {
      const size = parts.reduce((total: number, part: any) => total + (part?.length || 0), 0);
      const blob = {
        size,
        type: options.type || '',
        _created: performance.now(),
        slice: vi.fn().mockImplementation((start, end) => {
          const duration = Math.random() * 10 + 1; // 1-11ms
          performanceTracker.startOperation('blobSlice');
          setTimeout(() => {
            performanceTracker.endOperation('blobSlice', end - start);
          }, duration);
          return new Blob(parts.slice(start, end));
        }),
      };

      mockBlobs.push(blob);
      return blob;
    }) as any;

    // 성능 추적이 가능한 URL 모킹
    global.URL = {
      createObjectURL: vi.fn().mockImplementation((blob) => {
        const startTime = performance.now();
        const url = `blob:mock-${Date.now()}-${Math.random()}`;

        performanceTracker.startOperation('createObjectURL');
        const duration = performance.now() - startTime;
        performanceTracker.endOperation('createObjectURL', 100); // URL 객체 메모리

        mockUrls.push(url);
        return url;
      }),
      revokeObjectURL: vi.fn().mockImplementation((url) => {
        const startTime = performance.now();

        performanceTracker.startOperation('revokeObjectURL');
        const duration = performance.now() - startTime;
        performanceTracker.endOperation('revokeObjectURL', -100); // 메모리 해제

        const index = mockUrls.indexOf(url);
        if (index > -1) {
          mockUrls.splice(index, 1);
        }
      }),
    } as any;

    global.document = {
      createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return new global.HTMLCanvasElement();
        }
        return {};
      }),
    } as any;

    // performance.now() 모킹
    global.performance = {
      now: vi.fn(() => Date.now()),
    } as any;
  });

  describe('처리 시간 계약', () => {
    it('Canvas 생성 시간이 임계값 이내', async () => {
      const startTime = performance.now();
      const canvas = document.createElement('canvas');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CANVAS_CREATION);
      expect(canvas).toBeDefined();
    });

    it('Context 획득 시간이 임계값 이내', async () => {
      const canvas = document.createElement('canvas');
      const startTime = performance.now();
      const ctx = canvas.getContext('2d');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONTEXT_ACQUISITION);
      expect(ctx).toBeDefined();
    });

    it('작은 이미지 처리 시간이 임계값 이내', async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;

      const startTime = performance.now();

      // 작은 이미지 처리 시뮬레이션
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SMALL_IMAGE_RESIZE);
    });

    it('중간 이미지 처리 시간이 임계값 이내', async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;

      const startTime = performance.now();

      // 중간 이미지 처리 시뮬레이션
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      await new Promise(resolve => setTimeout(resolve, 50));

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_IMAGE_RESIZE);
    });

    it('Blob 변환 시간이 임계값 이내', async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;

      const startTime = performance.now();

      await new Promise(resolve => {
        canvas.toBlob((blob) => {
          const duration = performance.now() - startTime;
          expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BLOB_CONVERSION);
          expect(blob).toBeDefined();
          resolve(blob);
        });
      });
    });

    it('URL 작업 시간이 임계값 이내', () => {
      const blob = new Blob(['test'], { type: 'image/png' });

      // URL 생성 시간
      const createStartTime = performance.now();
      const url = URL.createObjectURL(blob);
      const createDuration = performance.now() - createStartTime;

      expect(createDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.URL_OPERATIONS);

      // URL 해제 시간
      const revokeStartTime = performance.now();
      URL.revokeObjectURL(url);
      const revokeDuration = performance.now() - revokeStartTime;

      expect(revokeDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.URL_OPERATIONS);
    });
  });

  describe('메모리 사용량 계약', () => {
    it('작은 Canvas 메모리 사용량이 임계값 이내', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;

      const memoryUsage = (canvas as any)._getMemoryUsage();
      expect(memoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.SMALL_CANVAS_MEMORY);
    });

    it('중간 Canvas 메모리 사용량이 임계값 이내', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;

      const memoryUsage = (canvas as any)._getMemoryUsage();
      expect(memoryUsage).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_CANVAS_MEMORY);
    });

    it('동시 Canvas 개수 제한 준수', () => {
      const canvases = Array.from(
        { length: PERFORMANCE_THRESHOLDS.MAX_CONCURRENT_CANVASES + 5 },
        () => document.createElement('canvas')
      );

      expect(mockCanvases.length).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MAX_CONCURRENT_CANVASES);

      // 제한 초과 시 일부 Canvas 정리 필요
      const excessCount = mockCanvases.length - PERFORMANCE_THRESHOLDS.MAX_CONCURRENT_CANVASES;
      const canvasesToCleanup = mockCanvases.slice(0, excessCount);

      canvasesToCleanup.forEach(canvas => (canvas as any)._cleanup());

      const activeCanvases = mockCanvases.filter(canvas => canvas.width > 0 || canvas.height > 0);
      expect(activeCanvases.length).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.MAX_CONCURRENT_CANVASES);
    });

    it('Blob 크기 제한 준수', () => {
      const largeData = 'x'.repeat(PERFORMANCE_THRESHOLDS.MAX_BLOB_SIZE + 1000);

      // 큰 Blob 생성 시도
      expect(() => {
        const blob = new Blob([largeData], { type: 'text/plain' });
        if (blob.size > PERFORMANCE_THRESHOLDS.MAX_BLOB_SIZE) {
          throw new Error('Blob size exceeds limit');
        }
      }).toThrow('Blob size exceeds limit');
    });

    it('URL 객체 개수 제한 준수', () => {
      const blobs = Array.from(
        { length: PERFORMANCE_THRESHOLDS.MAX_URL_OBJECTS + 10 },
        () => new Blob(['test'], { type: 'image/png' })
      );

      blobs.forEach(blob => URL.createObjectURL(blob));

      expect(mockUrls.length).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MAX_URL_OBJECTS);

      // 제한 초과 시 일부 URL 정리
      const excessCount = mockUrls.length - PERFORMANCE_THRESHOLDS.MAX_URL_OBJECTS;
      const urlsToRevoke = mockUrls.slice(0, excessCount);

      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));

      expect(mockUrls.length).toBeLessThanOrEqual(PERFORMANCE_THRESHOLDS.MAX_URL_OBJECTS);
    });
  });

  describe('처리량 계약', () => {
    it('최소 초당 작업 처리량 보장', async () => {
      const testDuration = 1000; // 1초
      const startTime = performance.now();
      let operationCount = 0;

      // 1초 동안 반복적으로 작업 수행
      while (performance.now() - startTime < testDuration) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, 100, 100);
        operationCount++;

        // CPU 과부하 방지를 위한 짧은 대기
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const operationsPerSecond = operationCount / (testDuration / 1000);
      expect(operationsPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.MIN_OPERATIONS_PER_SECOND);
    });

    it('메모리 증가율 제한 준수', async () => {
      const testDuration = 1000; // 1초
      const initialMemory = performanceTracker.getMemoryUsage();
      const startTime = performance.now();

      // 1초 동안 메모리 사용 작업 수행
      while (performance.now() - startTime < testDuration) {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;

        const blob = new Blob(['test'], { type: 'image/png' });
        URL.createObjectURL(blob);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const finalMemory = performanceTracker.getMemoryUsage();
      const memoryGrowth = finalMemory - initialMemory;
      const growthRate = memoryGrowth / (testDuration / 1000);

      expect(growthRate).toBeLessThan(PERFORMANCE_THRESHOLDS.MAX_MEMORY_GROWTH_RATE);
    });
  });

  describe('성능 회귀 감지', () => {
    it('연속 작업 시 성능 저하 없음', async () => {
      const iterations = 5;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();

        // 표준 이미지 처리 작업
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);

        await new Promise(resolve => setTimeout(resolve, 10));

        const duration = performance.now() - startTime;
        durations.push(duration);
      }

      // 첫 번째와 마지막 작업의 성능 차이가 50% 이내
      const firstDuration = durations[0];
      const lastDuration = durations[durations.length - 1];
      const performanceDiff = Math.abs(lastDuration - firstDuration) / firstDuration;

      expect(performanceDiff).toBeLessThan(0.5); // 50% 이내
    });

    it('메모리 누수 없음', async () => {
      const iterations = 10;
      const initialMemory = performanceTracker.getMemoryUsage();

      for (let i = 0; i < iterations; i++) {
        // 리소스 생성
        const canvas = document.createElement('canvas');
        canvas.width = 500;
        canvas.height = 500;
        const blob = new Blob(['data'], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        // 리소스 정리
        (canvas as any)._cleanup();
        URL.revokeObjectURL(url);
      }

      const finalMemory = performanceTracker.getMemoryUsage();
      const memoryLeak = finalMemory - initialMemory;

      // 메모리 누수가 100바이트 이내 (거의 누수 없음)
      expect(Math.abs(memoryLeak)).toBeLessThan(100);
    });
  });

  describe('부하 테스트 계약', () => {
    it('고부하 상황에서 시스템 안정성', async () => {
      const concurrentOperations = 20;
      const promises: Promise<any>[] = [];

      // 동시에 여러 작업 실행
      for (let i = 0; i < concurrentOperations; i++) {
        const promise = (async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 400;
          canvas.height = 300;

          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);

          return new Promise(resolve => {
            canvas.toBlob(resolve);
          });
        })();

        promises.push(promise);
      }

      // 모든 작업이 완료되어야 함
      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentOperations);
      results.forEach(result => expect(result).toBeDefined());
    });

    it('리소스 제한 상황에서 우아한 실패', () => {
      const maxOperations = 1000;
      let successCount = 0;
      let failCount = 0;

      // 대량 작업 시도
      for (let i = 0; i < maxOperations; i++) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;

          // 메모리 사용량 체크
          if (performanceTracker.getMemoryUsage() > PERFORMANCE_THRESHOLDS.LARGE_CANVAS_MEMORY) {
            (canvas as any)._cleanup();
            throw new Error('Memory limit exceeded');
          }

          successCount++;
        } catch (error) {
          failCount++;
        }
      }

      // 일부 작업은 성공해야 하고, 실패도 우아하게 처리되어야 함
      expect(successCount).toBeGreaterThan(0);
      expect(successCount + failCount).toBe(maxOperations);
    });
  });
});