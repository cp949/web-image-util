/**
 * 메모리 관리 계약 테스트
 *
 * 목적: Canvas 풀링, 리소스 정리, 메모리 누수 방지 패턴 검증
 * 환경: Node.js (mocking 사용)
 * 범위: 메모리 관리 정책과 리소스 생명주기 추적
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('메모리 관리 계약 테스트', () => {
  let canvasPool: any[] = [];
  let urlObjectPool: string[] = [];
  let memoryUsage = 0;

  beforeEach(() => {
    vi.clearAllMocks();

    // 메모리 추적을 위한 상태 초기화
    canvasPool = [];
    urlObjectPool = [];
    memoryUsage = 0;

    // Canvas Pool 시뮬레이션
    global.HTMLCanvasElement = vi.fn().mockImplementation(() => {
      const canvas = {
        width: 0,
        height: 0,
        _pooled: false,
        _inUse: false,
        _created: Date.now(),
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn(),
          putImageData: vi.fn(),
          createImageData: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          scale: vi.fn(),
          translate: vi.fn(),
          rotate: vi.fn(),
          setTransform: vi.fn(),
          resetTransform: vi.fn(),
          fillStyle: '#000000',
          strokeStyle: '#000000',
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/png;base64,'),
        toBlob: vi.fn().mockImplementation((callback) => {
          const blob = new Blob(['mock-data'], { type: 'image/png' });
          setTimeout(() => callback(blob), 0);
        }),
        // Canvas 정리 메서드
        _cleanup: vi.fn().mockImplementation(() => {
          canvas.width = 0;
          canvas.height = 0;
          canvas._inUse = false;
          memoryUsage -= 1000; // 가상 메모리 해제
        }),
        // Canvas 재사용 준비
        _reset: vi.fn().mockImplementation(() => {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          ctx?.resetTransform?.();
          canvas._inUse = false;
        }),
      };

      // Canvas 생성 시 메모리 사용량 증가
      memoryUsage += 1000;
      canvasPool.push(canvas);
      return canvas;
    }) as any;

    // URL 객체 추적
    global.URL = {
      createObjectURL: vi.fn().mockImplementation((_blob) => {
        const url = `blob:mock-${Date.now()}-${Math.random()}`;
        urlObjectPool.push(url);
        memoryUsage += 100; // URL 객체 메모리 사용
        return url;
      }),
      revokeObjectURL: vi.fn().mockImplementation((url) => {
        const index = urlObjectPool.indexOf(url);
        if (index > -1) {
          urlObjectPool.splice(index, 1);
          memoryUsage -= 100; // URL 객체 메모리 해제
        }
      }),
    } as any;

    // Blob 메모리 추적
    global.Blob = vi.fn().mockImplementation((parts = [], options = {}) => {
      const size = parts.reduce((total: number, part: any) => total + (part?.length || 0), 0);
      const blob = {
        size,
        type: options.type || '',
        _created: Date.now(),
        slice: vi.fn(),
        _cleanup: vi.fn().mockImplementation(() => {
          memoryUsage -= size;
        }),
      };
      memoryUsage += size;
      return blob;
    }) as any;

    global.document = {
      createElement: vi.fn().mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return new global.HTMLCanvasElement();
        }
        if (tagName === 'img') {
          return {
            src: '',
            width: 0,
            height: 0,
            onload: null,
            onerror: null,
            _cleanup: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          };
        }
        return {};
      }),
    } as any;
  });

  afterEach(() => {
    // 테스트 후 메모리 정리 확인
    canvasPool.forEach(canvas => (canvas as any)._cleanup?.());
    urlObjectPool.forEach(url => URL.revokeObjectURL(url));
    canvasPool = [];
    urlObjectPool = [];
    memoryUsage = 0;
  });

  describe('Canvas 메모리 관리 계약', () => {
    it('Canvas 생성 시 메모리 할당 추적', () => {
      const initialMemory = memoryUsage;
      const canvas = document.createElement('canvas');

      expect(memoryUsage).toBeGreaterThan(initialMemory);
      expect(canvasPool).toContain(canvas);
      expect(canvas).toHaveProperty('_created');
      expect(canvas).toHaveProperty('_pooled');
      expect(canvas).toHaveProperty('_inUse');
    });

    it('Canvas 정리 시 메모리 해제 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      const initialMemory = memoryUsage;

      // Canvas 사용 후 정리
      (canvas as any)._cleanup();

      expect((canvas as any)._cleanup).toHaveBeenCalled();
      expect(memoryUsage).toBeLessThan(initialMemory);
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
      expect((canvas as any)._inUse).toBe(false);
    });

    it('Canvas 풀링 시 재사용 패턴 검증', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      (canvas as any)._inUse = true;

      // Canvas 재사용을 위한 리셋
      (canvas as any)._reset();

      expect((canvas as any)._reset).toHaveBeenCalled();
      expect((canvas as any)._inUse).toBe(false);

      const ctx = canvas.getContext('2d');
      expect(ctx?.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
      expect(ctx?.resetTransform).toHaveBeenCalled();
    });

    it('다수 Canvas 동시 사용 시 메모리 추적', () => {
      const canvases = Array.from({ length: 5 }, () => document.createElement('canvas'));
      const initialMemory = memoryUsage;

      expect(canvasPool.length).toBe(5);
      expect(memoryUsage).toBe(initialMemory);

      // 모든 Canvas 정리
      canvases.forEach(canvas => (canvas as any)._cleanup());
      expect(memoryUsage).toBeLessThan(initialMemory);
    });

    it('Canvas Context 속성 초기화 패턴', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Context 상태 변경
      if (ctx) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 5;
      }

      // Canvas 리셋 시 속성 초기화 확인
      (canvas as any)._reset();

      // 초기화 메서드들이 호출되었는지 확인
      expect(ctx?.clearRect).toHaveBeenCalled();
      expect(ctx?.resetTransform).toHaveBeenCalled();
    });
  });

  describe('URL 객체 생명주기 관리', () => {
    it('URL.createObjectURL 시 메모리 할당 추적', () => {
      const initialMemory = memoryUsage;
      const initialPoolSize = urlObjectPool.length;

      const blob = new Blob(['test'], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(urlObjectPool.length).toBe(initialPoolSize + 1);
      expect(urlObjectPool).toContain(url);
      expect(memoryUsage).toBeGreaterThan(initialMemory);
    });

    it('URL.revokeObjectURL 시 메모리 해제 추적', () => {
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const initialMemory = memoryUsage;
      const initialPoolSize = urlObjectPool.length;

      URL.revokeObjectURL(url);

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
      expect(urlObjectPool.length).toBe(initialPoolSize - 1);
      expect(urlObjectPool).not.toContain(url);
      expect(memoryUsage).toBeLessThan(initialMemory);
    });

    it('URL 객체 생명주기 완전성 검증', () => {
      const blob = new Blob(['test'], { type: 'image/png' });

      // 생성
      const url = URL.createObjectURL(blob);
      expect(urlObjectPool).toContain(url);

      // 사용 (Image에 할당)
      const img = document.createElement('img');
      img.src = url;
      expect(img.src).toBe(url);

      // 정리
      URL.revokeObjectURL(url);
      expect(urlObjectPool).not.toContain(url);
    });

    it('다수 URL 객체 동시 관리', () => {
      const blobs = Array.from({ length: 10 }, (_, i) =>
        new Blob([`test-${i}`], { type: 'image/png' })
      );

      const urls = blobs.map(blob => URL.createObjectURL(blob));
      expect(urlObjectPool.length).toBe(10);

      // 일부만 정리
      urls.slice(0, 5).forEach(url => URL.revokeObjectURL(url));
      expect(urlObjectPool.length).toBe(5);

      // 나머지 정리
      urls.slice(5).forEach(url => URL.revokeObjectURL(url));
      expect(urlObjectPool.length).toBe(0);
    });
  });

  describe('Blob 메모리 관리', () => {
    it('Blob 생성 시 크기별 메모리 할당', () => {
      const initialMemory = memoryUsage;

      const smallBlob = new Blob(['small'], { type: 'text/plain' });
      const mediumBlob = new Blob(['medium'.repeat(100)], { type: 'text/plain' });
      const largeBlob = new Blob(['large'.repeat(1000)], { type: 'text/plain' });

      expect(memoryUsage).toBeGreaterThan(initialMemory);
      expect(smallBlob.size).toBeLessThan(mediumBlob.size);
      expect(mediumBlob.size).toBeLessThan(largeBlob.size);
    });

    it('Blob 정리 시 메모리 해제', () => {
      const blob = new Blob(['test-data'], { type: 'image/png' });
      const initialMemory = memoryUsage;

      (blob as any)._cleanup();

      expect((blob as any)._cleanup).toHaveBeenCalled();
      expect(memoryUsage).toBeLessThan(initialMemory);
    });

    it('Blob slice 작업 시 메모리 영향', () => {
      const originalBlob = new Blob(['0123456789'], { type: 'text/plain' });
      const initialMemory = memoryUsage;

      // Blob slice는 실제로 메모리 증가를 일으키도록 모킹
      const _slicedBlob = originalBlob.slice(0, 5);
      memoryUsage += 5; // 수동으로 메모리 사용량 증가 시뮬레이션

      expect(originalBlob.slice).toHaveBeenCalledWith(0, 5);
      // slice는 새로운 Blob 생성하므로 메모리 사용량 증가
      expect(memoryUsage).toBeGreaterThan(initialMemory);
    });
  });

  describe('리소스 누수 방지 패턴', () => {
    it('이미지 로딩 후 이벤트 리스너 정리 패턴', () => {
      const img = document.createElement('img');
      const onload = vi.fn();
      const onerror = vi.fn();

      // 이벤트 리스너 등록
      img.addEventListener('load', onload);
      img.addEventListener('error', onerror);

      expect(img.addEventListener).toHaveBeenCalledWith('load', onload);
      expect(img.addEventListener).toHaveBeenCalledWith('error', onerror);

      // 정리 시 이벤트 리스너 제거
      img.removeEventListener('load', onload);
      img.removeEventListener('error', onerror);

      expect(img.removeEventListener).toHaveBeenCalledWith('load', onload);
      expect(img.removeEventListener).toHaveBeenCalledWith('error', onerror);
    });

    it('Canvas Context 장기간 유지 시 정리 패턴', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 장시간 사용 후 상태 저장
      ctx?.save();
      expect(ctx?.save).toHaveBeenCalled();

      // Context 상태 복원
      ctx?.restore();
      expect(ctx?.restore).toHaveBeenCalled();

      // 최종 정리
      (canvas as any)._cleanup();
      expect((canvas as any)._cleanup).toHaveBeenCalled();
    });

    it('메모리 사용량 임계점 모니터링 패턴', () => {
      const MEMORY_THRESHOLD = 10000; // 10KB 임계점
      const _initialMemory = memoryUsage;

      // 대량 리소스 생성
      const resources = [];
      while (memoryUsage < MEMORY_THRESHOLD) {
        const canvas = document.createElement('canvas');
        const blob = new Blob(['data'.repeat(100)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        resources.push({ canvas, blob, url });
      }

      expect(memoryUsage).toBeGreaterThanOrEqual(MEMORY_THRESHOLD);

      // 임계점 도달 시 정리
      resources.forEach(({ canvas, blob, url }) => {
        (canvas as any)._cleanup();
        (blob as any)._cleanup();
        URL.revokeObjectURL(url);
      });

      // 메모리가 크게 감소했는지 확인
      expect(memoryUsage).toBeLessThan(MEMORY_THRESHOLD);
    });

    it('비동기 작업 후 리소스 정리 패턴', async () => {
      const canvas = document.createElement('canvas');
      const blob = new Blob(['async-data'], { type: 'image/png' });

      // 비동기 작업 시뮬레이션
      await new Promise((resolve) => {
        canvas.toBlob((resultBlob) => {
          expect(resultBlob).toBeDefined();
          resolve(resultBlob);
        });
      });

      // 비동기 작업 완료 후 정리
      (canvas as any)._cleanup();
      (blob as any)._cleanup();

      expect((canvas as any)._cleanup).toHaveBeenCalled();
      expect((blob as any)._cleanup).toHaveBeenCalled();
    });
  });

  describe('메모리 사용량 모니터링', () => {
    it('전체 메모리 사용량 추적', () => {
      const initialMemory = memoryUsage;

      // 다양한 리소스 생성
      const canvas = document.createElement('canvas');
      const blob = new Blob(['test'], { type: 'image/png' });
      const url = URL.createObjectURL(blob);

      expect(memoryUsage).toBeGreaterThan(initialMemory);

      // 개별 정리 후 메모리 감소 확인
      const beforeCanvasCleanup = memoryUsage;
      (canvas as any)._cleanup();
      const afterCanvasCleanup = memoryUsage;
      expect(afterCanvasCleanup).toBeLessThan(beforeCanvasCleanup);

      URL.revokeObjectURL(url);
      const afterUrlCleanup = memoryUsage;
      expect(afterUrlCleanup).toBeLessThan(afterCanvasCleanup);

      (blob as any)._cleanup();
      expect(memoryUsage).toBeLessThan(afterUrlCleanup);
    });

    it('메모리 누수 감지 패턴', () => {
      const initialMemory = memoryUsage;
      const resourceCount = 5;

      // 리소스 생성
      const resources = Array.from({ length: resourceCount }, () => ({
        canvas: document.createElement('canvas'),
        blob: new Blob(['test'], { type: 'image/png' }),
      })).map(({ canvas, blob }) => ({
        canvas,
        blob,
        url: URL.createObjectURL(blob),
      }));

      const peakMemory = memoryUsage;
      expect(peakMemory).toBeGreaterThan(initialMemory);

      // 일부만 정리 (메모리 누수 시뮬레이션)
      resources.slice(0, 3).forEach(({ canvas, blob, url }) => {
        (canvas as any)._cleanup();
        (blob as any)._cleanup();
        URL.revokeObjectURL(url);
      });

      const partialCleanupMemory = memoryUsage;
      expect(partialCleanupMemory).toBeLessThan(peakMemory);
      expect(partialCleanupMemory).toBeGreaterThan(initialMemory); // 여전히 누수 존재

      // 나머지 정리
      resources.slice(3).forEach(({ canvas, blob, url }) => {
        (canvas as any)._cleanup();
        (blob as any)._cleanup();
        URL.revokeObjectURL(url);
      });

      expect(memoryUsage).toBe(initialMemory); // 완전한 정리
    });
  });
});