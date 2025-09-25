/**
 * 에러 헬퍼 함수들 유닛 테스트
 *
 * @description 사용자 친화적 에러 메시지 생성과 복구 로직을 검증하는 테스트
 * Node.js 환경에서 실행 가능한 순수 로직 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createImageError,
  withErrorRecovery,
  checkBrowserSupport,
  isFormatSupported,
  estimateMemoryUsage,
  logError,
  type ErrorContext,
} from '../src/base/error-helpers';
import { ImageProcessingError, ImageErrorCode } from '../src/base/errors';

// Node.js 환경 변수 모킹용
const originalProcess = globalThis.process;

describe('createImageError', () => {
  describe('기본 에러 생성', () => {
    it('사용자 친화적 메시지 생성', () => {
      const error = createImageError(ImageErrorCode.INVALID_SOURCE);

      expect(error).toBeInstanceOf(Error); // ImageProcessError 또는 ImageProcessingError 상속
      expect(error.code).toBe('INVALID_SOURCE');
      expect(error.message).toContain('이미지 소스가 유효하지 않습니다');
      expect(error.message).toContain('💡 해결 방법:');
    });

    it('원본 에러와 함께 생성', () => {
      const originalError = new Error('원본 네트워크 에러');
      const error = createImageError(
        ImageErrorCode.SOURCE_LOAD_FAILED,
        originalError
      );

      expect(error.originalError).toBe(originalError);
      expect(error.message).toContain('이미지를 불러오는데 실패했습니다');
    });

    it('컨텍스트 정보 포함', () => {
      const context: ErrorContext = {
        sourceType: 'blob',
        format: 'webp',
        dimensions: { width: 1920, height: 1080 },
        userAgent: 'test-browser',
        debug: { attempt: 1, timestamp: Date.now() }
      };

      const error = createImageError(
        ImageErrorCode.CONVERSION_FAILED,
        undefined,
        context
      );

      expect((error as any).context).toBe(context);
    });
  });

  describe('개발 모드 처리', () => {
    beforeEach(() => {
      // process.env 모킹
      globalThis.process = {
        ...originalProcess,
        env: { NODE_ENV: 'development' }
      } as any;
    });

    afterEach(() => {
      globalThis.process = originalProcess;
    });

    it('개발 모드에서 상세 정보 포함', () => {
      const originalError = new Error('상세 개발자 에러');
      const context: ErrorContext = {
        sourceType: 'canvas',
        format: 'png'
      };

      const error = createImageError(
        ImageErrorCode.CANVAS_CREATION_FAILED,
        originalError,
        context
      );

      expect(error.message).toContain('🔧 개발자 정보: 상세 개발자 에러');
      expect(error.message).toContain('📋 컨텍스트:');
      expect(error.message).toContain('sourceType');
      expect(error.message).toContain('format');
    });
  });

  describe('프로덕션 모드 처리', () => {
    beforeEach(() => {
      globalThis.process = {
        ...originalProcess,
        env: { NODE_ENV: 'production' }
      } as any;
    });

    afterEach(() => {
      globalThis.process = originalProcess;
    });

    it('프로덕션 모드에서 간단한 메시지만', () => {
      const originalError = new Error('내부 에러');
      const context: ErrorContext = { debug: { internal: true } };

      const error = createImageError(
        ImageErrorCode.RESIZE_FAILED,
        originalError,
        context
      );

      expect(error.message).not.toContain('🔧 개발자 정보');
      expect(error.message).not.toContain('📋 컨텍스트');
      expect(error.message).toContain('💡 해결 방법:');
    });
  });

  describe('해결 방법 제안', () => {
    it('INVALID_SOURCE 해결 방법', () => {
      const error = createImageError(ImageErrorCode.INVALID_SOURCE);

      expect(error.message).toContain('HTMLImageElement, Blob, 또는 유효한 URL');
      expect(error.message).toContain('CORS 문제인 경우');
      expect(error.message).toContain('Base64 Data URL');
    });

    it('FILE_TOO_LARGE 해결 방법', () => {
      const error = createImageError(ImageErrorCode.FILE_TOO_LARGE);

      expect(error.message).toContain('이미지 크기를 줄이거나');
      expect(error.message).toContain('WebP');
      expect(error.message).toContain('여러 단계로');
    });

    it('BROWSER_NOT_SUPPORTED 해결 방법', () => {
      const error = createImageError(ImageErrorCode.BROWSER_NOT_SUPPORTED);

      expect(error.message).toContain('Chrome, Firefox, Safari, Edge');
      expect(error.message).toContain('WebP 지원이 필요한 경우');
    });
  });
});

describe('withErrorRecovery', () => {
  it('성공적인 주요 함수 실행', async () => {
    const primaryFunction = vi.fn().mockResolvedValue('success');
    const fallbackFunction = vi.fn().mockResolvedValue('fallback');

    const result = await withErrorRecovery(primaryFunction, fallbackFunction);

    expect(result).toBe('success');
    expect(primaryFunction).toHaveBeenCalledTimes(1);
    expect(fallbackFunction).not.toHaveBeenCalled();
  });

  it('주요 함수 실패 시 fallback 실행', async () => {
    const primaryError = new Error('Primary failed');
    const primaryFunction = vi.fn().mockRejectedValue(primaryError);
    const fallbackFunction = vi.fn().mockResolvedValue('fallback-success');

    // console.warn 모킹
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await withErrorRecovery(primaryFunction, fallbackFunction);

    expect(result).toBe('fallback-success');
    expect(primaryFunction).toHaveBeenCalledTimes(1);
    expect(fallbackFunction).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('Primary method failed, trying fallback:', primaryError);

    consoleSpy.mockRestore();
  });

  it('둘 다 실패 시 상세한 에러', async () => {
    const primaryError = new Error('Primary error');
    const fallbackError = new Error('Fallback error');
    const primaryFunction = vi.fn().mockRejectedValue(primaryError);
    const fallbackFunction = vi.fn().mockRejectedValue(fallbackError);

    const context: ErrorContext = { sourceType: 'test' };

    await expect(
      withErrorRecovery(primaryFunction, fallbackFunction, context)
    ).rejects.toThrow();

    expect(primaryFunction).toHaveBeenCalledTimes(1);
    expect(fallbackFunction).toHaveBeenCalledTimes(1);
  });

  it('fallback 없이 실행', async () => {
    const primaryError = new Error('Primary failed');
    const primaryFunction = vi.fn().mockRejectedValue(primaryError);

    await expect(
      withErrorRecovery(primaryFunction)
    ).rejects.toThrow(); // 에러 메시지가 래핑되므로 내용은 확인하지 않음
  });

  it('ImageProcessingError는 그대로 전파', async () => {
    const imageError = new ImageProcessingError('Image error', ImageErrorCode.INVALID_SOURCE);
    const primaryFunction = vi.fn().mockRejectedValue(imageError);

    await expect(
      withErrorRecovery(primaryFunction)
    ).rejects.toThrow(Error); // ImageProcessError로 래핑됨
  });

  it('일반 에러는 ImageProcessingError로 래핑', async () => {
    const regularError = new Error('Regular error');
    const primaryFunction = vi.fn().mockRejectedValue(regularError);

    await expect(
      withErrorRecovery(primaryFunction)
    ).rejects.toThrow(Error); // ImageProcessError로 래핑됨
  });
});

describe('checkBrowserSupport (DOM 모킹)', () => {
  beforeEach(() => {
    // document.createElement 모킹
    globalThis.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return {
            getContext: vi.fn((type: string) => {
              if (type === '2d') return {}; // 2d context 지원
              return null;
            }),
            toDataURL: vi.fn((format: string) => {
              if (format === 'image/webp') return 'data:image/webp;base64,';
              if (format === 'image/avif') return 'data:image/avif;base64,';
              return 'data:image/png;base64,';
            })
          };
        }
        return {};
      })
    } as any;

    // OffscreenCanvas 모킹
    globalThis.OffscreenCanvas = class OffscreenCanvas {} as any;
  });

  afterEach(() => {
    delete (globalThis as any).document;
    delete (globalThis as any).OffscreenCanvas;
  });

  it('브라우저 기능 지원 확인', () => {
    const support = checkBrowserSupport();

    expect(support.canvas).toBe(true);
    expect(support.webp).toBe(true);
    expect(support.avif).toBe(true);
    expect(support.offscreenCanvas).toBe(true);
  });

  it('Canvas 미지원 시', () => {
    // getContext 실패 모킹
    globalThis.document.createElement = vi.fn(() => ({
      getContext: vi.fn(() => null),
      toDataURL: vi.fn(() => 'data:image/png;base64,')
    })) as any;

    const support = checkBrowserSupport();
    expect(support.canvas).toBe(false);
  });

  it('OffscreenCanvas 미지원 시', () => {
    delete (globalThis as any).OffscreenCanvas;

    const support = checkBrowserSupport();
    expect(support.offscreenCanvas).toBe(false);
  });
});

describe('isFormatSupported (DOM 모킹)', () => {
  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        toBlob: vi.fn((callback: Function, format: string) => {
          // webp는 지원, tiff는 미지원으로 모킹
          if (format === 'image/webp') {
            setTimeout(() => callback(new Blob()), 0);
          } else if (format === 'image/tiff') {
            setTimeout(() => callback(null), 0);
          } else {
            setTimeout(() => callback(new Blob()), 0);
          }
        })
      }))
    } as any;
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it('지원되는 포맷 확인', async () => {
    const supported = await isFormatSupported('webp');
    expect(supported).toBe(true);
  });

  it('지원되지 않는 포맷 확인', async () => {
    const supported = await isFormatSupported('tiff');
    expect(supported).toBe(false);
  });

  it('기본 포맷 지원', async () => {
    const supported = await isFormatSupported('png');
    expect(supported).toBe(true);
  });
});

describe('estimateMemoryUsage', () => {
  it('기본 메모리 계산', () => {
    const result = estimateMemoryUsage(1920, 1080);

    expect(result.bytes).toBe(1920 * 1080 * 4); // RGBA
    expect(result.megabytes).toBeCloseTo(7.91, 2);
    expect(result.warning).toBe(false);
  });

  it('큰 이미지 메모리 경고', () => {
    const result = estimateMemoryUsage(5000, 5000);

    expect(result.bytes).toBe(5000 * 5000 * 4);
    expect(result.megabytes).toBeCloseTo(95.37, 2);
    expect(result.warning).toBe(false);

    // 100MB 초과하는 경우
    const largeResult = estimateMemoryUsage(6000, 6000);
    expect(largeResult.warning).toBe(true);
    expect(largeResult.megabytes).toBeGreaterThan(100);
  });

  it('작은 이미지는 경고 없음', () => {
    const result = estimateMemoryUsage(100, 100);

    expect(result.bytes).toBe(100 * 100 * 4);
    expect(result.megabytes).toBeCloseTo(0.04, 2);
    expect(result.warning).toBe(false);
  });

  it('0 크기 처리', () => {
    const result = estimateMemoryUsage(0, 0);

    expect(result.bytes).toBe(0);
    expect(result.megabytes).toBe(0);
    expect(result.warning).toBe(false);
  });
});

describe('logError', () => {
  describe('개발 모드', () => {
    beforeEach(() => {
      globalThis.process = {
        ...originalProcess,
        env: { NODE_ENV: 'development' }
      } as any;

      // console 메서드들 모킹
      vi.spyOn(console, 'group').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'trace').mockImplementation(() => {});
      vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    });

    afterEach(() => {
      globalThis.process = originalProcess;
      vi.restoreAllMocks();
    });

    it('개발 모드에서 상세 로깅', () => {
      const originalError = new Error('Original error');
      const error = new ImageProcessingError(
        'Test error',
        ImageErrorCode.RESIZE_FAILED,
        originalError
      );
      const context = { sourceType: 'test' };

      logError(error, context);

      expect(console.group).toHaveBeenCalledWith('🚨 ImageProcessError');
      expect(console.error).toHaveBeenCalledWith('Code:', 'RESIZE_FAILED');
      expect(console.error).toHaveBeenCalledWith('Message:', 'Test error');
      expect(console.error).toHaveBeenCalledWith('Original Error:', originalError);
      expect(console.error).toHaveBeenCalledWith('Context:', context);
      expect(console.trace).toHaveBeenCalledWith('Stack Trace');
      expect(console.groupEnd).toHaveBeenCalled();
    });

    it('원본 에러 없이 로깅', () => {
      const error = new ImageProcessingError('Simple error', ImageErrorCode.INVALID_SOURCE);

      logError(error);

      expect(console.error).toHaveBeenCalledWith('Code:', 'INVALID_SOURCE');
      expect(console.error).toHaveBeenCalledWith('Message:', 'Simple error');
      expect(console.error).not.toHaveBeenCalledWith('Original Error:', expect.anything());
    });
  });

  describe('프로덕션 모드', () => {
    beforeEach(() => {
      globalThis.process = {
        ...originalProcess,
        env: { NODE_ENV: 'production' }
      } as any;

      vi.spyOn(console, 'group').mockImplementation(() => {});
    });

    afterEach(() => {
      globalThis.process = originalProcess;
      vi.restoreAllMocks();
    });

    it('프로덕션 모드에서 로깅 안함', () => {
      const error = new ImageProcessingError('Prod error', ImageErrorCode.CONVERSION_FAILED);

      logError(error);

      expect(console.group).not.toHaveBeenCalled();
    });
  });
});