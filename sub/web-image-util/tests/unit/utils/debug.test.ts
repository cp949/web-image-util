import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { debugLog, isDevelopmentMode, productionLog } from '../../../src/utils/debug';

/**
 * debug 유틸 환경 분기 테스트.
 *
 * isDevelopmentMode()는 모듈 초기화 시점이 아니라 호출 시점에 환경을 읽으므로
 * vi.resetModules()는 필요 없다. 대신 process.env / window.location / localStorage /
 * 전역 stub을 각 테스트에서 변경하고 afterEach에서 복구한다.
 */
describe('debug 유틸', () => {
  // 테스트 환경의 NODE_ENV를 보존했다가 복구한다.
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // 기본값: 개발 모드가 꺼진 상태로 시작한다.
    process.env.NODE_ENV = 'test';
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    // 먼저 stub된 전역(window 등)을 복구해야 이후 window.history 접근이 안전하다.
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = originalNodeEnv;
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  describe('isDevelopmentMode', () => {
    it('NODE_ENV가 development면 true다', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopmentMode()).toBe(true);
    });

    // 참고: `typeof process === "undefined"`(비-Node 환경) 분기는 vitest fork 워커가
    // process.nextTick에 의존하므로 vi.stubGlobal('process', undefined)로 재현하면
    // 워커가 깨진다. 해당 가드 분기는 안전하게 stub할 수 없어 테스트에서 제외한다.

    it('URL에 debug=true 파라미터가 있으면 true다', () => {
      window.history.replaceState({}, '', '/?debug=true');
      expect(isDevelopmentMode()).toBe(true);
    });

    it('URL에 debug 파라미터가 다른 값이면 true가 아니다', () => {
      window.history.replaceState({}, '', '/?debug=false');
      expect(isDevelopmentMode()).toBe(false);
    });

    it('URLSearchParams 생성이 실패해도 안전하게 다음 분기로 넘어간다', () => {
      // URLSearchParams 자체는 존재하지만 생성 시 throw하도록 stub해 catch 분기를 탄다.
      vi.stubGlobal(
        'URLSearchParams',
        class {
          constructor() {
            throw new Error('URLSearchParams 사용 불가');
          }
        }
      );
      expect(isDevelopmentMode()).toBe(false);
    });

    it('URLSearchParams가 없는 환경에서도 안전하게 동작한다', () => {
      vi.stubGlobal('URLSearchParams', undefined);
      expect(isDevelopmentMode()).toBe(false);
    });

    it('localStorage에 debug 키가 있으면 true다', () => {
      localStorage.setItem('web-image-util-debug', '1');
      expect(isDevelopmentMode()).toBe(true);
    });

    it('localStorage에 debug 키가 없으면 false다', () => {
      expect(isDevelopmentMode()).toBe(false);
    });

    it('localStorage 접근이 실패해도 안전하게 false를 반환한다', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage 접근 불가');
      });
      expect(isDevelopmentMode()).toBe(false);
    });

    it('window가 없는 환경에서도 안전하게 동작한다', () => {
      vi.stubGlobal('window', undefined);
      expect(isDevelopmentMode()).toBe(false);
    });

    it('어떤 조건도 만족하지 않으면 false다', () => {
      expect(isDevelopmentMode()).toBe(false);
    });
  });

  describe('debugLog (개발 모드에서만 출력)', () => {
    const methods = ['log', 'warn', 'error', 'debug', 'info'] as const;

    it('개발 모드면 각 console 메서드를 호출한다', () => {
      localStorage.setItem('web-image-util-debug', '1');

      for (const method of methods) {
        const spy = vi.spyOn(console, method).mockImplementation(() => {});
        debugLog[method]('메시지', 123);
        expect(spy).toHaveBeenCalledWith('[web-image-util]', '메시지', 123);
      }
    });

    it('개발 모드가 아니면 console을 호출하지 않는다', () => {
      // 기본 상태(NODE_ENV=test, debug 키 없음)에서는 출력이 억제돼야 한다.
      for (const method of methods) {
        const spy = vi.spyOn(console, method).mockImplementation(() => {});
        debugLog[method]('메시지');
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });

  describe('productionLog (항상 출력)', () => {
    it('개발 모드와 무관하게 warn/error를 출력한다', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      productionLog.warn('경고');
      productionLog.error('오류');

      expect(warnSpy).toHaveBeenCalledWith('[web-image-util]', '경고');
      expect(errorSpy).toHaveBeenCalledWith('[web-image-util]', '오류');
    });
  });
});
