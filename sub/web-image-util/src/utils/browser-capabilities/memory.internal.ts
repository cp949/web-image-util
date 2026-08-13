/**
 * performance.memory 기반 메모리 예산을 단일 소유하는 모듈이다.
 *
 * probe는 실제 메모리를 읽는 방식만 가르는 어댑터다 — 테스트는 고정값을 돌려주는
 * probe로 교체해 압력 분기를 확인한다. fallback은 probe가 값을 못 내는 모든 환경
 * (비 Chromium 브라우저, SSR, jsdom)에 공통으로 적용하는 단일 값이다. 이전에는
 * 소비자 7곳이 각자 다른 fallback을 추측했다.
 */

/** 현재 메모리 상태다. pressure는 0~1 비율(used/limit)이며 버킷 분류는 소비자가 한다. */
export interface MemoryBudget {
  usedMB: number;
  limitMB: number;
  availableMB: number;
  pressure: number;
}

/** 메모리 상태를 읽는 방식만 가르는 어댑터다. */
export interface MemoryProbe {
  read(): MemoryBudget | undefined;
}

/**
 * performance.memory를 읽지 못하는 환경의 단일 fallback이다. usedMB/limitMB(128/512)는
 * auto-memory-manager의 기존 fallback에서 가져왔다 — 그쪽 값은 pressure 0.5·availableMB
 * 256처럼 usedMB/limitMB와 맞지 않는 자기모순 상태였다. 여기서는 pressure(usedMB/limitMB)와
 * availableMB(limitMB-usedMB)를 정합값으로 고쳐 "낮은 압박" 가정이 압박 분기를 새 환경에서
 * 오탐시키지 않게 했다.
 */
const FALLBACK_BUDGET: MemoryBudget = {
  usedMB: 128,
  limitMB: 512,
  availableMB: 384,
  pressure: 0.25,
};

const chromiumMemoryProbe: MemoryProbe = {
  read() {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return undefined;
    }
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / (1024 * 1024);
    const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
    return {
      usedMB: Math.round(usedMB),
      limitMB: Math.round(limitMB),
      availableMB: Math.round(limitMB - usedMB),
      pressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
    };
  },
};

let activeProbe: MemoryProbe = chromiumMemoryProbe;

/** 테스트가 probe를 대체할 때 쓰는 진입점이다. 공개 배럴에 노출하지 않는다. */
export function setMemoryProbe(probe: MemoryProbe): void {
  activeProbe = probe;
}

/** 기본 Chromium probe로 되돌린다. */
export function resetMemoryProbe(): void {
  activeProbe = chromiumMemoryProbe;
}

/** 현재 메모리 예산을 읽는다. probe가 값을 못 내면 단일 fallback을 돌려준다. */
export function readMemoryBudget(): MemoryBudget {
  return activeProbe.read() ?? FALLBACK_BUDGET;
}

/**
 * GC를 요청한다. Node(`--expose-gc`)처럼 `global.gc`가 있는 환경 밖에서는 아무 일도
 * 하지 않는다. 언제 부를지(압력 임계값, 호출 빈도)는 소비자의 정책이다 — 이 함수는
 * 가드된 호출 메커니즘만 제공한다. 반환값은 실제로 호출했는지 여부다 — 일부 소비자가
 * 트리거 시에만 로그를 남기던 기존 동작을 보존하는 데 쓴다.
 */
export function requestMemoryRelief(): boolean {
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
    return true;
  }
  return false;
}
