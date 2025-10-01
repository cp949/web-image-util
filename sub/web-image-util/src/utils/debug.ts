/**
 * 개발 및 디버그 모드 관련 유틸리티
 */

/**
 * 개발 모드 여부를 확인
 *
 * 다음 조건 중 하나라도 만족하면 개발 모드로 판단:
 * - NODE_ENV가 'development'
 * - URL에 debug=true 파라미터 존재 (브라우저 환경)
 * - localStorage에 'web-image-util-debug' 키 존재 (브라우저 환경)
 */
export function isDevelopmentMode(): boolean {
  // Node.js 환경에서 NODE_ENV 확인
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return true;
  }

  // 브라우저 환경에서 URL 파라미터 확인
  if (typeof window !== 'undefined' && typeof URLSearchParams !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === 'true') {
        return true;
      }
    } catch {
      // URLSearchParams 사용 실패 시 무시
    }
  }

  // 브라우저 환경에서 localStorage 확인
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('web-image-util-debug') !== null;
    } catch {
      // localStorage 접근 실패 시 무시
    }
  }

  return false;
}

/**
 * 디버그 모드에서만 콘솔 출력
 */
export const debugLog = {
  log: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.log('[web-image-util]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.warn('[web-image-util]', ...args);
    }
  },
  error: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.error('[web-image-util]', ...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.debug('[web-image-util]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (isDevelopmentMode()) {
      console.info('[web-image-util]', ...args);
    }
  }
};

/**
 * 에러나 경고는 항상 출력하지만, 개발 모드에서는 더 자세한 정보 출력
 */
export const productionLog = {
  warn: (...args: any[]) => {
    console.warn('[web-image-util]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[web-image-util]', ...args);
  }
};