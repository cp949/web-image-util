# ResizePerformanceOptions 유령 필드 제거 설계

## 배경

`ResizePerformanceOptions`(`src/core/performance-config.ts:11-23`)는 필드 4개를 공개 약속한다.

```ts
export interface ResizePerformanceOptions {
  concurrency?: number;
  timeout?: number;
  useCanvasPool?: boolean;
  memoryLimitMB?: number;
}
```

`RESIZE_PROFILES.fast/balanced/quality`(`src/core/performance-config.ts:33-57`) 세 프리셋 모두 네 필드를 채워 넘긴다. 하지만 이 값을 실제로 소비하는 `BatchResizer.processAll()`(`src/core/batch-resizer.ts:37-46`)은 `concurrency`/`timeout`만 읽는다.

```ts
async processAll<T>(jobs: BatchResizeJob<T>[]): Promise<T[]> {
  const concurrency = this.config.concurrency ?? 2;
  const timeout = this.config.timeout ?? 30;
  // ...
}
```

`useCanvasPool`·`memoryLimitMB`는 `BatchResizer` 어디에도 읽히지 않는다. `ResizePerformance.memoryEfficientBatch()`(`src/core/performance-utils.ts:118-128`)가 `memoryLimitMB: 64`·`useCanvasPool: false`를 명시적으로 설정해도 코드베이스 어디에도 전달되지 않는다 — 이 함수가 실제로 메모리를 아끼는 메커니즘은 같은 호출에 포함된 `forceStrategy: 'tiled'`뿐이다.

**연결 대상 후보 조사:** 코드베이스에 `CanvasPool`(`src/base/canvas-pool.internal.ts`)과 `AutoMemoryManager`(`src/core/auto-memory-manager.internal.ts`)가 실재하지만, 둘 다 **전역 싱글톤**(`getInstance()`)이다. `AutoMemoryManager.checkAndOptimize()`는 브라우저 실제 메모리 예산(`readMemoryBudget()`)만 참조하고, per-call `memoryLimitMB` 오버라이드 개념이 없다. `BatchResizer`가 생성하는 canvas는 자신이 아니라 `AutoHighResProcessor.smartResize()` 아래 계층(`HighResolutionManager`/`TiledProcessor`/`SteppedProcessor`)이 `CanvasPool`을 통해 빌린다 — `useCanvasPool` 값을 여기까지 흘려보내려면 새 배선을 여러 파일에 추가해야 한다.

이 두 필드를 언급하는 공개 문서(README, `docs/architecture.md`, CHANGELOG)는 없다 — 타입 시그니처 밖에 지켜야 할 약속이 없다.

## 결정

`useCanvasPool`·`memoryLimitMB`를 타입·프리셋·소비자에서 제거한다. 실제 기능에 연결하는 대안은 기각한다 — 전역 싱글톤(`CanvasPool`, `AutoMemoryManager`)에 per-`BatchResizer`-인스턴스 정책을 흘려보내는 새 배선이 필요하고, 동시에 실행되는 여러 `BatchResizer` 인스턴스가 서로 다른 `memoryLimitMB`/`useCanvasPool`을 요구하면 전역 상태가 충돌한다. 이 리뷰 시리즈가 지금까지 해온 방향(카드 1·2·4·6: 중복 정책을 없애거나 단일 게이트로 합류)과도 반대다.

**deletion test:** 두 필드를 지운 뒤 `pnpm typecheck`가 어떤 파일에서도 `Property 'useCanvasPool'/'memoryLimitMB' does not exist` 같은 에러를 내지 않아야 한다 — 실제 소비자가 없다는 가설의 실측 증거다.

## 변경 상세

**`src/core/performance-config.ts`**

- 11-23행 `ResizePerformanceOptions`에서 `useCanvasPool?: boolean;`(18-19행, JSDoc 포함)과 `memoryLimitMB?: number;`(21-22행, JSDoc 포함)를 삭제한다. `concurrency`/`timeout`만 남는다.
- 33-57행 `RESIZE_PROFILES`의 `fast`/`balanced`/`quality` 세 항목에서 각각 `useCanvasPool: true,`와 `memoryLimitMB: N,` 두 줄을 삭제한다.
- `getPerformanceConfig()`(62-70행)는 스프레드 기반이라 변경 없음.

**`src/core/performance-utils.ts`**

- `memoryEfficientBatch()`(118-128행) 생성자 인자에서 `useCanvasPool: false, // Disable pooling`과 `memoryLimitMB: 64, // Low memory limit` 두 줄을 삭제한다. `concurrency: 1`, `timeout: 120`, 이어지는 `forceStrategy: 'tiled'`는 유지한다.

**`src/core/batch-resizer.ts`**

- 변경 없음. 두 필드를 애초에 읽지 않았다.

## 테스트 계약

**`tests/unit/core/performance-config.test.ts`**

- `RESIZE_PROFILES` describe 블록: "fast/balanced/quality 프로파일은 ... 기본값을 가진다" 세 테스트에서 `memoryLimitMB`/`useCanvasPool` assertion 2줄씩 제거.
- "모든 프로파일에 useCanvasPool=true가 설정되어 있다"(37-43행) — 검증 대상 필드가 사라지므로 테스트 전체 삭제.
- "모든 프로파일이 필수 필드를 포함한다"(45-55행) — `toHaveProperty('useCanvasPool')`/`toHaveProperty('memoryLimitMB')` 두 줄 제거.
- `getPerformanceConfig()` describe 블록: "인자 없이/명시적으로 반환한다" 4개 테스트에서 `memoryLimitMB`/`useCanvasPool` assertion 제거.
- "override가 기본 프로파일 값에 병합된다"(95-105행), "빈 override 객체는..."(118-125행), "quality 프로파일에 override를 적용한다"(164-174행), "balanced 프로파일이 default 프로파일인지 검증한다"(176-184행)에서 같은 assertion 제거.
- "override는 지정한 키만 덮어쓰고 나머지는 유지된다"(107-116행) — override 대상이 `memoryLimitMB`였다. `timeout: 45`로 override하고 `concurrency`는 프로파일 값 그대로인지 검증하도록 재작성(같은 의도: override는 지정한 키만 덮어쓴다).
- "모든 override 필드를 동시에 덮어쓸 수 있다"(148-162행) — 남은 필드 `concurrency`/`timeout` 두 개만 동시 override하도록 재작성.

**`tests/unit/core/performance-utils.test.ts`**

- "profile 인자 없이 호출하면 현재 전역 프로파일 config를 반환한다"(62-67행), "profile 인자를 넘기면 해당 프로파일 config를 반환한다"(69-73행) — `expect(config.memoryLimitMB)...` 줄 제거.
- "memoryEfficientBatch는 concurrency 1, canvas pool 비활성, 64MB 정책으로 BatchResizer를 구성한다"(222-254행) — `toMatchObject`에서 `useCanvasPool: false,`/`memoryLimitMB: 64,` 제거(`concurrency: 1`/`timeout: 120`만 남음). 테스트 제목을 "memoryEfficientBatch는 concurrency 1, timeout 120으로 BatchResizer를 구성한다"로 바꾼다.

**`tests/unit/core/batch-resizer.test.ts`**

- "getConfig가 내부 설정을 변경할 수 없는 복사본을 반환한다"(20-40행) — constructor 인자·변경 시도·`toEqual` 기대값에서 `useCanvasPool`/`memoryLimitMB` 관련 줄 제거. `concurrency`/`timeout` 두 필드로 복사본 불변성을 계속 검증한다.
- "fast 프로필 문자열로..."(42-51행), "quality 프로필 문자열로..."(62-71행) — `toEqual` 기대값에서 `useCanvasPool`/`memoryLimitMB` 줄 제거.
- "balanced 프로필 문자열로..."(53-60행) — 이미 `toMatchObject`로 `concurrency`/`timeout`만 검증해 변경 없음.
- "concurrency/timeout을 생략한 config로 생성해도 모든 job을 처리한다"(81-90행) — `new BatchResizer({ useCanvasPool: false })`를 `new BatchResizer({})`로 바꾼다(이 테스트의 의도는 애초에 concurrency/timeout 생략이지, `useCanvasPool` 검증이 아니다).

## 문서 계약

- `CHANGELOG.md` `[Unreleased]` — `Changed (**Breaking**)` 항목 추가. 선례(같은 파일의 "필터 플러그인 타입에서 판독하는 코드가 없던 선택 멤버를 제거했습니다")와 같은 어조로, `ResizePerformanceOptions`/`RESIZE_PROFILES`/`memoryEfficientBatch()`에서 제거된 필드와 마이그레이션(해당 필드를 객체 리터럴로 넘기던 코드는 삭제)을 명시한다.
- `docs/architecture.md` — 이 두 필드를 언급하지 않아 변경 없음.
- `docs/maintenance-risks.md` — 이 항목은 애초에 등재된 적이 없어 변경 없음.
- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다.

## 비범위

- `useCanvasPool`/`memoryLimitMB`를 `CanvasPool`/`AutoMemoryManager`에 실제로 연결하는 방향(위 "결정"에서 기각).
- `batch-resizer.test.ts` 81-82행의 "concurrency, timeout 없이 생성하면 기존 코드에서는 빈 배열이 반환된다"는, 바로 아래 assertion(`results`가 3개 원소를 가진다)과 모순되는 낡은 주석이다. 이 카드와 무관해 손대지 않는다.
- 같은 리뷰 문서의 다른 카드(카드 4 `BlendMode`, 카드 9 `blur` 이름 충돌 등).
