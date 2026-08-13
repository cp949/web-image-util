# 메모리 예산 모듈 설계

## 배경

`performance.memory`(Chromium 전용 heap 정보)를 읽는 구현이 7개 파일에 독립적으로 존재한다. 반환 shape가 3종으로 갈리고, 값을 못 읽을 때의 fallback이 파일마다 다른 추측이다.

| 파일 | 함수 | 반환 shape | fallback |
| --- | --- | --- | --- |
| `src/base/canvas-pool.internal.ts:55` | `getAvailableMemory()` (private) | `number` (availableMB) | `512` |
| `src/core/performance-utils.ts:116` | `ResizePerformance.getMemoryInfo()` (static) | `{ usedMB, limitMB, pressureLevel: 'low'\|'medium'\|'high' }` | `{ usedMB: 0, limitMB: 0, pressureLevel: 'low' }` |
| `src/base/error-handler.ts:149` | `getMemoryInfo()` (private) | `Partial<ErrorContext>` — `{ debug: { memoryUsedMB, memoryLimitMB, memoryPressure } }` | `{}` (필드 자체가 없음) |
| `src/core/auto-memory-manager.internal.ts:98` | `getMemoryInfo()` | 로컬 `interface MemoryInfo` (14행) — `{ pressure, availableMB, usedMB, limitMB }` | `{ pressure: 0.5, availableMB: 256, usedMB: 128, limitMB: 512 }` |
| `src/base/high-res-manager.ts:441` | `isMemoryLow()` (private static) | `boolean` | `false` |
| `src/base/high-res-manager.ts:454` | `getEstimatedUsage()` (private static) | `{ used, limit }` (bytes, MB 아님) | `{ used: 64*1024*1024, limit: 512*1024*1024 }` |
| `src/core/smart-processor.internal.ts:186` | `getAutoMemoryLimit()` (private static) | `number` (availableMB의 20%) | `256` |

`global.gc()` 직접 호출(가드 패턴은 4곳 모두 동일: `typeof global !== 'undefined' && global.gc`)도 흩어져 있다.

| 파일 | 위치 | 트리거 조건 |
| --- | --- | --- |
| `src/base/error-handler.ts:132` | `handleCriticalError()` | 무조건 (critical 에러 발생 시) |
| `src/core/auto-memory-manager.internal.ts:79` | `performOptimization()` | `pressure > 0.8` |
| `src/base/high-res-manager.ts:271` | `checkAndManageMemory()` | `isMemoryLow()` |
| `src/base/tiled-processor.internal.ts:169` | 청크 처리 루프 | `opts.enableMemoryMonitoring` (압력 무관, 청크마다 무조건) |

**`tiled-processor.internal.ts`는 원본 review 카드의 파일 인벤토리(6개 파일)에서 빠져 있었다.** 카드의 "before" 패널이 말한 "global.gc() 직접 호출 4곳"은 정확했지만 "after" 소비자 다이어그램 6개 박스에는 없다. 이 파일을 이관하지 않으면 "global.gc()를 브라우저 외 분기 1곳으로 격리"라는 목표가 거짓이 된다. 이번 설계는 7개 파일 전부를 다룬다.

### fallback 값은 서로 다른 정책이 아니라 각자의 추측이다

7개 fallback은 "같은 질문(측정 불가 시 무엇으로 볼 것인가)"에 대한 서로 다른 답이다. `canvas-pool`은 512MB 여유로, `auto-memory-manager`는 512MB 한도(사용 128MB, 압력 0.5)로 가정한다 — 같은 숫자 512를 완전히 다른 의미로 쓴다. 이 드리프트를 하나의 값으로 통일하는 것이 이번 설계의 핵심 behavior change다(아래 "결정" 참고).

### 실제 probe/fallback 분기는 테스트로 보호되지 않는다

- `AutoMemoryManager.getMemoryInfo()`의 실제 body — 모든 테스트(`tests/unit/core/auto-memory-manager.test.ts`)가 `vi.spyOn(manager, 'getMemoryInfo')`로 우회한다. 실제 probe/fallback 경로는 0회 실행된다.
- `CanvasPool.getAvailableMemory()` — 전용 테스트 없음(`tests/unit/base/canvas-pool-*.test.ts`는 threshold getter/setter만 다룬다).
- `SmartProcessor`가 쓰는 `getAutoMemoryLimit()` — 전용 테스트 없음.
- `HighResolutionManager.isMemoryLow()` — `vi.spyOn(HighResolutionManager as any, 'isMemoryLow')`로 사설 메서드를 강제 목킹(`tests/unit/core/high-res-manager-validate-jsdom.test.ts:210`).
- `ResizePerformance.getMemoryInfo()`만 실제 `performance.memory`를 주입하는 테스트가 있다 — 단, 파일 전용의 `withPerformanceMemory()` 헬퍼(`Object.getOwnPropertyDescriptor` 저장/복구)를 자체 구현했다.
- `ImageErrorHandler.getMemoryInfo()`도 실제 주입 테스트가 있다 — `vi.stubGlobal('performance', { memory: {...} })`로 위와 다른 스타일의 인라인 헬퍼를 또 만들었다.

같은 세 줄짜리 mocking 코드가 파일마다 다른 스타일로 반복된다. `tiled-processor`의 gc 트리거는 모든 테스트가 `enableMemoryMonitoring: false`로 꺼둬서 아예 실행되지 않는다.

### `docs/maintenance-risks.md`가 이미 지정한 해소 방향

- `High` 항목 "Node 전용 `global.gc()`" — "브라우저 전용 라이브러리 원칙과 맞지 않는 런타임 분기".
- `Medium` 항목 "`performance.memory` 분산 참조" — 다음 행동이 이미 "브라우저 capabilities 유틸 한 곳으로 통합"으로 못 박혀 있다.

`src/utils/browser-capabilities/`가 그 유틸이다. `feature-detection.internal.ts`(동기 기능 감지), `format-detection.internal.ts`(WebP/AVIF 디코드 프로브), `performance.internal.ts`(capabilities 기반 처리 모드 결정 — memory와 무관한 별도 개념이니 이름 충돌 주의), `detector.internal.ts`, `cache.internal.ts`, `index.ts` 배럴로 구성돼 있고 `base/`·`core/` 양쪽이 이미 이 디렉터리를 import한다(`format-detector.ts`, `error-helpers.ts`, `canvas-pool.internal.ts`, `high-res-manager.ts`). 레이어링은 `core → base → utils` 단방향이라 새 파일을 여기 둬도 위반이 없다.

단, 이 디렉터리의 기존 `capabilityCache`는 **정적** 기능 플래그(OffscreenCanvas 지원 여부 등)를 위한 것이다. 메모리는 호출마다 바뀌는 값이라 그대로 재사용하면 안 된다 — 새 모듈은 이 디렉터리에 살되 캐싱은 쓰지 않는다.

## 결정

`src/utils/browser-capabilities/memory.internal.ts`를 신설한다. `readMemoryBudget()`과 `requestMemoryRelief()`를 `index.ts` 배럴에 추가하고, `setMemoryProbe`/`resetMemoryProbe`는 `src/utils/image-decode.internal.ts`의 `setImageDecodeAdapter`/`resetImageDecodeAdapter` 선례를 따라 배럴에 올리지 않는다 — 테스트 전용 진입점은 파일에서 직접 import한다.

fallback은 `auto-memory-manager.internal.ts`가 이미 쓰던 값(`{ usedMB: 128, limitMB: 512, availableMB: 384, pressure: 0.25 }`)으로 통일한다. 7곳 중 4개 필드를 모두 갖춘 유일한 fallback이고 "낮은 압박" 기본값이라 새 환경에서 압박 분기가 오탐하지 않는다. **behavior change**: `performance.memory`가 없는 환경(Firefox/Safari, SSR, jsdom 테스트)에서 이관된 소비자들이 관측하는 기본값이 달라진다 — 특히 `error-handler`는 지금까지 `debug` 필드 자체를 생략했으나 이관 후에는 fallback 값을 채운 `debug.memory*`를 항상 포함한다(아래 소비자 투영·테스트 계약 참고).

`tiled-processor.internal.ts`를 이관 대상에 포함한다. 이 파일의 gc 트리거 정책(압력 체크 없이 `enableMemoryMonitoring` 플래그만으로 매 청크 호출)은 그대로 유지한다 — `requestMemoryRelief()`는 메커니즘(가드된 `global.gc()` 호출)만 제공하고, 언제 부를지는 각 소비자의 정책으로 남긴다.

## 모듈 계약

```ts
// src/utils/browser-capabilities/memory.internal.ts

/** 현재 메모리 상태다. pressure는 0~1 비율(used/limit)이며 버킷 분류는 소비자가 한다. */
export interface MemoryBudget {
  usedMB: number;
  limitMB: number;
  availableMB: number;
  pressure: number;
}

/** 메모리 상태를 읽는 방식만 가르는 어댑터다. 테스트는 고정값을 돌려주는 프로브로 교체한다. */
export interface MemoryProbe {
  read(): MemoryBudget | undefined;
}

/** performance.memory를 읽지 못하는 환경(비 Chromium, SSR, jsdom)의 단일 fallback이다.
 * auto-memory-manager가 쓰던 값을 그대로 승격했다 — "낮은 압박" 가정이라 압박 분기가
 * 새 환경에서 오탐하지 않는다. */
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

/** 기본 Chromium 프로브로 되돌린다. */
export function resetMemoryProbe(): void {
  activeProbe = chromiumMemoryProbe;
}

/** 현재 메모리 예산을 읽는다. probe가 값을 못 내면 단일 fallback을 돌려준다. */
export function readMemoryBudget(): MemoryBudget {
  return activeProbe.read() ?? FALLBACK_BUDGET;
}

/** GC를 요청한다. Node(`--expose-gc`) 등 `global.gc`가 있는 환경 밖에서는 아무 일도 하지 않는다.
 * 언제 부를지(압력 임계값, 호출 빈도)는 소비자의 정책이다 — 이 함수는 메커니즘만 제공한다.
 * 반환값은 실제로 호출했는지 여부다 — error-handler와 auto-memory-manager가 트리거 시에만
 * 로그를 남기던 기존 동작을 보존하려면 이 정보가 필요하다. */
export function requestMemoryRelief(): boolean {
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
    return true;
  }
  return false;
}
```

## 소비자 투영

**`canvas-pool.internal.ts`** — `getAvailableMemory()` 삭제. `getOptimalPoolSize()`가 `readMemoryBudget().availableMB`를 직접 쓴다. 풀 크기 임계값(1024/512/256MB)은 이 파일의 로컬 정책이라 그대로 둔다. 미세한 차이 하나: 기존엔 반올림 전 raw float를 임계값과 비교했고 이제는 `availableMB`(반올림값)와 비교한다 — 정확히 경계값(예: 1024.0x MB)에서만 갈릴 수 있는 이론적 차이이고, 이 경로를 실측하는 테스트가 없어(전용 테스트 0) 관측되지 않는다.

**`performance-utils.ts`** — `ResizePerformance.getMemoryInfo()`는 공개 시그니처(`{ usedMB, limitMB, pressureLevel }`)를 유지한 채 내부에서 `readMemoryBudget()`을 호출하고, `pressureLevel` 버킷(0.5/0.8 임계값)만 로컬로 계산한다. 기존 `withPerformanceMemory()` 기반 테스트는 실제 `performance.memory`를 스텁하므로 변경 없이 통과한다.

**`error-handler.ts`** — private `getMemoryInfo()`가 `readMemoryBudget()`으로 위임하고 `{ debug: { memoryUsedMB: b.usedMB, memoryLimitMB: b.limitMB, memoryPressure: b.pressure } }`로 매핑한다. **behavior change**: 지금은 `performance.memory`가 없으면 `{}`(필드 없음)를 반환하지만, 이관 후에는 fallback이 항상 값을 채우므로 `debug.memory*`가 항상 존재한다. `handleCriticalError()`의 `global.gc()` 블록은 `if (requestMemoryRelief()) { console.info('Garbage collection triggered'); }`로 교체 — 트리거 시에만 로그를 남기던 기존 동작을 그대로 유지한다.

**`auto-memory-manager.internal.ts`** — 로컬 `interface MemoryInfo`(14행) 삭제, `MemoryBudget`을 import해 대체. `getMemoryInfo()`는 `readMemoryBudget()`의 얇은 위임이 된다(shape가 이미 동일하므로 필드 매핑 불필요). `performOptimization()`의 gc 블록은 `if (requestMemoryRelief()) { debugLog.debug(...) }`로 교체해 트리거 시에만 로그를 남기던 기존 동작을 유지한다. pressure > 0.8 체크는 이 파일에 그대로 남는다(호출 여부 정책).

**`high-res-manager.ts`** — `isMemoryLow()`는 이름과 시그니처(`private static isMemoryLow(): boolean`)를 유지한 채 본문만 `readMemoryBudget().pressure > 0.8`로 교체한다. 기존 `vi.spyOn(HighResolutionManager as any, 'isMemoryLow')`(`tests/unit/core/high-res-manager-validate-jsdom.test.ts:210`) 호출부를 건드리지 않기 위해서다. `getEstimatedUsage()`는 삭제하고 `checkAndManageMemory()`가 `readMemoryBudget().availableMB`를 직접 쓰도록 재작성한다(bytes 왕복 변환 제거). gc 블록은 `requestMemoryRelief()`로 교체.

**`smart-processor.internal.ts`** — `getAutoMemoryLimit()`은 "availableMB의 20%"라는 계산 정책은 그대로 두고, probe만 `readMemoryBudget().availableMB`로 위임한다.

**`tiled-processor.internal.ts`** — 청크 루프의 `global.gc()` 가드 블록을 `requestMemoryRelief()` 호출로 교체. `opts.enableMemoryMonitoring` 게이팅은 그대로 유지(압력 체크를 새로 추가하지 않는다 — 위 "결정" 참고).

## 테스트 계약

이관 전 `memory.internal.ts` 전용 characterization 테스트를 먼저 작성한다(카드 3·5와 같은 순서 — 이관 전 안전망):

- `readMemoryBudget()` — 주입한 probe가 값을 반환하는 경우 그 값 그대로 반환.
- `readMemoryBudget()` — probe가 `undefined`를 반환하면 `FALLBACK_BUDGET` 반환.
- `requestMemoryRelief()` — `global.gc`가 있으면 호출하고 `true`를 반환, 없으면 아무 일도 하지 않고 `false`를 반환(throw 없음).
- `setMemoryProbe`/`resetMemoryProbe` — 주입·복원이 올바르게 동작.

6개 소비자의 기존 테스트 스위트는 이관 후 그대로 재실행해 회귀를 확인한다. 예외 2건 — 둘 다 舊 fallback 값(`{}`, `{0,0}`)을 직접 단정하던 테스트라 새 fallback(128/512/384/0.25)에 맞게 갱신해야 한다:

- `tests/unit/base/error-handler.test.ts`의 `'performance.memory가 없으면 debug 없이 timestamp만 포함된 컨텍스트가 반환된다'`(약 306행) — fallback이 항상 값을 채우므로 `debug.memoryUsedMB`가 fallback 값(128)임을 단언하도록 갱신한다. 이름도 "fallback 값이 채워진다" 계열로 바꾼다.
- `tests/unit/core/performance-utils.test.ts`의 `'performance.memory가 없는 환경에서는 기본 pressureLevel low를 반환한다'`(138-145행) — 지금은 `info.usedMB`/`info.limitMB`가 `0`임을 단정하지만, 이관 후에는 `128`/`512`가 된다(`pressureLevel`은 `pressure: 0.25`가 여전히 0.5 미만이라 `'low'` 그대로라 그 단언은 안 바뀐다). `usedMB`/`limitMB` 단언 값만 갱신한다.

`readMemoryBudget()`의 fallback을 실제로 검증하는 신규 characterization 테스트(`memory.internal.ts` 전용)가 이 두 값의 근거가 된다 — 두 소비자 테스트는 그 값을 그대로 신뢰하고 재단언할 뿐, fallback 자체의 근거를 다시 만들지 않는다.

## 문서 계약

- `docs/maintenance-risks.md` — "Node 전용 `global.gc()`", "`performance.memory` 분산 참조" 두 행을 삭제한다. 카드 1의 `2909496` 커밋이 `_SVG_MOCK_MODE` 행을 해소할 때 쓴 방식(행 삭제)과 동일하다.
- `docs/architecture.md` 핵심 모듈 표에 `src/utils/browser-capabilities/memory.internal.ts` 행 추가.
- `CONTEXT.md`에 "메모리 예산" 도메인 용어 추가 — `readMemoryBudget()`이 단일 소유자이고 fallback은 소비자별이 아니라 모듈 전체에 하나임을 명시.
- `CHANGELOG.md` `[Unreleased]` → `### 수정`(Fixed) — `ResizePerformance`(`getMemoryInfo()`)와 `ImageErrorHandler`(`collectEnhancedContext()`)가 `/advanced` 진입점으로 공개돼 있어(`src/advanced-index.ts:36`, `:62`), fallback 통일이 소비자 관측 가능 변화다. `ResizePerformance.getMemoryInfo()`의 fallback이 `{ usedMB: 0, limitMB: 0, pressureLevel: 'low' }` → `{ usedMB: 128, limitMB: 512, pressureLevel: 'low' }`로, `ImageErrorHandler.collectEnhancedContext()`가 이 환경에서도 이제 `debug.memory*`를 채운다는 점을 적는다.

## 비범위

- `high-res-manager.ts`와 `auto-high-res.ts`의 임계값 불일치(별도 review 카드 영역 — "같은 결정, 다른 숫자"). 메모리 압박 판정 자체가 아니라 해상도 처리 전략 선택 임계값이라 다른 문제다.
- `canvas-pool`의 풀 크기 임계값(1024/512/256MB), `smart-processor`의 20% 계산, `auto-memory-manager`의 0.8 압박 임계값, `high-res-manager`의 0.8 압박 임계값 — 전부 소비자 정책으로 남기고 값을 재산정하지 않는다.
- `tiled-processor.internal.ts`의 gc 트리거를 압력 기반으로 바꾸는 것(현재는 플래그만으로 무조건 호출). 동작을 바꾸지 않는 이관만 한다.
- `AutoMemoryManager`를 이 모듈로 흡수하는 것. `AutoMemoryManager`는 최적화 오케스트레이션(캔버스 풀 정리, 재시도 쿨다운, 통계)을 소유한 별개 모듈이고 이 설계는 그 원시 데이터 소스만 교체한다.

## 재검토 조건

- fallback 통일 이후 실제 사용 환경(Firefox/Safari 등)에서 압박 분기 오탐/미탐 리포트가 들어오면 `FALLBACK_BUDGET` 값을 재논의한다.
- `tiled-processor`의 무조건 gc 호출이 실제로 성능 문제로 보고되면 압력 기반 게이팅 추가를 별도 설계로 다룬다.
