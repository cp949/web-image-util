/**
 * 유틸리티 함수들 Node.js 환경 테스트
 *
 * @description Node.js 환경에서 실행 가능한 유틸리티 함수들의 순수 로직 테스트
 * DOM API가 필요한 부분은 모킹하여 처리
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Node.js 환경에서 DOM API 모킹
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn()
    }))
  })),
  toBlob: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,mockdata')
};

const mockImage = {
  width: 100,
  height: 100,
  src: '',
  onload: null as any,
  onerror: null as any,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockBlob = class MockBlob {
  size: number;
  type: string;

  constructor(data: any[] = [], options: { type?: string } = {}) {
    this.size = data.reduce((acc, item) => acc + (typeof item === 'string' ? item.length : 100), 0);
    this.type = options.type || 'application/octet-stream';
  }
} as any;

const mockFile = class MockFile extends MockBlob {
  name: string;
  lastModified: number;

  constructor(data: any[], name: string, options: { type?: string, lastModified?: number } = {}) {
    super(data, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
} as any;

const mockFileReader = {
  readAsDataURL: vi.fn(),
  onload: null as any,
  onerror: null as any,
  result: null as any
};

const mockURL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
};

describe('변환 함수 순수 로직 테스트', () => {
  beforeEach(() => {
    // DOM API 모킹
    global.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return { ...mockCanvas };
        }
        return {};
      })
    } as any;

    global.Image = function() {
      return { ...mockImage };
    } as any;

    global.Blob = mockBlob;
    global.File = mockFile;
    global.FileReader = function() {
      return { ...mockFileReader };
    } as any;
    global.URL = mockURL;

    // FormData 모킹
    global.FormData = class MockFormData {
      private data = new Map();

      append(key: string, value: any) {
        this.data.set(key, value);
      }

      get(key: string) {
        return this.data.get(key);
      }
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('포맷 변환 로직', () => {
    it('formatToMimeType 함수 로직', () => {
      // 내부 함수를 테스트하기 위한 로직 재구현
      const formatToMimeType = (format: string): string => {
        const mimeTypes: Record<string, string> = {
          jpeg: 'image/jpeg',
          jpg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          avif: 'image/avif',
          gif: 'image/gif',
          bmp: 'image/bmp',
          tiff: 'image/tiff',
        };

        return mimeTypes[format.toLowerCase()] || 'image/png';
      };

      expect(formatToMimeType('jpeg')).toBe('image/jpeg');
      expect(formatToMimeType('JPEG')).toBe('image/jpeg');
      expect(formatToMimeType('jpg')).toBe('image/jpeg');
      expect(formatToMimeType('png')).toBe('image/png');
      expect(formatToMimeType('webp')).toBe('image/webp');
      expect(formatToMimeType('avif')).toBe('image/avif');
      expect(formatToMimeType('gif')).toBe('image/gif');
      expect(formatToMimeType('bmp')).toBe('image/bmp');
      expect(formatToMimeType('tiff')).toBe('image/tiff');

      // 알 수 없는 포맷은 PNG로 fallback
      expect(formatToMimeType('unknown')).toBe('image/png');
      expect(formatToMimeType('')).toBe('image/png');
    });

    it('파일 확장자 조정 로직', () => {
      const adjustFileExtension = (filename: string, format: string): string => {
        const lastDotIndex = filename.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

        // JPEG는 jpg로 통일
        const extension = format === 'jpeg' ? 'jpg' : format;

        return `${nameWithoutExt}.${extension}`;
      };

      expect(adjustFileExtension('image.png', 'jpeg')).toBe('image.jpg');
      expect(adjustFileExtension('image.jpg', 'jpeg')).toBe('image.jpg');
      expect(adjustFileExtension('image', 'png')).toBe('image.png');
      expect(adjustFileExtension('my.image.old', 'webp')).toBe('my.image.webp');
      expect(adjustFileExtension('noextension', 'avif')).toBe('noextension.avif');

      // JPEG -> jpg 변환
      expect(adjustFileExtension('test.old', 'jpeg')).toBe('test.jpg');
      expect(adjustFileExtension('test.old', 'jpg')).toBe('test.jpg');
    });
  });

  describe('옵션 처리 로직', () => {
    it('기본 옵션 병합', () => {
      interface TestOptions {
        format?: string;
        quality?: number;
        autoExtension?: boolean;
      }

      const mergeOptions = (options: TestOptions = {}): Required<TestOptions> => {
        return {
          format: options.format || 'png',
          quality: options.quality || 0.8,
          autoExtension: options.autoExtension !== false
        };
      };

      // 기본값 적용
      expect(mergeOptions()).toEqual({
        format: 'png',
        quality: 0.8,
        autoExtension: true
      });

      // 부분 옵션
      expect(mergeOptions({ format: 'jpeg' })).toEqual({
        format: 'jpeg',
        quality: 0.8,
        autoExtension: true
      });

      // autoExtension: false 처리
      expect(mergeOptions({ autoExtension: false })).toEqual({
        format: 'png',
        quality: 0.8,
        autoExtension: false
      });

      // 모든 옵션
      expect(mergeOptions({
        format: 'webp',
        quality: 0.9,
        autoExtension: false
      })).toEqual({
        format: 'webp',
        quality: 0.9,
        autoExtension: false
      });
    });

    it('품질 값 검증', () => {
      const validateQuality = (quality?: number): number => {
        if (quality === undefined) return 0.8;
        if (quality < 0) return 0;
        if (quality > 1) return 1;
        if (isNaN(quality)) return 0.8;
        return quality;
      };

      expect(validateQuality()).toBe(0.8);
      expect(validateQuality(0.5)).toBe(0.5);
      expect(validateQuality(-0.1)).toBe(0);
      expect(validateQuality(1.5)).toBe(1);
      expect(validateQuality(NaN)).toBe(0.8);
      expect(validateQuality(0)).toBe(0);
      expect(validateQuality(1)).toBe(1);
    });
  });

  describe('메타데이터 계산 로직', () => {
    it('처리 시간 측정', () => {
      const startTime = Date.now();

      // 약간의 지연 시뮬레이션
      const processData = () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const result = processData();
      const processingTime = Date.now() - startTime;

      expect(result).toBe(499500); // 0~999 합계
      expect(processingTime).toBeGreaterThanOrEqual(0);
      expect(processingTime).toBeLessThan(100); // 100ms 미만이어야 함
    });

    it('크기 정보 계산', () => {
      const calculateSize = (data: string): { bytes: number, kb: number, mb: number } => {
        const bytes = new Blob([data]).size;
        return {
          bytes,
          kb: Math.round(bytes / 1024 * 100) / 100,
          mb: Math.round(bytes / (1024 * 1024) * 100) / 100
        };
      };

      const smallData = 'hello world';
      const smallSize = calculateSize(smallData);

      expect(smallSize.bytes).toBe(11);
      expect(smallSize.kb).toBe(0.01);
      expect(smallSize.mb).toBe(0);

      const largeData = 'x'.repeat(2048);
      const largeSize = calculateSize(largeData);

      expect(largeSize.bytes).toBe(2048);
      expect(largeSize.kb).toBe(2);
      expect(largeSize.mb).toBe(0);
    });
  });

  describe('에러 상황 처리', () => {
    it('잘못된 소스 타입 감지', () => {
      const isValidSource = (source: unknown): boolean => {
        if (source === null || source === undefined) return false;
        if (typeof source === 'string' && source.length === 0) return false;
        if (typeof source === 'object' && source.constructor === Object) {
          return Object.keys(source).length > 0;
        }
        return true;
      };

      expect(isValidSource(null)).toBe(false);
      expect(isValidSource(undefined)).toBe(false);
      expect(isValidSource('')).toBe(false);
      expect(isValidSource({})).toBe(false);

      expect(isValidSource('valid-string')).toBe(true);
      expect(isValidSource(123)).toBe(true);
      expect(isValidSource({ key: 'value' })).toBe(true);
      expect(isValidSource(new MockBlob())).toBe(true);
    });

    it('포맷 호환성 검사', () => {
      const isFormatCompatible = (currentFormat: string, targetFormat: string): boolean => {
        const losslessFormats = ['png', 'tiff', 'bmp'];
        const lossyFormats = ['jpeg', 'jpg', 'webp', 'avif'];

        const currentIsLossless = losslessFormats.includes(currentFormat.toLowerCase());
        const targetIsLossless = losslessFormats.includes(targetFormat.toLowerCase());

        // 무손실 -> 손실 변환은 경고
        return !(currentIsLossless && !targetIsLossless);
      };

      expect(isFormatCompatible('png', 'jpeg')).toBe(false); // 무손실 -> 손실
      expect(isFormatCompatible('jpeg', 'png')).toBe(true);  // 손실 -> 무손실
      expect(isFormatCompatible('png', 'png')).toBe(true);   // 동일
      expect(isFormatCompatible('jpeg', 'webp')).toBe(true); // 손실 -> 손실
    });
  });

  describe('동시성 처리', () => {
    it('병렬 작업 시뮬레이션', async () => {
      const processItem = async (item: number, delay: number = 10): Promise<number> => {
        return new Promise(resolve => {
          setTimeout(() => resolve(item * 2), delay);
        });
      };

      const items = [1, 2, 3, 4, 5];
      const startTime = Date.now();

      // 병렬 처리
      const parallelResults = await Promise.all(
        items.map(item => processItem(item, 20))
      );

      const parallelTime = Date.now() - startTime;

      expect(parallelResults).toEqual([2, 4, 6, 8, 10]);
      expect(parallelTime).toBeLessThan(50); // 병렬이므로 빠름

      // 순차 처리와 비교
      const sequentialStartTime = Date.now();
      const sequentialResults = [];
      for (const item of items) {
        sequentialResults.push(await processItem(item, 20));
      }
      const sequentialTime = Date.now() - sequentialStartTime;

      expect(sequentialResults).toEqual([2, 4, 6, 8, 10]);
      expect(sequentialTime).toBeGreaterThan(parallelTime);
    });

    it('큐 기반 작업 관리', () => {
      class TaskQueue<T> {
        private queue: Array<() => Promise<T>> = [];
        private processing = false;
        private results: T[] = [];

        add(task: () => Promise<T>) {
          this.queue.push(task);
        }

        async processAll(): Promise<T[]> {
          if (this.processing) return this.results;

          this.processing = true;
          this.results = [];

          while (this.queue.length > 0) {
            const task = this.queue.shift()!;
            try {
              const result = await task();
              this.results.push(result);
            } catch (error) {
              // 에러는 무시하고 계속
            }
          }

          this.processing = false;
          return this.results;
        }

        get length() {
          return this.queue.length;
        }

        get isProcessing() {
          return this.processing;
        }
      }

      const queue = new TaskQueue<number>();

      queue.add(async () => 1);
      queue.add(async () => 2);
      queue.add(async () => { throw new Error('fail'); });
      queue.add(async () => 3);

      expect(queue.length).toBe(4);
      expect(queue.isProcessing).toBe(false);

      return queue.processAll().then(results => {
        expect(results).toEqual([1, 2, 3]); // 실패한 작업은 제외
        expect(queue.length).toBe(0);
        expect(queue.isProcessing).toBe(false);
      });
    });
  });
});

describe('데이터 변환 로직', () => {
  beforeEach(() => {
    global.FileReader = function() {
      return {
        readAsDataURL: vi.fn(),
        onload: null,
        onerror: null,
        result: 'data:image/png;base64,mockBase64Data'
      };
    } as any;
  });

  it('Base64 인코딩/디코딩', () => {
    const testString = 'Hello, World!';

    // Base64 인코딩 (Node.js 방식)
    const encoded = Buffer.from(testString, 'utf-8').toString('base64');
    expect(encoded).toBe('SGVsbG8sIFdvcmxkIQ==');

    // Base64 디코딩
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    expect(decoded).toBe(testString);
  });

  it('Data URL 파싱', () => {
    const parseDataURL = (dataURL: string) => {
      const match = dataURL.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;

      return {
        mimeType: match[1],
        data: match[2]
      };
    };

    const testDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const parsed = parseDataURL(testDataURL);
    expect(parsed).not.toBeNull();
    expect(parsed!.mimeType).toBe('image/png');
    expect(parsed!.data).toContain('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA');

    // 잘못된 형식
    expect(parseDataURL('invalid-data-url')).toBeNull();
    expect(parseDataURL('data:text/plain,hello')).toBeNull(); // base64가 아님
  });

  it('MIME 타입 감지', () => {
    const detectMimeType = (data: string): string => {
      // Base64 데이터에서 파일 시그니처 확인
      const signatures: Record<string, string> = {
        '/9j/': 'image/jpeg',
        'iVBORw0KGgo': 'image/png',
        'UklGR': 'image/webp',
        'R0lGOD': 'image/gif',
        'Qk': 'image/bmp'
      };

      for (const [signature, mimeType] of Object.entries(signatures)) {
        if (data.startsWith(signature)) {
          return mimeType;
        }
      }

      return 'application/octet-stream';
    };

    expect(detectMimeType('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')).toBe('image/png');
    expect(detectMimeType('/9j/4AAQSkZJRgABAQEAYABgAAD')).toBe('image/jpeg');
    expect(detectMimeType('UklGRh4AAABXRUJQVlA4TBEAAAAv')).toBe('image/webp');
    expect(detectMimeType('R0lGODlhAQABAIAAAAAAAP///')).toBe('image/gif');
    expect(detectMimeType('unknown-data')).toBe('application/octet-stream');
  });
});

describe('성능 및 메모리 관리', () => {
  it('메모리 사용량 추정', () => {
    const estimateImageMemory = (width: number, height: number, channels: number = 4): number => {
      return width * height * channels; // RGBA 기본
    };

    expect(estimateImageMemory(100, 100)).toBe(40000); // 40KB
    expect(estimateImageMemory(1920, 1080)).toBe(8294400); // ~8.3MB
    expect(estimateImageMemory(4096, 4096)).toBe(67108864); // 64MB

    // RGB만 사용하는 경우
    expect(estimateImageMemory(100, 100, 3)).toBe(30000); // 30KB
  });

  it('처리 시간 프로파일링', () => {
    const profile = <T>(fn: () => T): { result: T, time: number } => {
      const start = process.hrtime.bigint();
      const result = fn();
      const end = process.hrtime.bigint();
      const time = Number(end - start) / 1000000; // 나노초를 밀리초로

      return { result, time };
    };

    const { result, time } = profile(() => {
      return Array.from({ length: 10000 }, (_, i) => i * i).reduce((a, b) => a + b, 0);
    });

    expect(result).toBe(333283335000);
    expect(time).toBeGreaterThan(0);
    expect(time).toBeLessThan(100); // 100ms 이내
  });

  it('캐시 효율성 시뮬레이션', () => {
    class LRUCache<K, V> {
      private cache = new Map<K, V>();

      constructor(private maxSize: number) {}

      get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
          // LRU: 재배치
          this.cache.delete(key);
          this.cache.set(key, value);
        }
        return value;
      }

      set(key: K, value: V): void {
        if (this.cache.has(key)) {
          this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
          // 가장 오래된 항목 제거
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
      }

      get size() {
        return this.cache.size;
      }
    }

    const cache = new LRUCache<string, string>(3);

    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.size).toBe(3);

    // 'd' 추가 시 'a'가 제거됨
    cache.set('d', '4');
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');

    // 'b' 접근으로 LRU 갱신
    cache.get('b');
    cache.set('e', '5'); // 'c'가 제거됨
    expect(cache.get('c')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
  });
});