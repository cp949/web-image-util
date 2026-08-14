# AutoHighResProcessor·SmartProcessor 이중 래퍼 통합 설계

## 배경

`HighResolutionManager` 위에 구조가 동일한 두 "친절한 래퍼"가 나란히 있다.

| | `AutoHighResProcessor`(공개, `advanced-index.ts` 재노출) | `SmartProcessor`(`.internal.ts`, `performance-utils.ts`를 통해서만 도달) |
| --- | --- | --- |
| 어휘 | `priority: 'speed'\|'balanced'\|'quality'` | `strategy: 'auto'\|'fast'\|'quality'\|'memory-efficient'` |
| direct-draw fallback | `standardResize()` | `simpleResize()`(smoothing이 `'high'`로 고정 — priority/strategy 무시) |
| 진입 게이트 | `HighResolutionDetector.shouldUseHighResolutionPath()` 공유(완료 — `2026-08-14-high-res-entry-gate-design.md`) | 상동 |

`resize-strategy.internal.ts`의 `directAdapter`까지 포함하면 "그냥 canvas에 그리는" 구현이 3곳이다.

`AdvancedImageProcessor`(`advanced-processor.ts`)는 이미 `AutoHighResProcessor` 하나로 수렴돼 있다 — 이 카드가 손댈 대상이 아니다.

**카드 1(`2026-08-14-high-res-entry-gate-design.md`)이 이 카드로 넘긴 몫.** 두 클래스의 전략 선택 함수(`AutoHighResProcessor.determineOptimalStrategy()`, `SmartProcessor.selectInternalStrategy()`)는 거의 모든 경로에서 `forceStrategy`를 채운다. 그 결과 `HighResolutionManager.selectOptimalStrategy()`의 실제 선택 로직 — `selectMemoryEfficientStrategy`(32MB 경계), `selectFastStrategy`(64MB 경계), `selectHighQualityStrategy`(scaleRatio<0.3 → stepped, >256MB → tiled) — 가 `smartResize()` 처리 경로에서 도달 불가능하다. 이 세 메서드는 오직 `validateProcessingCapability()`(사전 점검, `tests/unit/core/high-res-manager-validate-jsdom.test.ts`)를 통해서만 테스트되며, 실제 리사이즈 경로에서 호출된 적이 코드베이스 어디에도 없다(`grep`으로 확인 — `tests/unit/core/high-res-manager-smart-resize-strategy-jsdom.test.ts`는 `forceStrategy`를 항상 명시적으로 주고 `HighResolutionManager.smartResize()`를 직접 호출한다). 카드 1의 재검토 조건이 기록한 재현된 버그(저픽셀+고스케일 이미지가 게이트를 통과해도 `forceStrategy:'direct'`로 귀결)의 근본 원인이 여기 있다.

관련 문서: `docs/design/2026-08-14-high-res-entry-gate-design.md`, `docs/maintenance-risks.md`(Medium 항목), 아키텍처 리뷰 카드 2(`_tmp/arch-review/02.html#card-2`).

## 결정

`AutoHighResProcessor`로 수렴시킨다. `SmartProcessor` 클래스와 `smart-processor.internal.ts` 파일을 삭제하고, 유일하게 남던 배치 편의 메서드(`resizeBatch`/`processBatch`)는 `performance-utils.ts`의 모듈 함수로 이관한다 — 상태 없는 정적 메서드 2개만 남는 클래스 껍데기를 유지하지 않는다(같은 원칙을 `plugin-system.ts`가 이미 명시하고 있고, 이 아키텍처 리뷰의 다른 카드가 `BrowserCapabilityDetector`에서 지적한 패턴이기도 하다).

### 1. 어휘 통합 — `priority` 하나로, `strategy` 폐기

| 기존 `SmartResizeOptions.strategy` | 새 `priority` |
| --- | --- |
| `'fast'` | `'speed'` |
| `'quality'` | `'quality'` |
| `'auto'` | `'balanced'` |
| `'memory-efficient'` | `'speed'` + 아래 2번의 `forceStrategy:'tiled'` 명시 override |

### 2. `forceStrategy` escape hatch 신설

`AutoHighResProcessor.smartResize()` options에 `forceStrategy?: ProcessingStrategy`(`'direct'|'stepped'|'tiled'`)를 추가한다 — `HighResolutionOptions.forceStrategy`와 이름·타입을 맞춘 것으로 새 공개 개념을 만들지 않는다. 기존 호출자는 영향 없음(additive). 오직 `ResizePerformance.memoryEfficientBatch()`만 이 필드를 채운다.

### 3. `determineOptimalStrategy()` 재설계

지금은 `speed`(고메모리일 때만)/`quality`/`balanced` 세 갈래 모두 `processingStrategy`를 채워 `HighResolutionManager`의 실제 선택 로직을 우회한다. 새 버전은 **`quality`만 파생하고 `forceStrategy`는 호출자가 2번을 통해 명시한 경우에만** 채운다 — 나머지는 `HighResolutionManager.selectOptimalStrategy()`가 `opts.quality` 기준으로 직접 고르게 둔다.

**행동 변화(의도됨):** `priority:'high'` 요청이 scaleRatio<0.3인 이미지에서 이제 실제로 `selectHighQualityStrategy()`를 거쳐 `stepped`를 선택할 수 있다(전에는 `analysis.strategy`로 강제 귀결). 메모리 압박(`isMemoryLow()`, pressure>0.8) 상황에서 `selectMemoryEfficientStrategy()`(32MB 경계)가 처음으로 실제 실행 경로에 들어온다. `priority:'speed'`는 이제 항상 `selectFastStrategy()`(64MB 경계)를 거친다(전에는 `isHighMem`이 false일 때만 우회하며 이때도 결국 `analysis.strategy`로 귀결).

### 4. direct-draw fallback 통합

3곳 → 1곳. `SmartProcessor.simpleResize()`는 클래스 삭제로 자동 소멸(부수 효과로 `applySmoothing(ctx,'high')` 고정 버그도 함께 해소). `AutoHighResProcessor.standardResize()`는 몸통을 `getResizeStrategyAdapter(ProcessingStrategy.DIRECT).execute()` 호출로 교체한다 — `resize-strategy.internal.ts`의 `directAdapter`가 유일한 실제 그리기 구현이 된다.

`HighResolutionManager.smartResize()` 전체(재분석·메모리 체크·progress tracker)를 경유하지 않는다 — 게이트가 표준 이미지를 가볍게 처리하려고 존재하는 이상, 그 이미지들에 메모리 체크·세밀한 progress 단계를 새로 추가하지 않는다. 동작 변화 없음.

### 5. `maxMemoryUsageMB` 정책 통일

`SmartProcessor.getAutoMemoryLimit()`(가용 메모리의 20%, 동적)를 폐기하고 `AutoHighResProcessor`의 정적 임계값(`thresholds.autoTileThreshold` 300MB, quality는 ×1.5)으로 통일한다. `fastResize`/`qualityResize`/`autoResize`/`ResizePerformance.*Batch` 호출자가 받는 캡이 동적→정적으로 바뀐다.

동적 20% 캡은 `HighResolutionManager.checkAndManageMemory()`의 경고 조건(`budget.availableMB < opts.maxMemoryUsageMB`)에서 `availableMB < availableMB*0.2`꼴이 되어 사실상 항상 거짓 — 실질적 무동작에 가까웠다(같은 호출 안에서 두 값을 같은 스냅샷으로 계산하므로). 확정 검증은 이 카드 범위 밖이며, "이미 죽어 있던 정책의 정리"로 취급한다.

### 6. 메모리 정리 승격

`AutoMemoryManager.checkAndOptimize()`(pressure>0.8 시 `CanvasPool.clear()` + `requestMemoryRelief()`)를 `SmartProcessor.process()`만 호출하고 `AutoHighResProcessor.smartResize()`는 호출하지 않는다. `HighResolutionManager.checkAndManageMemory()`에 같은 임계값(0.8)으로 `CanvasPool.clear()` 트리거를 승격한다 — `HighResolutionManager`를 직접 쓰는 기존 소비자(수동 고급 제어 경로)도 혜택을 받는다. 배치 경로는 `BatchResizer.processAll()`이 청크마다 이미 `checkAndOptimize()`를 호출하므로 영향 없음.

## 변경 상세

### `src/core/auto-high-res.ts`

**import(6-10행)** — `createOwnedCanvas`/`applySmoothing`은 `standardResize()`에서만 쓰였으므로 제거하고, adapter 접근을 추가한다.

```ts
// 변경 전
import { applySmoothing, createOwnedCanvas } from '../base/canvas-utils.internal';
import { HighResolutionDetector } from '../base/high-res-detector.internal';

// 변경 후
import { getResizeStrategyAdapter } from '../base/resize-strategy.internal';
import { HighResolutionDetector, ProcessingStrategy } from '../base/high-res-detector.internal';
```

**`smartResize()` options(82-94행)** — `forceStrategy` 필드 신설.

```ts
options: {
  priority?: 'speed' | 'balanced' | 'quality';
  /** 특정 처리 전략을 강제한다. 대부분 상황에서 priority만으로 충분하며, 이 필드는
   * memory-efficient 배치처럼 명시적 강제가 필요한 고급 호출자를 위한 것이다. */
  forceStrategy?: ProcessingStrategy;
  onProgress?: (progress: number, message: string) => void;
  onMemoryWarning?: (message: string) => void;
  thresholds?: Partial<AutoProcessingThresholds>;
} = {}
```

**`smartResize()` 본문(96행, 124-134행)** — 구조분해에 `forceStrategy` 추가, `highResOptions.forceStrategy`를 `strategy.processingStrategy`(삭제됨) 대신 호출자 값으로 채운다.

```ts
// 변경 전
const { priority = 'balanced', onProgress, onMemoryWarning, thresholds: customThresholds } = options;
...
const highResOptions: HighResolutionOptions = {
  quality: strategy.quality,
  forceStrategy: strategy.processingStrategy,
  ...
};

// 변경 후
const { priority = 'balanced', onProgress, onMemoryWarning, thresholds: customThresholds, forceStrategy } = options;
...
const highResOptions: HighResolutionOptions = {
  quality: strategy.quality,
  forceStrategy,
  ...
};
```

**`determineOptimalStrategy()`(292-331행)** — 세 갈래 모두 `processingStrategy` 필드를 제거.

```ts
// 변경 전(speed 분기 예시)
case 'speed':
  return {
    name: 'High-speed Processing',
    quality: 'fast' as const,
    processingStrategy: isHighMem ? analysis.strategy : undefined,
    memoryOptimized: isHighMem,
    tileProcessing: isHighMem,
    maxMemory: thresholds.autoTileThreshold,
  };

// 변경 후
case 'speed':
  return {
    name: 'High-speed Processing',
    quality: 'fast' as const,
    memoryOptimized: isHighMem,
    tileProcessing: isHighMem,
    maxMemory: thresholds.autoTileThreshold,
  };
```

`quality`/`balanced` 분기도 동일하게 `processingStrategy: analysis.strategy` 줄만 삭제한다.

**`standardResize()`(336-359행)** — 그리기 로직을 adapter 위임으로 교체.

```ts
// 변경 전
private static async standardResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: 'fast' | 'balanced' | 'high'
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const { canvas, ctx } = createOwnedCanvas(targetWidth, targetHeight);
  applySmoothing(ctx, quality);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  const processingTime = (Date.now() - startTime) / 1000;
  return {
    canvas,
    analysis: HighResolutionDetector.analyzeImage(img),
    strategy: 'direct' as any,
    processingTime,
    memoryPeakUsageMB: 0,
    quality,
  };
}

// 변경 후
private static async standardResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: 'fast' | 'balanced' | 'high'
): Promise<ProcessingResult> {
  const startTime = Date.now();
  const analysis = HighResolutionDetector.analyzeImage(img);
  const canvas = await getResizeStrategyAdapter(ProcessingStrategy.DIRECT)!.execute({
    img,
    targetWidth,
    targetHeight,
    quality,
    analysis,
  });
  const processingTime = (Date.now() - startTime) / 1000;
  return { canvas, analysis, strategy: ProcessingStrategy.DIRECT, processingTime, memoryPeakUsageMB: 0, quality };
}
```

### `src/core/smart-processor.internal.ts` — 파일 삭제

`resizeBatch`/`processBatch`(유일하게 다른 파일에서 쓰이던 메서드)는 아래 `performance-utils.ts`로 이관한다. 나머지(`process`/`simpleResize`/`convertToInternalOptions`/`mapStrategyToQuality`/`selectInternalStrategy`/`getAutoMemoryLimit`/`wrapProgressCallback`)는 대응 없이 삭제된다 — 호출자는 `AutoHighResProcessor.smartResize()`로 대체된다.

### `src/core/performance-utils.ts`

**import(7-10행)** — `SmartProcessor` 제거, `AutoHighResProcessor` 추가.

```ts
import { readMemoryBudget } from '../utils/browser-capabilities/index';
import { AutoHighResProcessor } from './auto-high-res';
import { BatchResizer, type BatchResizeJob } from './batch-resizer';
import { getPerformanceConfig, type ResizeProfile } from './performance-config';
```

**`resizeBatch`/`processBatch` 신설**(구 `SmartProcessor.resizeBatch`/`.processBatch` 이관, 모듈 함수로 전환 — export 하지 않음, 이 파일 안에서만 쓴다):

```ts
async function resizeBatch(
  images: HTMLImageElement[],
  width: number,
  height: number,
  options: { priority?: 'speed' | 'balanced' | 'quality'; forceStrategy?: ProcessingStrategy; performance?: ResizeProfile } = {}
): Promise<HTMLCanvasElement[]> {
  const jobs: BatchResizeJob<HTMLCanvasElement>[] = images.map((img, index) => ({
    id: `resize-${index}`,
    operation: async () => (await AutoHighResProcessor.smartResize(img, width, height, options)).canvas,
  }));
  return processBatch(jobs, options.performance || 'balanced');
}

async function processBatch<T>(jobs: BatchResizeJob<T>[], performance: ResizeProfile = 'balanced'): Promise<T[]> {
  return new BatchResizer(performance).processAll(jobs);
}
```

**`ResizePerformance.fastBatch`/`.qualityBatch`(71-86행)** — `resizeBatch` 호출로 교체, `strategy`→`priority`.

```ts
// 변경 전
static async fastBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
  return SmartProcessor.resizeBatch(images, width, height, { performance: 'fast', strategy: 'fast' });
}

// 변경 후
static async fastBatch(images: HTMLImageElement[], width: number, height: number): Promise<HTMLCanvasElement[]> {
  return resizeBatch(images, width, height, { performance: 'fast', priority: 'speed' });
}
```

`qualityBatch`도 동일하게 `{ performance: 'quality', priority: 'quality' }`.

**`ResizePerformance.memoryEfficientBatch()`(91-112행)** — `SmartProcessor.process` 호출을 `AutoHighResProcessor.smartResize` + 명시적 `forceStrategy:'tiled'`로 교체. `BatchResizer` 구성(concurrency 1, useCanvasPool false, memoryLimitMB 64, timeout 120)은 그대로 — 이 필드들 자체가 배선되는지는 카드 7(`ResizePerformanceOptions` 유령 필드)의 범위다.

```ts
// 변경 전(operation만)
operation: () => SmartProcessor.process(img, width, height, { strategy: 'memory-efficient' }),

// 변경 후
operation: async () =>
  (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'speed', forceStrategy: 'tiled' })).canvas,
```

**`fastResize`/`qualityResize`/`autoResize`(182-212행)** — `SmartProcessor.process` 호출을 `AutoHighResProcessor.smartResize`로 교체. `performance` 필드는 애초 `SmartProcessor.process()`가 읽지 않던 죽은 값이었으므로(`resizeBatch`/배치 경로에서만 의미가 있었다) 단일 이미지 함수에서는 제거한다. `autoResize()`의 `ResizePerformance.getRecommendation()` 호출도 그 결과(`recommendation.profile`)가 죽은 `performance` 필드에만 쓰였으므로 함께 제거한다.

```ts
// 변경 전
export async function fastResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return SmartProcessor.process(img, width, height, { performance: 'fast', strategy: 'fast' });
}
export async function autoResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const recommendation = ResizePerformance.getRecommendation(1, img.width * img.height);
  return SmartProcessor.process(img, width, height, { performance: recommendation.profile, strategy: 'auto' });
}

// 변경 후
export async function fastResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'speed' })).canvas;
}
export async function autoResize(img: HTMLImageElement, width: number, height: number): Promise<HTMLCanvasElement> {
  return (await AutoHighResProcessor.smartResize(img, width, height, { priority: 'balanced' })).canvas;
}
```

`qualityResize`도 동일 패턴으로 `{ priority: 'quality' }`.

### `src/base/high-res-manager.ts`

**import(1행)** — `CanvasPool` 추가.

```ts
// 변경 전
import { readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';

// 변경 후
import { CanvasPool } from './canvas-pool.internal';
import { readMemoryBudget, requestMemoryRelief } from '../utils/browser-capabilities/index';
```

**`checkAndManageMemory()`(258-273행)** — 압박 시 `CanvasPool.clear()` 추가.

```ts
// 변경 전
if (HighResolutionManager.isMemoryLow()) {
  requestMemoryRelief();
}

// 변경 후
if (HighResolutionManager.isMemoryLow()) {
  CanvasPool.getInstance().clear();
  requestMemoryRelief();
}
```

## 테스트 계약

**삭제** — `tests/unit/core/smart-processor.test.ts` 전체. 이 파일이 검증하던 `strategy`→`forceStrategy` 매핑(auto/fast/quality/memory-efficient)은 클래스와 함께 사라진다. `memory-efficient`의 `forceStrategy:'tiled'` 계약만 아래 신규 테스트로 이관한다.

**신규 — `tests/unit/base/high-res-manager-strategy-selection-jsdom.test.ts`(또는 기존 `high-res-manager-smart-resize-strategy-jsdom.test.ts`에 describe 추가):**

`HighResolutionManager.smartResize()`를 `forceStrategy` 없이 직접 호출해 `selectOptimalStrategy()`의 quality 기반 분기를 처음으로 검증한다(현재 이 분기들은 `validateProcessingCapability()` 경유로만 테스트된다):

- `quality:'fast'` + `estimatedMemoryMB` ≤ 64 → `selectFastStrategy` → `direct`.
- `quality:'fast'` + `estimatedMemoryMB` > 64 → `tiled`.
- `quality:'high'` + scaleRatio < 0.3 + `estimatedMemoryMB` ≤ 256 → `selectHighQualityStrategy` → `stepped`.
- `quality:'high'` + `estimatedMemoryMB` > 256 → `tiled`.
- `quality:'balanced'`(기본) → `analysis.strategy` 그대로 통과.
- `isMemoryLow()`(mock) = true → quality 무관 `selectMemoryEfficientStrategy` → `estimatedMemoryMB` 32 경계로 `direct`/`tiled`.

**갱신 — `tests/unit/core/performance-utils.test.ts`:** `vi.spyOn(SmartProcessor, 'resizeBatch'/'process')`를 `vi.spyOn(AutoHighResProcessor, 'smartResize')`로 교체하고, 기대 인자를 `{ strategy, performance }`에서 `{ priority, forceStrategy? }`로 갱신한다(매핑 표는 "결정" 1번 참고).

**갱신 — `tests/unit/core/auto-high-res.smart-resize.test.ts`:** 기존 단언은 모두 `HighResolutionManager.smartResize`의 `quality` 값과 호출 여부만 검증하므로(`forceStrategy` 값을 단언하는 테스트 없음) 3번 재설계로 인한 파손은 없다. `standardResize()`가 adapter로 교체되며 표준 경로 반환 canvas 크기 단언(예: 36-42행)은 동작 동일하게 유지되는지만 확인한다.

**갱신 — `tests/unit/core/advanced-processor-*.test.ts`:** `AutoHighResProcessor.smartResize`를 스텁하는 헬퍼(`advanced-processor-process.helpers.ts`)는 시그니처 변경 없이 그대로 유효하다(옵션 필드 추가는 additive).

## 문서 계약

- `docs/architecture.md:76` — "`AutoHighResProcessor`/`SmartProcessor`가 이 게이트를 공유해" → `SmartProcessor` 언급 제거, `AutoHighResProcessor`가 유일한 진입점임을 명시.
- `docs/architecture.md:59` — `readMemoryBudget` 소비자 목록에서 `smart-processor` 제거, `performance-utils`는 유지(이미 목록에 있음).
- `docs/architecture.md`의 `high-res-manager.ts` 행(77행) — `checkAndManageMemory`가 이제 `CanvasPool.clear()`도 트리거함을 한 줄 추가.
- `docs/maintenance-risks.md` — "고해상도 전략 선택 임계값 불일치(내부 경계)" 행을 완료로 닫는다. 내부 direct/stepped/tiled 선택 경계 자체(`high-res-detector`의 16MB 등)는 여전히 별개 숫자로 남지만, 그 경계가 이제 `smartResize()` 실제 처리 경로에서 도달 가능해졌다는 상태 변화만 기록한다(경계 자체의 재조정은 비범위).
- `CHANGELOG.md` `[Unreleased]` → `### 변경`(Changed, Breaking 아님 — 타입은 additive만) 신규 항목: 어휘 통합(`priority`로 수렴), `AutoHighResProcessor.smartResize()`의 `quality:'high'`/`'fast'`/메모리 압박 시 실제 전략 선택 로직이 살아남(행동 변화), `maxMemoryUsageMB`가 동적 20%에서 정적 임계값으로 통일됨(행동 변화), `HighResolutionManager` 직접 사용자도 메모리 압박 시 `CanvasPool.clear()` 혜택을 받음(행동 변화).

## 비범위

- `AdvancedImageProcessor`(`advanced-processor.ts`) — 이미 `AutoHighResProcessor` 하나로 수렴돼 있다. 손대지 않는다.
- `BatchResizer`/`ResizePerformanceOptions`의 유령 필드(`useCanvasPool`/`memoryLimitMB`가 실제로 배선되는지) — 아키텍처 리뷰 카드 7의 범위.
- `HighResolutionDetector.analyzeImage()`가 내부적으로 쓰는 16MB 등 자체 임계값과 `high-res-manager.ts`의 32/64/256MB 경계 사이의 숫자 재조정 — 이 카드는 그 경계들을 "도달 가능하게" 만들 뿐, 경계 값 자체를 통일하지 않는다(`docs/maintenance-risks.md`가 별도로 계속 추적).
- `SmartResizeOptions`(`src/types/index.ts:177`) 타입 자체 — `smart-processor.internal.ts` 삭제 후에도 공개 export(`src/index.ts:145`)로 남지만 라이브러리 내부에서 이 타입을 파라미터로 받는 곳이 하나도 없어진다(사용처가 전부 삭제되는 `SmartProcessor`뿐이었다). 유령 공개 타입이 되지만 제거는 이 카드 범위 밖 — `docs/maintenance-risks.md`에 후속 후보로 한 줄만 남긴다.

## 재검토 조건

- `maxMemoryUsageMB` 동적 20% 정책이 실제로 무동작이었는지("결정" 5번의 가설)가 나중에 반증되면(예: `availableMB`가 호출 중간에 실제로 크게 변하는 시나리오가 발견되면) 정적 임계값 통일을 재검토한다.
- `SmartResizeOptions`가 유령 공개 타입으로 남는 것이 실사용자에게 혼란을 준다는 보고가 들어오면 별도 카드로 제거를 다룬다.
- `docs/maintenance-risks.md`가 여전히 열어두는 내부 경계 숫자(16/32/64/256MB) 불일치가 재현 가능한 버그로 보고되면 별도 카드로 통합한다.
