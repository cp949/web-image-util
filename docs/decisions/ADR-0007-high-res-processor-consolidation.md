# ADR-0007: 고해상도 처리 3계층을 HighResolutionProcessor 하나로 통합

## 상태

Accepted

## 배경

- 고해상도 이미지 리사이즈 경로가 분석(`analyze`) · 전략 선택·실행(`manage`) · 라우팅과 표준 경로(`route`) 세 계층으로 나뉘어 있었고, 각 계층이 "이미지 하나에 어떤 전략을 쓸지 정하고 실행한다"는 같은 개념을 서로 다른 어휘로 반복 정의했다.
- 어휘가 계층마다 달랐다: 한쪽은 필드명 `quality`(값 `'fast'|'balanced'|'high'`), 다른 쪽은 `priority`(값 `'speed'|'balanced'|'quality'`). 값 검증 메서드도 두 곳에 이름만 비슷하게(`validateProcessing`/`validateProcessingCapability`) 존재했고, 반환 필드 일부(`estimatedMemory` vs `analysis.estimatedMemoryMB`, 문자열 `suggestedStrategy` vs enum `recommendedStrategy`)가 중복·불일치했다.
- 계층 간 정합성 버그(한 계층이 고른 전략을 다른 계층이 다르게 보고하는 유형)가 반복적으로 발견·수정된 이력이 있었다. 아키텍처 리뷰에서 이 중복을 통합 대상으로 선정했고, 설계 인터뷰(그릴링)로 공개 인터페이스와 어휘를 확정했다.

## 결정

1. 세 계층을 `HighResolutionProcessor` 클래스 하나로 접는다. 공개 메서드는 `resize()` / `validate()` / `batchResize()` 3개뿐이다.
2. 어휘를 `priority: 'fast' | 'balanced' | 'quality'` 하나로 통일한다. 옛 값(`'speed'`, `quality` 계층의 `'high'`)과 필드명 `quality`(출력 압축률을 뜻하는 `OutputOptions.quality`와 이름이 충돌하므로 폐기)는 전부 제거한다.
3. `resize()`의 결과 타입은 두 옛 반환 타입의 합집합을 필드 중복 없이 채택한다 — `canvas`/`analysis`/`priority`(실제 적용값)/`strategy`/`processingTime`/`memoryPeakUsageMB`/`memoryOptimized`/`estimatedTimeSaved`/`userMessage?`. `forceStrategy`(priority 무시하고 특정 전략 강제하는 escape hatch)는 그대로 유지한다.
4. `validate()`는 두 옛 검증 함수의 합집합 필드를 반환하고 예외를 던지지 않는다 — `canProcess`/`warnings`/`recommendations`/`estimatedTime`/`recommendedStrategy`(타입 있는 enum, 문자열 아님)/`analysis`. 메모리 초과 등 판단 불가 상황은 `canProcess: false` + `warnings`로만 알린다.
5. `batchResize()`는 일괄 처리 API를 하나로 합친다. 항목은 `HTMLImageElement` 또는 `{ img, width?, height?, name? }` 유니언이고, 공용 목표 크기를 개별 항목이 오버라이드할 수 있다. 진행 콜백은 `onProgress(completed, total, currentItemName?)` + `onItemComplete(index, result)`이고, 항목 하나가 실패하면 전체가 reject된다(부분 성공 허용 안 함).
6. 순수 분석 로직(이미지 크기 분석, 고해상도 경로 진입 판단)과 전략별 실행 어댑터·정책은 통합 대상에서 제외하고 내부 seam으로 그대로 재사용한다 — 이 둘은 이미 단일 책임으로 분리돼 있었고 중복의 원인이 아니었다.
7. 즉시 breaking change로 간다. `@deprecated` 경유 전환 기간을 두지 않는다.
8. `forceStrategy`로 런타임에만 알 수 있는 미지원 전략 문자열이 들어오면(타입 우회 시) `FEATURE_NOT_SUPPORTED`로 던지고, 고해상도 경로 실행 자체가 실패하면 표준 경로로 폴백한다 — 이 둘은 서로 다른 상황이므로 폴백이 전자를 삼키지 않는다. 그 외 처리 실패는 `RESIZE_FAILED`.

## 근거

- 세 계층이 반복 정의하던 개념이 정말로 하나였다 — 어휘를 통일하고 메서드를 합치면 계층 간 정합성 버그가 구조적으로 재발 불가능해진다(같은 값을 두 곳이 각자 계산해서 보고할 여지 자체가 없어짐).
- 필드명 `priority`를 선택한 이유: 값 집합을 기존 `ResizeProfile`(성능 프로파일, 통합 범위 밖)과 미리 맞춰 향후 그쪽을 통합할 때 값 재조정이 필요 없게 했다.
- `validate()`가 예외를 던지지 않는 이유: 사전 점검 API가 예외로 흐름을 끊으면 호출자가 try/catch 없이 결과만 보고 판단하기 어렵다 — 기존 두 함수 모두 이미 이 관례를 따르고 있었다.
- `batchResize()`가 부분 성공을 허용하지 않는 이유: 기존 일괄 처리 동작을 그대로 유지하는 선택이다. 부분 성공은 호출자가 어떤 항목이 실패했는지 별도로 추적해야 하는 복잡도를 API에 강제하므로, 필요해지면 별도 옵션으로 다룰 문제이지 이번 통합의 범위가 아니다.
- 분석 로직과 전략 실행 어댑터를 통합 대상에서 뺀 이유: 이미 각각 단일 책임의 deep 모듈이었고, 정합성 버그의 원인은 이 둘이 아니라 그 위에서 같은 결정을 반복하던 상위 계층이었다.
- 즉시 breaking으로 간 이유: 어휘가 통일되지 않은 상태로 전환 기간을 두면 두 어휘가 한동안 공존해 이번에 없애려는 종류의 혼란이 재발한다. 이 라이브러리의 소비처(데모 앱 포함) 조사 결과 이 표면을 쓰는 곳이 없어 즉시 전환의 실제 비용도 낮았다.

## 영향

- `/advanced` 서브패스의 공개 표면이 바뀐다: 옛 3개 클래스와 그 편의 함수 export가 사라지고 `HighResolutionProcessor`와 그 공개 타입들로 대체된다. 이 표면을 직접 쓰던 외부 코드는 마이그레이션이 필요하다(CHANGELOG의 Breaking 항목 참고).
- 이 라이브러리의 다른 고해상도 처리 소비 지점(성능 유틸리티의 배치 리사이즈 편의 함수 등)은 내부 배선만 바뀌고 공개 시그니처는 그대로다 — 이 ADR의 범위가 아니다.
- 성능 프로파일 계열 어휘(`ResizeProfile`/`performance`)는 이번 통합 범위 밖으로 남는다. 값 집합만 미리 맞춰뒀을 뿐, 그쪽 통합 여부는 별도 결정 대상이다.
