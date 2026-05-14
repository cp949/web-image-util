/**
 * ImageErrorHandler 단위 테스트.
 *
 * 통계 수집, 싱글턴 동일성, 컨텍스트 수집 동작을 검증한다.
 * 실제 로그 출력·Canvas Pool 정리는 부수효과이므로 테스트 범위 밖이다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalErrorHandler, ImageErrorHandler } from '../../../src/core/error-handler';
import { ImageErrorCode, ImageProcessError } from '../../../src/errors';

describe('ImageErrorHandler 싱글턴', () => {
  it('getInstance()를 여러 번 호출해도 같은 인스턴스를 반환한다', () => {
    const a = ImageErrorHandler.getInstance();
    const b = ImageErrorHandler.getInstance();
    expect(a).toBe(b);
  });

  it('globalErrorHandler는 ImageErrorHandler 인스턴스이다', () => {
    expect(globalErrorHandler).toBeInstanceOf(ImageErrorHandler);
  });

  it('globalErrorHandler는 getInstance()와 동일 인스턴스이다', () => {
    expect(globalErrorHandler).toBe(ImageErrorHandler.getInstance());
  });
});

describe('ImageErrorHandler 통계 수집', () => {
  let handler: ImageErrorHandler;

  beforeEach(() => {
    handler = ImageErrorHandler.getInstance();
    handler.resetStats();
  });

  afterEach(() => {
    handler.resetStats();
  });

  it('초기 상태에서 totalErrors는 0이다', () => {
    expect(handler.getStats().totalErrors).toBe(0);
  });

  it('handleError 호출마다 totalErrors가 1씩 증가한다', async () => {
    const err = new ImageProcessError('msg', ImageErrorCode.PROCESSING_FAILED);
    await handler.handleError(err);
    expect(handler.getStats().totalErrors).toBe(1);

    await handler.handleError(err);
    expect(handler.getStats().totalErrors).toBe(2);
  });

  it('에러 코드별 카운트가 기록된다', async () => {
    const err1 = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    const err2 = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    const err3 = new ImageProcessError('msg', ImageErrorCode.CONVERSION_FAILED);

    await handler.handleError(err1);
    await handler.handleError(err2);
    await handler.handleError(err3);

    const stats = handler.getStats();
    expect(stats.errorsByCode.RESIZE_FAILED).toBe(2);
    expect(stats.errorsByCode.CONVERSION_FAILED).toBe(1);
  });

  it('resetStats() 호출 후 통계가 초기화된다', async () => {
    const err = new ImageProcessError('msg', ImageErrorCode.BLUR_FAILED);
    await handler.handleError(err);

    handler.resetStats();
    const stats = handler.getStats();
    expect(stats.totalErrors).toBe(0);
    expect(Object.keys(stats.errorsByCode)).toHaveLength(0);
  });

  it('lastErrorTime은 handleError 호출 후 0보다 크다', async () => {
    const err = new ImageProcessError('msg', ImageErrorCode.PROCESSING_FAILED);
    await handler.handleError(err);
    expect(handler.getStats().lastErrorTime).toBeGreaterThan(0);
  });

  it('getStats()는 내부 객체의 복사본을 반환한다', () => {
    const stats1 = handler.getStats();
    const stats2 = handler.getStats();
    // 값은 같되 참조는 다름
    expect(stats1).not.toBe(stats2);
    expect(stats1).toEqual(stats2);
  });
});

describe('ImageErrorHandler collectEnhancedContext', () => {
  let handler: ImageErrorHandler;

  beforeEach(() => {
    handler = ImageErrorHandler.getInstance();
  });

  it('operation 이름을 전달해도 반환 객체는 ErrorContext 형태이다', () => {
    const ctx = handler.collectEnhancedContext('resize');
    // timestamp는 항상 포함된다
    expect(typeof ctx.timestamp).toBe('number');
  });

  it('추가 컨텍스트가 병합된다', () => {
    const ctx = handler.collectEnhancedContext('blur', { sourceType: 'png' });
    expect(ctx.sourceType).toBe('png');
  });

  it('빈 추가 컨텍스트를 전달해도 timestamp는 존재한다', () => {
    const ctx = handler.collectEnhancedContext('test', {});
    expect(ctx.timestamp).toBeGreaterThan(0);
  });
});

describe('ImageErrorHandler handleError — 크리티컬 코드 분기', () => {
  let handler: ImageErrorHandler;

  beforeEach(() => {
    handler = ImageErrorHandler.getInstance();
    handler.resetStats();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    handler.resetStats();
  });

  it('크리티컬 코드(CANVAS_CREATION_FAILED)도 예외 없이 처리된다', async () => {
    const errorSpy = vi.mocked(console.error);
    const err = new ImageProcessError('msg', ImageErrorCode.CANVAS_CREATION_FAILED);
    await expect(handler.handleError(err)).resolves.toBeUndefined();
    // handleCriticalError 분기 도달 검증: 코드 목록에서 제거해도 이 테스트가 잡는다
    expect(errorSpy).toHaveBeenCalledWith('🔥 Critical error detected:', err.code);
  });

  it('크리티컬 코드(CANVAS_CONTEXT_FAILED)는 크리티컬 핸들러를 호출한다', async () => {
    const errorSpy = vi.mocked(console.error);
    const err = new ImageProcessError('msg', ImageErrorCode.CANVAS_CONTEXT_FAILED);
    await expect(handler.handleError(err)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('🔥 Critical error detected:', err.code);
  });

  it('크리티컬 코드(BROWSER_NOT_SUPPORTED)는 크리티컬 핸들러를 호출한다', async () => {
    const errorSpy = vi.mocked(console.error);
    const err = new ImageProcessError('msg', ImageErrorCode.BROWSER_NOT_SUPPORTED);
    await expect(handler.handleError(err)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('🔥 Critical error detected:', err.code);
  });

  it('일반 코드(RESIZE_FAILED)는 예외 없이 처리되며 크리티컬 핸들러를 호출하지 않는다', async () => {
    const errorSpy = vi.mocked(console.error);
    const err = new ImageProcessError('msg', ImageErrorCode.RESIZE_FAILED);
    await expect(handler.handleError(err)).resolves.toBeUndefined();
    expect(errorSpy).not.toHaveBeenCalledWith('🔥 Critical error detected:', expect.anything());
  });
});
