/**
 * 브라우저별 Canvas 최대 안전 치수를 단일 소유하는 모듈이다.
 *
 * probe는 실제 브라우저 사실을 읽는 방식만 가르는 어댑터다 — memory.internal.ts와 같은
 * 관례를 따른다. 테스트는 고정값을 돌려주는 probe로 교체해 소비자 분기를 확인하거나,
 * 기본 probe를 그대로 두고 navigator.userAgent를 stub해 브라우저별 분기 자체를 검증한다.
 * fallback은 probe가 값을 못 내는 모든 환경(알 수 없는 UA, navigator 부재 등)에 공통으로
 * 적용하는 가장 보수적인 값이다.
 */

/** 브라우저별 Canvas 최대 안전 치수(픽셀)를 읽는 방식만 가르는 어댑터다. */
export interface CanvasLimitProbe {
  read(): number | undefined;
}

/** probe가 값을 못 내는 환경(알 수 없는 UA, navigator 부재 등)의 단일 fallback이다. */
const FALLBACK_MAX_SAFE_DIMENSION = 16384;

/** 알려진 브라우저의 Canvas 최대 안전 치수(픽셀)다. */
const KNOWN_BROWSER_MAX_SAFE_DIMENSION = {
  chrome: 32767,
  firefox: 32767,
  safari: 16384,
  edge: 32767,
};

const userAgentCanvasLimitProbe: CanvasLimitProbe = {
  read() {
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
      return undefined;
    }
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('chrome') || userAgent.includes('chromium')) {
      return KNOWN_BROWSER_MAX_SAFE_DIMENSION.chrome;
    } else if (userAgent.includes('firefox')) {
      return KNOWN_BROWSER_MAX_SAFE_DIMENSION.firefox;
    } else if (userAgent.includes('safari')) {
      return KNOWN_BROWSER_MAX_SAFE_DIMENSION.safari;
    } else if (userAgent.includes('edge') || userAgent.includes('edg/')) {
      return KNOWN_BROWSER_MAX_SAFE_DIMENSION.edge;
    }

    return undefined;
  },
};

let activeProbe: CanvasLimitProbe = userAgentCanvasLimitProbe;

/** 테스트가 probe를 대체할 때 쓰는 진입점이다. 공개 배럴에 노출하지 않는다. */
export function setCanvasLimitProbe(probe: CanvasLimitProbe): void {
  activeProbe = probe;
}

/** 기본 userAgent probe로 되돌린다. */
export function resetCanvasLimitProbe(): void {
  activeProbe = userAgentCanvasLimitProbe;
}

/** 현재 Canvas 최대 안전 치수를 읽는다. probe가 값을 못 내면 단일 fallback을 돌려준다. */
export function readMaxSafeCanvasDimension(): number {
  return activeProbe.read() ?? FALLBACK_MAX_SAFE_DIMENSION;
}
