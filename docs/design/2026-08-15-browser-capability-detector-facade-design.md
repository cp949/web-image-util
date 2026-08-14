# BrowserCapabilityDetector 위임 파사드 제거 설계

## 배경

`src/utils/browser-capabilities/detector.internal.ts`는 감지 로직을 모듈 함수(`detectBrowserCapabilities`·`analyzePerformanceFeatures`·`detectSyncCapabilities`·`getCachedBrowserCapabilities`·`getOptimalProcessingMode`)로 구현하고, 캐시는 모듈 레벨 `capabilityCache` 하나가 보관한다. 같은 파일의 `BrowserCapabilityDetector` 클래스(116-170행)는 이 모듈 함수들로 그대로 위임한다 — 로직 0줄, 5개 메서드 전부 한 줄 위임이다.

```ts
async detectCapabilities(options: DetectionOptions = {}): Promise<BrowserCapabilities> {
  return detectBrowserCapabilities(options);
}
```

`src/filters/plugin-system.ts`는 바로 옆 서브시스템에서 이미 반대 원칙을 명시한다: "같은 기능을 매니저 객체와 모듈 함수로 이중 노출하지 않기 위한 의도적 제약이다." 이 원칙은 `[Unreleased]` CHANGELOG에서 `filterManager` export를 제거하고 모듈 함수로 단일화하는 형태로 이미 한 차례 실행됐다. `BrowserCapabilityDetector`만 이 원칙을 어긴다.

adapter count: `BrowserCapabilityDetector`를 소비하는 곳은 자기 자신을 테스트하는 4개 파일뿐이다(`detector.test.ts`, `features-facade.test.ts`, `cache-facade.test.ts`, `ssr-safety.test.ts`, 합계 662줄). `src/index.ts`가 루트로 재노출하지만 grep으로 확인한 실제 소비자는 없다(빌드 산출물 `dist/index.d.ts` 제외). 유일한 어댑터가 자기 자신 하나뿐인 가설적 seam이다.

**클래스 전용 표면 중 모듈 함수에 대응이 없는 것 하나:** `clearCache()`/`isServerSide` 게터. 4개 테스트 파일이 매 테스트마다 캐시를 비우는 용도로만 `BrowserCapabilityDetector.getInstance().clearCache()`를 쓴다. README·CHANGELOG·apps 어디에도 프로덕션 소비자 문서화가 없다 — 테스트 격리 전용이었다. `isServerSide`는 `capabilityCache.isServerSide`를 그대로 노출한 게터로, 검증 대상 동작(SSR 환경에서 감지 함수가 안전한 기본값을 반환하는가)은 `ssr-safety.test.ts`의 다른 5개 테스트가 이미 `detectSyncCapabilities()`/`detectBrowserCapabilities()`를 통해 검증한다.

이 프로젝트는 이미 테스트 전용 모듈 함수를 공개 배럴 밖에 두는 관례를 쓴다 — `src/filters/plugin-system.ts:240`의 `resetFilterRegistryForTesting()`:

```ts
/**
 * 레지스트리를 비운다.
 *
 * @internal 테스트 격리 전용. 공개 배럴에 등재하지 않는다.
 */
export function resetFilterRegistryForTesting(): void {
  registeredPlugins.clear();
}
```

테스트는 공개 배럴(`src/filters/plugins.ts`)이 아니라 내부 모듈(`src/filters/plugin-system`)에서 직접 import한다. `clearCache()`도 같은 패턴으로 옮긴다.

## 결정

`BrowserCapabilityDetector` 클래스를 삭제한다. 스모크 테스트로 축소하는 대안(카드가 제시한 두 번째 선택지)은 쓰지 않는다 — 이 프로젝트는 이미 같은 `[Unreleased]` 사이클에서 `filterManager` 제거로 동일한 판단을 내렸고, 공개 export라는 이유로 유지할 근거가 그 판단과 모순된다.

- `detector.internal.ts`에서 클래스(116-170행)를 삭제하고, `resetFilterRegistryForTesting()`과 같은 패턴의 `clearCapabilityCacheForTesting(): void`를 추가한다. `@internal 테스트 격리 전용. 공개 배럴에 등재하지 않는다.` 태그를 달고 어떤 배럴에도 재노출하지 않는다.
- `isServerSide` 게터는 대체 없이 제거한다. 대응하는 공개 소비자가 없다.
- `src/utils/browser-capabilities/index.ts`와 `src/index.ts`에서 `BrowserCapabilityDetector` re-export를 제거한다.
- `tests/contract/expected-public-exports.ts`의 `ROOT_VALUE_EXPORTS`에서 `'BrowserCapabilityDetector'`를 제거한다(`clearCapabilityCacheForTesting`은 배럴에 없으므로 이 목록에 추가하지 않는다).
- 4개 테스트 파일에서 `BrowserCapabilityDetector.getInstance().X()` 호출을 대응하는 모듈 함수 호출로 바꾼다. `getInstance()` 자체를 검증하던 테스트, `isServerSide` 게터를 검증하던 테스트, 모듈 함수 테스트와 완전히 중복되던 클래스 테스트는 삭제한다. 클래스에만 있고 모듈 함수 쪽에 없던 어서션(속성 존재·타입 검증)은 모듈 함수 테스트로 옮겨 커버리지를 보존한다.

**deletion test:** 클래스를 지운 뒤 `pnpm typecheck`를 돌리면 `src/utils/browser-capabilities/*.internal.ts`·`src/index.ts` 등 프로덕션 코드 쪽에서는 어떤 에러도 나지 않아야 한다. 에러는 이 클래스를 참조하는 4개 테스트 파일에서만 나야 한다 — 그것이 "유일한 어댑터가 자기 자신"이라는 가설의 실측 증거다.

**행동 변화(의도됨):**

- 런타임 감지 로직·캐시 동작은 전혀 바뀌지 않는다. 모듈 함수가 이미 유일한 구현이었다.
- 공개 API에서 `BrowserCapabilityDetector`가 사라진다(Breaking). 마이그레이션은 클래스 메서드 호출을 같은 이름의 모듈 함수 호출로 바꾸는 것이다(`detector.detectCapabilities()` → `detectBrowserCapabilities()` 등, 시그니처 동일).
- `clearCache()`에 대응하는 공개 API는 없어진다. `useCache: false` 옵션은 `browser-capabilities` 종합 캐시만 우회한다. 포맷 감지 함수가 먼저 읽는 `webp`·`avif` 캐시는 우회하지 않으며, 이 캐시들을 비우는 공개 수단도 없어진다.

## 변경 상세

**`src/utils/browser-capabilities/detector.internal.ts`**

- 1-8행 모듈 doc comment를 파사드 프레이밍(위임 계층 설명)에서 모듈 함수 단독 소유 설명으로 교체한다.
- 110-170행(클래스 doc comment + `BrowserCapabilityDetector` 클래스 전체)을 삭제한다.
- 같은 자리에 `clearCapabilityCacheForTesting()`을 추가한다:
  ```ts
  /**
   * 캐시를 비운다.
   *
   * @internal 테스트 격리 전용. 공개 배럴에 등재하지 않는다.
   */
  export function clearCapabilityCacheForTesting(): void {
    capabilityCache.clear();
  }
  ```

**`src/utils/browser-capabilities/index.ts`** — export 목록에서 `BrowserCapabilityDetector,` 줄을 삭제한다.

**`src/index.ts`** — 브라우저 기능 감지 재노출 블록에서 `BrowserCapabilityDetector,` 줄을 삭제한다.

**`tests/contract/expected-public-exports.ts`** — `ROOT_VALUE_EXPORTS`에서 `'BrowserCapabilityDetector',` 줄을 삭제한다.

**`tests/unit/utils/browser-capabilities/detector.test.ts`** — 전체를 다시 쓴다. `describe('BrowserCapabilityDetector', ...)` 블록을 없애고, 그 안의 어서션을 `detectSyncCapabilities (편의 함수)`·`detectBrowserCapabilities (편의 함수)` 블록으로 흡수한다. `clearCache()` 호출은 `clearCapabilityCacheForTesting()`으로 바꾼다.

**`tests/unit/utils/browser-capabilities/features-facade.test.ts`** — import에서 `BrowserCapabilityDetector`를 빼고 `clearCapabilityCacheForTesting`을 `detector.internal`에서 직접 import한다. `beforeEach`/`afterEach` 2곳의 호출을 바꾼다.

**`tests/unit/utils/browser-capabilities/cache-facade.test.ts`** — 위와 동일한 import 교체. `beforeEach`/`afterEach`/캐시-클리어 어서션 3곳의 호출을 바꾼다.

**`tests/unit/utils/browser-capabilities/ssr-safety.test.ts`** — import에서 `BrowserCapabilityDetector`를 뺀다. `BrowserCapabilityDetector.getInstance()는 항상 인스턴스를 반환한다` 테스트와 `SSR에서 로드된 detector도 환경 복원 후 isServerSide를 다시 계산한다` 테스트를 삭제한다(대체 없음 — 검증 대상 동작은 나머지 5개 테스트가 이미 모듈 함수를 통해 검증한다).

## 테스트 계약

**삭제:**

- `BrowserCapabilityDetector.getInstance()는 항상 인스턴스를 반환한다`(ssr-safety.test.ts) — 클래스 존재 자체를 검증하던 테스트, 클래스가 없어지므로 무의미.
- `SSR에서 로드된 detector도 환경 복원 후 isServerSide를 다시 계산한다`(ssr-safety.test.ts) — `isServerSide` 게터 전용, 대체 없이 제거.
- `detector.test.ts`의 클래스 전용 describe 블록(`detectSyncFeatures`·`detectCapabilities (async)`)은 삭제하되, 어서션은 편의 함수 테스트로 이관해 순 커버리지 손실이 없다.

**이관(클래스 → 모듈 함수, 동일 어서션):**

- `detector.detectSyncFeatures()` 어서션(속성 존재 6개, 타입 3개) → `detectSyncCapabilities (편의 함수)`의 첫 테스트로 흡수.
- `detector.detectCapabilities()` 어서션(속성 존재 8개, 타입 2개) → `detectBrowserCapabilities (편의 함수)`의 테스트로 흡수(기존 얕은 버전을 대체).
- 캐시 재사용 3개 테스트(`useCache: true` 참조 동일성, `useCache: false` 재감지, `clearCache` 후 재감지) → 그대로 유지하되 `detector.detectCapabilities()` → `detectBrowserCapabilities()`, `detector.clearCache()` → `clearCapabilityCacheForTesting()`로 호출부만 교체.

**그대로 유지(호출부만 교체):**

- `features-facade.test.ts`의 9개 테스트, `cache-facade.test.ts`의 32개 테스트 — 어서션 불변, `clearCache()` 호출부만 `clearCapabilityCacheForTesting()`로 교체.

**최종 테스트 개수:** `detector.test.ts` 8→6(중복 어서션 정리), `features-facade.test.ts` 9(불변), `cache-facade.test.ts` 32(불변), `ssr-safety.test.ts` 7→5(클래스 전용 2개 삭제). 합계 56→52. 감소한 4개는 전부 클래스 존재/게터 자체를 검증하던 중복 또는 무의미 테스트다.

## 문서 계약

- `CHANGELOG.md`: `[Unreleased]` → `### 변경`에 Breaking 항목을 추가한다(`filterManager` 제거 항목과 같은 형식 — 메서드별 마이그레이션 매핑 포함).
- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다.
- `docs/architecture.md`: `detector.internal.ts`를 개별 행으로 다루지 않으므로 갱신하지 않는다.
- `docs/maintenance-risks.md`: 완료된 신규 결함은 추적하지 않는 정책에 따라 갱신하지 않는다(애초에 이 파사드는 등재된 적이 없다).

## 비범위

- `detectFormatSupport`·`detectSyncCapabilities` 등 모듈 함수 자체의 동작 변경.
- `capabilityCache`(`cache.internal.ts`)의 구현 변경 — `clear()` 메서드는 그대로 두고 새 모듈 함수가 위임한다.
- 카드 6(`getImageDimensions` 그림자 구현)·카드 7(`ResizePerformanceOptions` 유령 필드) 등 같은 리뷰 문서의 다른 카드.

## 재검토 조건

- 실제 소비자가 런타임에 캐시를 강제로 비워야 하는 시나리오(예: 브라우저 기능이 세션 도중 바뀌는 임베디드 환경)가 보고되면, `clearCapabilityCacheForTesting`과는 별도로 프로덕션용 공개 API를 신설하는 카드를 연다.

## 코드 리뷰 보정 (2026-08-15)

구현 완료 후 `/code-review`에서 이 설계의 실행에 3가지 결함을 확인했다. 반영 범위:

- **`clearCapabilityCacheForTesting`의 위치.** 이 문서는 `resetFilterRegistryForTesting()`(`plugin-system.ts`가 private `registeredPlugins`를 직접 소유)을 전례로 들어 `detector.internal.ts`에 배치했다. 하지만 `capabilityCache`는 `cache.internal.ts`가 정의·export하는 값이라 전례의 전제(비공개 상태를 노출하려고 같은 파일에 reset 함수를 둠)가 성립하지 않는다 — 실제 소유 파일이 아닌 곳에 두면 그 전례를 따라 위치를 찾는 사람이 잘못된 파일로 간다. `cache.internal.ts`로 옮겼다.
- **모듈 doc comment의 "단독 소유" 오기술.** `detector.internal.ts` 1-6행이 "캐시를 이 모듈이 단독 소유한다"고 썼는데, `format-detection.internal.ts`도 `capabilityCache`에 `webp`/`avif`/canvas 포맷 키로 직접 읽고 쓴다. 소유 관계를 정확히 기술하도록 고쳤다.
- **`isServerSide` 동적 재평가 커버리지 손실.** "테스트 계약" 절은 삭제한 `isServerSide` 테스트의 검증 대상을 "나머지 5개가 이미 검증한다"고 적었지만, 부정확했다 — 남은 테스트들은 SSR 시뮬레이션 후 매번 `restore()`만 하고 같은 테스트 안에서 재호출까지는 하지 않아, 이 게터가 메모이즈되도록 바뀌어도 잡아내지 못했다. `ssr-safety.test.ts`에 SSR 중 캐시 저장을 건너뛰고 환경 복원 후에는 다시 저장하는지를 한 테스트 안에서 확인하는 회귀를 추가했다(게터 자체가 아니라 실제 소비자 경로인 캐시 게이팅을 통해 검증 — 삭제 전 테스트보다 더 실전에 가깝다).

`clearCache()`에 대응하는 공개 API가 없다는 결정, `isServerSide` 게터를 대체 없이 제거한다는 결정 자체는 바뀌지 않았다. 배치와 문서 정확성만 바로잡았다.
