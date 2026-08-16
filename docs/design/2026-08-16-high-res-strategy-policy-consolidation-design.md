# 고해상도 전략 선택 정책 통합 설계

## 배경

`docs/maintenance-risks.md`가 Medium으로 추적하던 항목의 남은 문제는 임계값 숫자 불일치가
아니라(2026-08-15 design doc이 이미 정리), balanced(`determineStrategy()`, 16MB 초과 TILED —
공격적)와 fast(`selectFastStrategy()`, 64MB 이하 DIRECT — 관대)의 정책 방향 자체가 다르다는
점이었다. 이 카드(아키텍처 리뷰 A1)는 그 방향 차이를 재설계하지 않는다 — 4개 티어 함수가
`high-res-detector.internal.ts`(balanced)와 `high-res-manager.ts`(fast/high/memory-pressure)
두 파일에 흩어져 있다는 locality 문제만 해소한다.

코드를 다시 대조하며 카드 문면에 없던 사실을 하나 확인했다: `determineStrategy()`(balanced)만
캔버스 크기 한계(`width/height > maxSafeDimension`)를 체크했고, `selectFastStrategy()`/
`selectMemoryEfficientStrategy()`/`selectHighQualityStrategy()`의 STEPPED 분기는 이 체크를
건너뛰었다. 극단적 종횡비(가로/세로 하나만 매우 크고 총 메모리는 작은) 이미지에서
`quality:'fast'`나 memory-pressure 경로가 캔버스 디코드 한계를 넘는 DIRECT를 고를 수 있는
latent 격차였다.

## 결정

**동작 변화 범위를 좁게 잡는다.** 임계값 자체(16/32/64/256MB, scaleRatio 0.3)는 바꾸지
않는다 — 표만 새 leaf 모듈 `src/base/strategy-policy.internal.ts` 한 곳으로 모은다.
유일하게 의도된 동작 변화는 캔버스 크기 한계 가드를 4개 티어 공통으로 승격한 것이다.

## 변경 상세

**`src/base/strategy-policy.internal.ts`(신규)**

`ProcessingStrategy` 타입/상수, 명명된 임계값 5개(`SMALL_MEMORY_THRESHOLD_MB`=16,
`MEDIUM_MEMORY_THRESHOLD_MB`=64, `LARGE_MEMORY_THRESHOLD_MB`=256,
`MEMORY_EFFICIENT_THRESHOLD_MB`=32 — 신규 명명, `HIGH_QUALITY_STEPPED_SCALE_RATIO`=0.3 — 신규
명명), 캔버스 가드 `exceedsMaxSafeDimension()`, 티어 함수 4개(`selectBalancedStrategy`/
`selectFastStrategy`/`selectMemoryEfficientStrategy`/`selectHighQualityStrategy`)를 소유한다.
전부 순수 함수 — DOM/이미지 객체에 의존하지 않고 숫자만 받는다. 4개 티어 함수는 전부 첫
줄에서 `exceedsMaxSafeDimension()`을 호출한다.

**`src/base/high-res-detector.internal.ts`**

`ProcessingStrategy` 선언을 leaf에서 import해 단일 `export { ProcessingStrategy };` 문 하나로 재노출하는 것으로 바꿨다. 병합된 type+value 바인딩을 `export type {}`와 `export {}` 두 문장으로 나눠 재노출하면 이 리포의 tsconfig(isolatedModules, TS 6.0.3)에서 `TS2300`(중복 식별자) + 다운스트림 소비자에서 `TS1362`(값으로 못 씀)가 발생한다 — 값+타입을 한 번에 실어나르는 일반 `export {}` 한 줄만 써야 두 쓰임(타입 어노테이션, `ProcessingStrategy.DIRECT` 같은 값 접근) 모두 정상 동작한다(Task 2에서 발견·수정, `high-res-detector.internal.ts:1-15`). `determineStrategy()` private 메서드를 삭제하고 `analyzeImage()`가
`selectBalancedStrategy(estimatedMemoryMB, width, height, getMaxSafeDimension())`를 직접
호출한다. production consumer가 없던 `MEDIUM_MEMORY_THRESHOLD_MB`/
`LARGE_MEMORY_THRESHOLD_MB` 정적 프로퍼티와 detector의 중복 고정 테스트는 후속 정리에서
삭제했다. `MEMORY_THRESHOLDS.SMALL`은 `getOptimalChunkSize()`를 위해 남기되,
`strategy-policy.internal.ts`의 `SMALL_MEMORY_THRESHOLD_MB`를 byte로 환산해 사용한다.

**`src/base/high-res-manager.ts`**

`ProcessingStrategy`와 `selectMemoryEfficientStrategy()`/`selectFastStrategy()`/
`selectHighQualityStrategy()`를 leaf에서 직접 import하고, `selectOptimalStrategy()`가 leaf 함수를
`analysis.estimatedMemoryMB`/
`.width`/`.height`/`.maxSafeDimension`으로 직접 호출한다. 분기 순서
(`forceStrategy` → memory-pressure → quality → balanced)는 무변경.

`resize-strategy.internal.ts`, `auto-high-res.ts`, `performance-utils.ts`도 전략 어휘를 leaf에서
직접 import한다. `high-res-detector.internal.ts`의 재노출은 `advanced-index.ts`의 기존 공개
타입 경로 유지에만 쓰인다.

## 테스트 계약

**신규** — `tests/unit/base/strategy-policy.test.ts`. leaf의 5개 export를 숫자만으로 직접
검증(DOM 불필요). 기존 경계값 테스트를 그대로 이식하고, 4개 티어 함수마다 "메모리는 작아도
캔버스 안전 치수를 초과하면 tiled" 케이스를 추가했다.

**신규** — `tests/unit/core/high-res-manager-smart-resize-strategy-jsdom.test.ts`에
`quality:'fast'`/`quality:'high'`/`isMemoryLow()=true` 각각에 대해 캔버스 안전 치수 초과 +
작은 메모리 조합이 `TILED`를 고르는지 검증하는 3건 추가.

**기존 회귀 게이트** — 카드 구현 중에는 `tests/unit/base/high-res-detector.test.ts`,
`tests/unit/core/high-res-manager-validate-jsdom.test.ts`,
`tests/unit/core/auto-high-res.smart-resize.test.ts`를 수정하지 않고 통과시켰다. 카드 완료 후
detector의 vestigial static 고정 테스트만 제거했다. 나머지 테스트 assertion과 관찰 가능한
동작은 변경하지 않았고, 테스트 주석만 현재 심볼과 스타일 규칙에 맞췄다.

## 문서 계약

- `docs/maintenance-risks.md:11` — 4개 티어가 이제 한 파일에 있다는 사실과 캔버스 가드 확장을
  반영. "남는 문제"(정책 방향 불일치)와 재검토 조건은 그대로 유지 — 이번 카드가 해소한 게
  아니다.
- `CHANGELOG.md` — `### 수정`에 캔버스 가드 확장을 Fixed 항목으로 기록한다. 순수 구조
  정리(leaf 추출) 자체는 관찰 가능한 변화가 없으므로 항목을 만들지 않는다 — 가드 확장만
  공개 API(`smartResize`/`autoSmartResize`/`fastResize`)의 관찰 가능한 반환값을 바꾼다.

## 비범위

- balanced(16MB 초과 TILED)와 fast(64MB 이하 DIRECT)의 정책 방향 차이 자체를 재설계하는 것.
  `docs/maintenance-risks.md`의 재검토 조건("정책 방향 불일치가 실제 버그로 보고되면")이
  아직 충족되지 않았다.
- tiled light/heavy 실행 프리셋 경계 64MB. `resize-strategy.internal.ts`의
  `TILED_LIGHT_THRESHOLD_MB`와 `high-res-detector.internal.ts` `calculateComplexity()`/
  `estimateProcessingTime()`의 64MB 비교가 같은 실행 경계를 나타낸다. "어떤 전략을
  고를지" 판정이 아니라 "고른 tiled 전략을 어떻게 실행할지"에 속하므로 이 표의
  대상이 아니다. 전략 선택 임계값과 병합하지 않는다.

## 재검토 조건

- balanced/fast/pressure의 정책 방향 불일치가 실제 버그로 보고되면 별도 카드로 정책 자체를
  재설계한다(기존 조건 유지).
