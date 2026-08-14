# 고해상도 전략 seam 축소 설계

## 배경

`src/base/resize-strategy.internal.ts`의 `RESIZE_STRATEGY_ADAPTERS`는 4행(`direct`/`chunked`/`stepped`/`tiled`)이지만 실행기는 2개뿐이다. `chunkedAdapter`와 `tiledAdapter`는 둘 다 `TiledProcessor.resizeInTiles()`를 호출하고, 차이는 넘기는 옵션 프리셋뿐이다.

```ts
// chunkedAdapter
TiledProcessor.resizeInTiles(img, w, h, {
  tileSize: Math.min(2048, analysis.recommendedChunkSize),
  maxConcurrency: 2,
});
// tiledAdapter
TiledProcessor.resizeInTiles(img, w, h, {
  maxConcurrency: quality === 'fast' ? 4 : 2,
  enableMemoryMonitoring: true,
});
```

소비자는 1개(`HighResolutionManager`), 외부 adapter는 0개, `ResizeStrategyAdapter.id`가 `ProcessingStrategy`(닫힌 4값 유니온)에 묶여 있어 확장도 닫혀 있다. adapter 1개는 가설, 2개는 실재라는 이 리뷰의 seam 규칙에 비추면 이 레지스트리는 실제 변주(2개)보다 큰 행 수(4개)를 갖고 있다.

`enableMemoryMonitoring`은 실제로는 두 adapter가 같은 값이다 — `chunkedAdapter`는 이 옵션을 아예 넘기지 않아 `TiledProcessor.DEFAULT_OPTIONS.enableMemoryMonitoring = true`가 그대로 적용된다. 진짜 차이는 `tileSize`(chunked는 `min(2048, recommendedChunkSize)` 명시, tiled는 미지정 → 기본 1024)와 `maxConcurrency`(chunked는 고정 2, tiled는 quality 따라 2/4) 둘뿐이다.

`ResizeStrategyAdapter.timeMultiplier`(정적 `readonly number`)도 4개 adapter가 각자 값(direct 1.0, chunked 1.0, stepped 1.5, tiled 2.0)을 갖고, `HighResolutionManager.validateProcessingCapability()`(368행)가 이 값을 읽어 `HighResolutionDetector.estimateProcessingTime()`의 결과에 곱한다 — chunked와 tiled가 이 배수에서도 갈린다(1.0 vs 2.0).

"chunked를 언제 쓸지"는 4개 지점이 각자 다른 숫자로 판정한다:

| 파일 | 함수 | 판정 기준 |
| --- | --- | --- |
| `src/base/high-res-detector.internal.ts:91` | `determineStrategy()` | `estimatedMemory` 16~64MB → CHUNKED |
| `src/base/high-res-manager.ts:167` | `selectMemoryEfficientStrategy()` | `estimatedMemoryMB` 32~128MB → CHUNKED |
| `src/base/high-res-manager.ts:180` | `selectFastStrategy()` | `estimatedMemoryMB` 64~128MB → CHUNKED |
| `src/core/smart-processor.internal.ts:155` | `selectInternalStrategy()` | `pixelCount` 4M~16M px → `'chunked'` |

`src/core/auto-high-res.ts:61`의 `autoTileThreshold`(300MB)는 CHUNKED를 직접 반환하진 않지만 "강제 전략을 걸지/메모리 최적화로 볼지"를 가르는 또 다른 독립 숫자다. 카드가 원문에서 "경쟁하는 임계값 한 벌 더"로 지목한 지점이다.

`resize-strategy.internal.ts` 자체의 전용 테스트는 0개다(`high-res-manager-smart-resize-strategy-jsdom.test.ts`가 간접적으로만 건드린다).

## 결정

`ProcessingStrategy` 유니온에서 `CHUNKED`를 제거한다 — `'direct' | 'stepped' | 'tiled'` 3값. `chunked`가 하던 일(작은 타일, 낮은 동시성)은 `tiledAdapter.execute()` 내부의 preset 선택 로직으로 흡수한다:

```ts
// resize-strategy.internal.ts, tiledAdapter.execute 내부
const isLight = analysis.estimatedMemoryMB <= 64; // high-res-detector의 기존 MEDIUM 경계 재사용 — 새 숫자를 만들지 않는다
const preset = isLight
  ? { tileSize: Math.min(2048, analysis.recommendedChunkSize), maxConcurrency: 2 }
  : { maxConcurrency: quality === 'fast' ? 4 : 2 };
// enableMemoryMonitoring은 두 preset 모두 true — 기존에도 갈리지 않던 값이라 분기하지 않는다
```

`timeMultiplier`도 같은 기준으로 preset을 따라가야 한다 — 정적 `readonly number`로는 표현할 수 없으므로 `ResizeStrategyAdapter` 인터페이스를 바꾼다:

```ts
// 변경 전: readonly timeMultiplier: number;
// 변경 후:
getTimeMultiplier(analysis: ImageAnalysis): number;
```

`direct`/`stepped`는 `() => 1.0`/`() => 1.5`로 analysis를 무시하고, `tiled`는 `(analysis) => analysis.estimatedMemoryMB <= 64 ? 1.0 : 2.0`(기존 chunked/tiled 값 그대로 보존). 호출부 `high-res-manager.ts:368`도 `?.timeMultiplier` → `?.getTimeMultiplier(analysis)`로 바뀐다 — `analysis`는 이미 그 스코프에 있다. `ResizeStrategyAdapter`는 `.internal.ts`이고 public 진입점(`advanced-index.ts`)에 재노출되지 않아 이 인터페이스 변경은 breaking change가 아니다.

"tiled를 쓰기로 한 뒤 어떤 preset을 쓸지"는 이제 이 한 곳(+ `getTimeMultiplier`)만 판정한다. "애초에 direct/stepped/tiled 중 뭘 쓸지"를 고르는 4개 지점(위 표 + `auto-high-res.ts`)의 상호 불일치는 이 설계로 없어지지 않는다 — 그건 "메모리 예산 모듈" 설계(`docs/design/2026-08-14-memory-budget-module-design.md`)가 이미 명시적으로 비범위 처리한 별도 문제이고, 이번 카드도 그 범위를 넘지 않는다(아래 "비범위" 참고).

**행동 변화(의도됨):** `forceStrategy`로 명시적으로 `'tiled'`를 지정해도, 이제 어떤 preset을 쓸지는 호출자의 의도가 아니라 `analysis.estimatedMemoryMB`가 정한다. 예: 작은 이미지(≤64MB)에 `forceStrategy: 'tiled', quality: 'fast'`를 줘도 이제 `maxConcurrency`는 4가 아니라 2다(light preset은 quality를 안 본다) — 이전엔 `forceStrategy`가 대형 이미지 여부와 무관하게 항상 tiled의 quality-종속 동시성을 줬다. 카드 원문이 "chunked/tiled는 전략이 아니라 옵션 preset"이라고 명시했으므로, preset을 개별적으로 강제하는 경로 자체를 없애는 것이 의도된 결과다.

`ProcessingStrategy`는 `advanced-index.ts`가 재노출하는 `HighResolutionOptions.forceStrategy`/`ProcessingResult.strategy`에 구조적으로 걸려 있는 public 타입이다. `'chunked'` 제거는 이 두 타입의 값 공간을 4→3으로 줄이는 breaking change다. 이 프로젝트는 `CHANGELOG.md`에서 이미 여러 차례 타입 축소를 `Changed (**Breaking**)`로 문서화해왔다(필터 플러그인 표면 통일, 확장자 정책 통일 등) — 하위호환 alias 없이 같은 방식을 따른다. 마이그레이션은 `forceStrategy: 'chunked'` → `'tiled'` 한 줄이며, 같은 메모리 대역에서 같은 preset이 선택되므로 동작은 동치다.

`auto-memory-manager.internal.ts`의 `recommendProcessingStrategy()`도 `'chunked'`를 반환하는 자기 소유 4값 유니온(`'direct'|'chunked'|'tiled'|'memory-efficient'`)을 갖고 있지만, `ProcessingStrategy`와 타입이 무관하고 `src` 내 호출부가 없는 죽은 코드다. 이번 설계는 건드리지 않는다(비범위).

## 변경 상세

**`src/base/high-res-detector.internal.ts`**
- `ProcessingStrategy` 타입·값 객체에서 `CHUNKED` 제거.
- `determineStrategy()`: MEDIUM(16~64MB) 구간의 반환값을 `CHUNKED` → `TILED`로 교체. 경계값(16/64/256MB)은 그대로 둔다 — 밴드를 바꾸는 게 아니라 그 밴드에 붙는 이름을 바꾸는 것이다.
- `calculateComplexity(pixelCount, strategy)`(115행)에 세 번째 인자 `estimatedMemoryMB: number`를 추가한다. `analyzeImage()`(69행 호출부)는 이미 `estimatedMemoryMB`를 계산해 갖고 있어 전달만 하면 된다. `TILED` case를 `estimatedMemoryMB <= 64 ? 'medium' : 'extreme'`로 만든다 — 옛 `CHUNKED`(항상 `'medium'`)와 옛 `TILED`(항상 `'extreme'`)를 그대로 보존하는 값이다(그대로 두면 옛 chunked 대역이 `'extreme'`로 튀어 `estimateProcessingTime`의 배수(아래)까지 잘못 부풀린다).
- `estimateProcessingTime(analysis)`(241행)의 `TILED` case를 `analysis.estimatedMemoryMB <= 64` 분기로 나눈다 — light는 옛 chunked 값(`baseTime = megaPixels * 0.2`, `multiplier = 1.2`, factors `'Chunk processing - memory efficient'`), heavy는 옛 tiled 값(`baseTime = megaPixels * 0.5`, `multiplier = 2.0`, factors `'Tile processing - ultra-large images'`) 그대로 유지한다. `analysis`를 이미 통째로 받고 있어 시그니처 변경은 없다.
- `getStrategyDescription()`(307행)의 `CHUNKED` case(322행)를 제거하고 `TILED` case(338행)의 `advantages`/`disadvantages`에 옛 chunked 항목(`'Memory efficient'`, `'Stable processing'`, `'Suitable for medium-sized images'` / `'Increased processing time'`, `'Boundary processing required'`)을 옛 tiled 항목과 합쳐 넣는다. 이 함수는 순수 설명 텍스트만 반환하고 수치 계산에 관여하지 않아 리스크가 낮다.

**`src/base/resize-strategy.internal.ts`**
- `chunkedAdapter` 삭제.
- `ResizeStrategyAdapter.timeMultiplier: number` → `getTimeMultiplier(analysis: ImageAnalysis): number`로 인터페이스 변경(위 "결정" 참고). `direct`/`stepped`는 각각 `() => 1.0`/`() => 1.5`, `tiled`는 analysis 기반 분기.
- `tiledAdapter.execute()`가 위 "결정"의 preset 분기를 갖는다. `RESIZE_STRATEGY_ADAPTERS`는 `direct`/`stepped`/`tiled` 3행.
- `ResizeStrategyInput` 인터페이스는 변경 없음(이미 `analysis: ImageAnalysis` 전체를 받고 있어 preset 판정에 필요한 `estimatedMemoryMB`·`recommendedChunkSize`가 이미 들어온다).

**`src/base/high-res-manager.ts`**
- `selectMemoryEfficientStrategy()`(167행): `CHUNKED` 분기 제거, `TILED` 분기로 흡수 → `estimatedMemoryMB > 32` 하나로 direct/tiled 2지 분기.
- `selectFastStrategy()`(180행): 동일하게 `CHUNKED` 분기를 `TILED`로 흡수 → `estimatedMemoryMB <= 64` 기준 2지 분기.
- `selectHighQualityStrategy()`(194행)는 `CHUNKED`를 원래 쓰지 않아 무변경.
- `validateProcessingCapability()`(368행): `getResizeStrategyAdapter(recommendedStrategy)?.timeMultiplier ?? 1` → `getResizeStrategyAdapter(recommendedStrategy)?.getTimeMultiplier(analysis) ?? 1`.

**`src/core/auto-high-res.ts`**
- `autoTileThreshold`(300MB, 64행)는 역할·값 그대로 유지한다 — "강제 전략을 걸지 여부"라는 원래 역할이지 chunked/tiled 구분자가 아니었다.
- `determineOptimalStrategy()`가 참조하는 `analysis.strategy`가 더 이상 `CHUNKED`를 내놓지 않으므로 이 파일 자체의 로직 변경은 없다(참조하는 타입의 값 공간만 줄어든다).

**`src/core/smart-processor.internal.ts`**
- `selectInternalStrategy()`(155행): `'memory-efficient'` 분기(167행)의 `pixelCount > 16_000_000 ? 'tiled' : 'chunked'`를 무조건 `'tiled'`로 교체. `'auto'` 분기(175~181행)의 3지(tiled/chunked/stepped)를 `pixelCount > 4_000_000 ? 'tiled' : 'stepped'` 2지로 병합.

## 테스트 계약

신규 `tests/unit/base/resize-strategy.test.ts` — 이 파일의 첫 전용 테스트:
- `RESIZE_STRATEGY_ADAPTERS`가 정확히 3키(`direct`/`stepped`/`tiled`)를 갖는다.
- `getResizeStrategyAdapter('chunked' as any)` → `undefined`(레지스트리에 없는 키 방어).
- `tiledAdapter.execute()` — `analysis.estimatedMemoryMB`가 64 이하일 때 light preset(`tileSize`가 `recommendedChunkSize` 기준, `maxConcurrency: 2`)으로, 64 초과일 때 heavy preset(`maxConcurrency`가 quality 종속)으로 `TiledProcessor.resizeInTiles`를 호출하는지 스파이로 검증. 두 preset 모두 `enableMemoryMonitoring: true`.
- `tiledAdapter.getTimeMultiplier(analysis)` — 64MB 경계로 1.0/2.0을 반환.

기존 4개 테스트 파일 갱신:
- `tests/unit/base/high-res-detector.test.ts` — `CHUNKED`/`'chunked'` 기대값을 `TILED`/`'tiled'`로. "chunked 전략은 medium 복잡도이다" 테스트(113행)는 이름을 "16~64MB TILED는 medium 복잡도이다"로 바꾸고 그대로 `'medium'`을 기대한다(위 `calculateComplexity` 변경으로 동치 보존).
- `tests/unit/core/high-res-manager-smart-resize-strategy-jsdom.test.ts` — `forceStrategy="chunked"` 테스트 3개(135~185행)는 이미지가 300×300(≈0.34MB, light 대역)이라 `forceStrategy: ProcessingStrategy.TILED`로 바꿔도 같은 결과(`tileSize: 2048`, `maxConcurrency: 2`)를 기대할 수 있다. 단, 기존 `forceStrategy="tiled"` 테스트 중 quality="fast" 케이스(106~121행, 같은 300×300 이미지로 `maxConcurrency: 4`를 기대)는 이제 같은 light 대역에 걸려 `maxConcurrency: 2`가 나온다 — 이 테스트는 "행동 변화(의도됨)" 그대로이므로, 이미지 크기를 heavy 대역(예: 9000×9000, ≈309MB)으로 바꿔 옛 기대값(`maxConcurrency: 4`)을 heavy preset 테스트로 재확정한다. balanced quality의 TILED 기본 테스트(85~104행)도 같은 이유로 heavy 대역 이미지로 바꾼다.
- `tests/unit/core/high-res-manager-validate-jsdom.test.ts` — `CHUNKED` 기대값 3곳(121·217·250행)을 `TILED`로. `estimatedTime` 비교 테스트(140~149행, "TILED가 STEPPED보다 크다")는 이미지가 2200×2200(≈18.5MB, light 대역 → `getTimeMultiplier`가 1.0)이라 이제 TILED(1.0×) < STEPPED(1.5×)가 되어 실패한다 — 이미지를 heavy 대역(9000×9000)으로 바꿔 `getTimeMultiplier`가 2.0을 반환하도록 고친다.
- `tests/unit/core/smart-processor.test.ts` — `forceStrategy` 기대값 2곳(136·195행)을 `'chunked'` → `'tiled'`로.

`tests/unit/core/auto-memory-manager.test.ts`는 무변경(비범위 결정에 따름).

## 문서 계약

- `docs/architecture.md:77` — `resize-strategy.internal.ts` 행 설명의 "direct/chunked/stepped/tiled"를 "direct/stepped/tiled"로 갱신.
- `docs/maintenance-risks.md:11` — "고해상도 처리 로직 중복" 행의 이유를 좁힌다: adapter 레지스트리의 4→3 통합과 전용 테스트 신설로 이 리스크의 "adapter 중복" 부분은 해소되지만, "direct/stepped/tiled 선택 임계값 4개 지점 불일치"(위 배경 표)는 남는다는 점을 명시.
- `CHANGELOG.md` `[Unreleased]` → `### 변경`(Changed, **Breaking**) — `ProcessingStrategy`(`forceStrategy`/`ProcessingResult.strategy`)에서 `'chunked'` 제거, `'tiled'`로 마이그레이션.

## 비범위

- `high-res-detector`/`high-res-manager`/`auto-high-res`/`smart-processor` 4개 지점의 "direct/stepped/tiled 중 무엇을 쓸지" 판정 임계값 자체의 통합. 카드가 지목한 것은 chunked/tiled 구분(이제 tiled 내부 preset 판정 1곳으로 통합됨)이지, 이 4개 지점 전체의 임계값 통일이 아니다.
- `auto-memory-manager.internal.ts`의 `recommendProcessingStrategy()` 정리(무호출 죽은 코드, `ProcessingStrategy`와 무관한 별도 유니온).
- `TiledProcessor.resizeInTiles()` 시그니처 변경. 이미 필요한 옵션(`tileSize`/`maxConcurrency`/`enableMemoryMonitoring`)을 전부 받고 있어 adapter 레이어만 수정하면 된다.

## 재검토 조건

- `tiledAdapter`의 64MB 분기 기준이 실측(성능·메모리) 리포트로 부적절하다고 판명되면 별도 설계로 재조정한다.
- 남은 4개 지점의 direct/stepped/tiled 선택 임계값 불일치가 실제 버그(예: 같은 이미지가 호출 경로에 따라 다른 전략으로 처리됨)로 보고되면 별도 카드로 통합을 다룬다.
