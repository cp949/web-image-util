# 고해상도 전략 선택 경계값 중복 제거 설계

## 배경

`docs/maintenance-risks.md`가 Medium 우선순위로 추적하던 "고해상도 전략 선택 임계값 불일치" 항목은 `high-res-detector`의 16/64/256MB, `high-res-manager.selectMemoryEfficientStrategy`의 32MB, `selectFastStrategy`의 64MB, `selectHighQualityStrategy`의 256MB가 "각자 다른 숫자"라고 서술해왔다. `docs/design/2026-08-14-resize-strategy-seam-design.md`와 `docs/design/2026-08-14-high-res-entry-gate-design.md`가 순서대로 이 지점을 비범위 처리하며 남긴 재검토 조건("같은 이미지가 호출 경로에 따라 다른 전략으로 처리됨이 실제 버그로 보고되면 별도 카드로 통합을 다룬다")도 충족돼 있다 — `forceStrategy`가 더 이상 상시 주입되지 않아(`AutoHighResProcessor·SmartProcessor 이중 래퍼 통합` 카드 완료) 아래 표의 3개 select 함수가 이제 실제로 도달 가능하다.

이번 카드를 준비하며 정확한 값을 다시 대조한 결과, "4곳이 각자 다른 숫자"라는 원래 서술은 부정확했다.

| 파일 | 함수 | 경계 | detector의 `MEMORY_THRESHOLDS`와 관계 |
| --- | --- | --- | --- |
| `src/base/high-res-detector.internal.ts:130-150` | `determineStrategy()` | `≤16MB` DIRECT / `16~64MB` TILED / `64~256MB` STEPPED / `>256MB` TILED | 정의 당사자 |
| `src/base/high-res-manager.ts:184-190` | `selectFastStrategy()` | `≤64MB` DIRECT, 초과 TILED | **`MEDIUM`(64MB)과 정확히 같은 값 — 리터럴 중복** |
| `src/base/high-res-manager.ts:196-215` | `selectHighQualityStrategy()` | `≤256MB`(+scaleRatio<0.3) STEPPED, `>256MB` TILED | **`LARGE`(256MB)와 정확히 같은 값 — 리터럴 중복** |
| `src/base/high-res-manager.ts:171-176` | `selectMemoryEfficientStrategy()` | `≤32MB` DIRECT, 초과 TILED | `MEMORY_THRESHOLDS`(16/64/256MB) 어디에도 없는 값 — **중복 아님, 독립 로컬 정책** |
| `src/core/auto-high-res.ts:64,321` | `determineOptimalStrategy()`의 `autoTileThreshold` | 300MB | 전략 선택에 관여하지 않는다(아래 참고) — **애초에 이 표의 대상이 아니었다** |

`autoTileThreshold`(300MB)는 `checkAndManageMemory()`류 경고 임계값과 결과 메타데이터(`memoryOptimized`/`tileProcessing` 플래그)에만 쓰이고, `HighResolutionManager.selectOptimalStrategy()`가 참조하지 않는다 — direct/stepped/tiled 판정과 무관하다.

즉 실제로 중복된 숫자는 **64MB와 256MB 둘뿐**이다. 32MB는 어디에도 중복되지 않은 독립값이라 "통합 대상"이 아니라 원래부터 제자리였다.

**리포트에서 재현한 동작 불일치("같은 40MB 이미지가 priority에 따라 DIRECT/TILED로 갈린다")는 이 리터럴 중복과는 별개 원인이다.** balanced(`determineStrategy()`)는 "16MB 초과면 이미 TILED"라는 공격적 정책이고, fast(`selectFastStrategy()`)는 "64MB 이하면 DIRECT 허용"이라는 관대한 정책이다 — 숫자가 우연히 갈린 게 아니라 두 함수가 같은 64MB 경계를 반대 방향으로 쓴다. 이 설계에서 64MB 리터럴을 단일 소스로 교체해도 두 함수의 정책 방향 자체는 바뀌지 않으므로 이 불일치는 사라지지 않는다 — 사라지는 것은 "우연한 매직넘버 중복"이고, 남는 것은 "의도적으로 보이는 정책 차이"다(아래 "비범위" 참고).

## 결정

**동작 변화 없음.** 64MB·256MB 리터럴 두 곳만 `HighResolutionDetector`가 소유한 값 참조로 교체한다. 32MB(`selectMemoryEfficientStrategy`)와 300MB(`autoTileThreshold`)는 손대지 않는다.

`HighResolutionDetector`의 `MEMORY_THRESHOLDS`는 `private static readonly`라 클래스 밖에서 참조할 수 없다. 맵 전체를 `public`으로 여는 대신, 실제로 필요한 두 값만 이름 붙인 좁은 상수로 노출한다.

```ts
static readonly MEDIUM_MEMORY_THRESHOLD_MB = 64;
static readonly LARGE_MEMORY_THRESHOLD_MB = 256;
```

`MEMORY_THRESHOLDS.MEDIUM`/`.LARGE`는 이 두 상수에서 유도해(바이트 변환만) 같은 숫자 64/256을 두 번 적지 않는다. `SMALL`(16MB)은 어떤 select 함수도 참조하지 않으므로 공개하지 않는다.

같은 클러스터의 죽은 코드도 함께 정리한다 — `AutoMemoryManager.recommendProcessingStrategy()`/`canProcessLargeImage()`/`estimateImageMemoryUsage()`는 정의부와 자기 테스트 외 참조 0건이고, `resize-strategy-seam-design.md`가 이미 "무호출 죽은 코드, 비범위"로 명시하고 지나간 항목이다. 이번 카드에서 다시 마주치므로 같은 diff에서 삭제한다.

## 변경 상세

**`src/base/high-res-detector.internal.ts`**

```ts
// 변경 전 (36-40행)
private static readonly MEMORY_THRESHOLDS = {
  SMALL: 16 * 1024 * 1024, // 16MB - direct processing
  MEDIUM: 64 * 1024 * 1024, // 64MB - chunk processing
  LARGE: 256 * 1024 * 1024, // 256MB - stepped processing
};

// 변경 후
/**
 * Single source for the boundaries selectFastStrategy()/selectHighQualityStrategy()
 * (high-res-manager.ts) compare against. These used to carry their own 64/256
 * literals that happened to match MEDIUM/LARGE below — same numbers, different
 * source, no compiler-enforced link between them.
 */
static readonly MEDIUM_MEMORY_THRESHOLD_MB = 64;
static readonly LARGE_MEMORY_THRESHOLD_MB = 256;

private static readonly MEMORY_THRESHOLDS = {
  SMALL: 16 * 1024 * 1024, // 16MB - direct processing
  MEDIUM: HighResolutionDetector.MEDIUM_MEMORY_THRESHOLD_MB * 1024 * 1024, // chunk processing
  LARGE: HighResolutionDetector.LARGE_MEMORY_THRESHOLD_MB * 1024 * 1024, // stepped processing
};
```

`determineStrategy()`/`calculateComplexity()`/`estimateProcessingTime()`/`getOptimalChunkSize()`는 계속 `MEMORY_THRESHOLDS.SMALL`/`.MEDIUM`/`.LARGE`(바이트)를 읽으므로 무변경.

**`src/base/high-res-manager.ts`**

```ts
// 변경 전 (184-190행)
private static selectFastStrategy(analysis: ImageAnalysis): ProcessingStrategy {
  // Select simplest strategy first for fast processing
  if (analysis.estimatedMemoryMB <= 64) {
    return ProcessingStrategy.DIRECT;
  }
  return ProcessingStrategy.TILED;
}

// 변경 후
private static selectFastStrategy(analysis: ImageAnalysis): ProcessingStrategy {
  // Select simplest strategy first for fast processing
  if (analysis.estimatedMemoryMB <= HighResolutionDetector.MEDIUM_MEMORY_THRESHOLD_MB) {
    return ProcessingStrategy.DIRECT;
  }
  return ProcessingStrategy.TILED;
}
```

```ts
// 변경 전 (205행, 210행 — selectHighQualityStrategy 본문 중)
if (scaleRatio < 0.3 && analysis.estimatedMemoryMB <= 256) {
  return ProcessingStrategy.STEPPED;
}

if (analysis.estimatedMemoryMB > 256) {
  return ProcessingStrategy.TILED;
}

// 변경 후
if (scaleRatio < 0.3 && analysis.estimatedMemoryMB <= HighResolutionDetector.LARGE_MEMORY_THRESHOLD_MB) {
  return ProcessingStrategy.STEPPED;
}

if (analysis.estimatedMemoryMB > HighResolutionDetector.LARGE_MEMORY_THRESHOLD_MB) {
  return ProcessingStrategy.TILED;
}
```

`HighResolutionDetector`는 이미 6행에서 값으로 import돼 있어 import 변경 없음. `selectMemoryEfficientStrategy()`(171-176행)의 `32`는 그대로 둔다 — 위 "배경" 표대로 어디에도 중복되지 않는다.

**`src/core/auto-memory-manager.internal.ts`**

- 92-143행(`canProcessLargeImage()`·`estimateImageMemoryUsage()`·`recommendProcessingStrategy()`와 각 JSDoc) 삭제. `getMemoryInfo()`(88-90행) 바로 다음 빈 줄 하나를 사이에 두고 `getOptimizationStats()`(옛 144행)로 이어진다.
- `recommendProcessingStrategy()`가 반환하던 4값 유니온(`'direct'|'chunked'|'tiled'|'memory-efficient'`)은 `ProcessingStrategy`와 무관한 자체 타입이었다 — 삭제로 함께 사라진다. `'chunked'`라는, 이미 `resize-strategy-seam-design.md`에서 `ProcessingStrategy`를 3값으로 좁히며 없앤 값이 이 파일에만 화석처럼 남아있던 것도 해소된다.

## 테스트 계약

**신규** — `tests/unit/base/high-res-detector.test.ts`에 새 상수를 고정하는 describe 추가:

```ts
describe('MEDIUM_MEMORY_THRESHOLD_MB / LARGE_MEMORY_THRESHOLD_MB', () => {
  it('selectFastStrategy/selectHighQualityStrategy가 참조하는 경계값을 고정한다', () => {
    expect(HighResolutionDetector.MEDIUM_MEMORY_THRESHOLD_MB).toBe(64);
    expect(HighResolutionDetector.LARGE_MEMORY_THRESHOLD_MB).toBe(256);
  });
});
```

**무변경** — `tests/unit/core/high-res-manager-smart-resize-strategy-jsdom.test.ts`·`high-res-manager-validate-jsdom.test.ts`. 관련 테스트들은 이미 `toBe(64)`처럼 숫자를 직접 assert하지 않고, 경계 좌우로 계산한 이미지 크기를 넣어 "어떤 전략이 나오는지"만 검증한다 — 동작이 안 바뀌므로 그대로 통과한다. 테스트가 새 상수를 import해 경계를 계산하게 바꾸지 않는다 — 구현과 같은 값을 참조하면 그 값 자체가 틀려도 테스트가 못 잡는 tautology가 생긴다. 지금 테스트는 관찰 가능한 동작(전략 선택 결과)만 보고 있어 이미 안전하다.

**삭제** — `tests/unit/core/auto-memory-manager.test.ts`의 `estimateImageMemoryUsage`(20-39행)·`canProcessLargeImage`(41-65행)·`recommendProcessingStrategy`(67-108행) describe 3블록(20-109행). `checkAndOptimize`/`reset`/`getOptimizationStats` describe는 무변경.

## 문서 계약

- `docs/architecture.md:79` — `src/base/high-res-detector.internal.ts` 행 설명에 "`high-res-manager.ts`의 direct/tiled(64MB)·stepped/tiled(256MB) 선택 경계 단일 소유"를 추가.
- `docs/maintenance-risks.md:11` — "고해상도 전략 선택 임계값 불일치" 행을 좁힌다: 64MB·256MB 리터럴 중복은 이 설계로 해소됨을 명시하고, 32MB는 재조사 결과 애초에 중복이 아니었음(독립 로컬 정책)을 남긴다. 남는 실제 이슈는 "임계값 숫자 불일치"가 아니라 "balanced(공격적)와 fast(관대)의 정책 방향 자체가 다르다"로 재정의한다.
- `CHANGELOG.md` — **엔트리 없음.** `HighResolutionDetector`는 `src/index.ts`/`src/advanced-index.ts` 어디에서도 재노출되지 않는 순수 내부 클래스(`.internal.ts`)이고, 새로 여는 두 상수도 공개 표면에 닿지 않는다. `selectFastStrategy`/`selectHighQualityStrategy`/`selectMemoryEfficientStrategy`는 이미 `private`이라 관찰 가능한 동작이 없다(이번 결정: 순수 구조 정리, 값 변경 없음). `AutoMemoryManager`의 삭제 대상 3개 메서드도 참조 0건이라 제거가 관찰 가능한 변화를 만들지 않는다.

## 비범위

- balanced(`determineStrategy()`, 16MB 초과 TILED)와 fast(`selectFastStrategy()`, 64MB 이하 DIRECT)의 정책 방향 자체가 다른 문제. 리터럴 통합으로는 해소되지 않으며, 우선순위별 트레이드오프를 다시 설계하는 문제라 이 카드의 목적(locality)을 넘는다.
- `selectMemoryEfficientStrategy()`의 32MB를 `HighResolutionDetector`로 옮기는 것. 어디에도 중복되지 않는 독립 로컬 정책값이라 옮길 이유가 없다 — 옮기면 "왜 32만 옮겼나"라는 새 의문만 만든다.
- `auto-high-res.ts`의 `autoTileThreshold`(300MB). 전략 선택에 관여하지 않는 별개 메타데이터(경고 임계값·결과 안내 문구 전용)라 애초에 이 표의 대상이 아니었다.
- `MEMORY_THRESHOLDS.SMALL`(16MB)의 공개화. 어떤 select 함수도 참조하지 않는다.

## 재검토 조건

- balanced/fast/pressure의 정책 방향 불일치가 실제 버그로 보고되면(예: "같은 이미지가 fast 모드에서만 흐려지지 않는다" 같은 사용자 리포트) 별도 카드로 정책 자체를 재설계한다.
- `selectMemoryEfficientStrategy()`의 32MB가 이후 detector의 기존 밴드 중 하나와 실제로 값이 같아지는 변경(예: `SMALL`을 32MB로 조정)이 생기면 그때 단일 소유로 흡수한다.
