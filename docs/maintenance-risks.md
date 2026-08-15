# 유지보수 리스크

이 문서는 현재 코드에서 장기적으로 추적할 가치가 큰 항목만 남긴 목록입니다. 작업 전에 실제 코드와 다시 대조하세요.

## 우선 확인할 항목

| 우선순위 | 항목 | 이유 | 다음 행동 |
| --- | --- | --- | --- |
| High | SVG strict 모드 안내 | 신뢰할 수 없는 SVG 입력에서 소비자가 `svgSanitizer: 'strict'` 필요성을 놓칠 수 있음 | README, 타입 JSDoc, `SVG-SECURITY.md`의 선택 기준 유지 |
| High | SVG 구조 제한 | depth, 큰 viewBox, 순환 참조, 무한 애니메이션 방어가 제한적 | `maxDepth`, 좌표 범위, 순환 참조 감지 순으로 설계 |
| Medium | 고해상도 전략 선택 정책 방향 불일치(내부 경계) | 진입 게이트는 `HighResolutionDetector.shouldUseHighResolutionPath()`(`docs/design/2026-08-14-high-res-entry-gate-design.md`), 진입 후 전략 선택은 `AutoHighResProcessor`가 더 이상 상시 강제하지 않아 `HighResolutionManager.selectOptimalStrategy()`의 실제 로직이 도달 가능해짐(`docs/design/2026-08-14-high-res-wrapper-consolidation-design.md`). 64MB·256MB 리터럴 중복은 `docs/design/2026-08-15-high-res-threshold-dedup-design.md`로 해소됨(`HighResolutionDetector.MEDIUM_MEMORY_THRESHOLD_MB`/`LARGE_MEMORY_THRESHOLD_MB` 단일 소유). `selectMemoryEfficientStrategy()`의 32MB는 재조사 결과 어디에도 중복되지 않는 독립 로컬 정책값으로 확인돼 통합 대상에서 제외됐다. 남는 문제는 임계값 숫자 불일치가 아니라 balanced(`determineStrategy()`, 16MB 초과 TILED — 공격적)와 fast(`selectFastStrategy()`, 64MB 이하 DIRECT — 관대)의 정책 방향 자체가 다르다는 점이다 | 정책 방향 불일치가 실제 버그로 보고되면(예: 같은 이미지가 priority별로 다른 전략을 타는 사용자 리포트) 우선순위별 트레이드오프를 재설계하는 별도 카드로 착수 |
| Low | `SmartResizeOptions` 유령 공개 타입 | `src/index.ts`가 재노출하지만 라이브러리 내부에서 이 타입을 파라미터로 받는 곳이 없다(`SmartProcessor` 삭제로 유일한 사용처가 사라짐) | 공개 API 문서·타입에서 제거할지 판단 |

## 기록하지 않는 항목

작은 스타일 차이, 생성 스냅샷의 디렉터리 목록, 일회성 분석 메모는 이 문서에 남기지 않습니다. 실제 작업으로 전환할 때는 구체적인 완료 조건과 테스트 기준을 별도 이슈나 작업 문서에 둡니다.
