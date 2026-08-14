# 유지보수 리스크

이 문서는 현재 코드에서 장기적으로 추적할 가치가 큰 항목만 남긴 목록입니다. 작업 전에 실제 코드와 다시 대조하세요.

## 우선 확인할 항목

| 우선순위 | 항목 | 이유 | 다음 행동 |
| --- | --- | --- | --- |
| High | SVG strict 모드 안내 | 신뢰할 수 없는 SVG 입력에서 소비자가 `svgSanitizer: 'strict'` 필요성을 놓칠 수 있음 | README, 타입 JSDoc, `SVG-SECURITY.md`의 선택 기준 유지 |
| High | SVG 구조 제한 | depth, 큰 viewBox, 순환 참조, 무한 애니메이션 방어가 제한적 | `maxDepth`, 좌표 범위, 순환 참조 감지 순으로 설계 |
| Medium | 고해상도 전략 선택 임계값 불일치(내부 경계) | 진입 게이트는 `HighResolutionDetector.shouldUseHighResolutionPath()`(`docs/design/2026-08-14-high-res-entry-gate-design.md`), 진입 후 전략 선택은 `AutoHighResProcessor`가 더 이상 상시 강제하지 않아 `HighResolutionManager.selectOptimalStrategy()`의 실제 로직이 도달 가능해짐(`docs/design/2026-08-14-high-res-wrapper-consolidation-design.md`). 그 로직이 참조하는 경계 값 자체(`high-res-detector`의 16MB vs `selectMemoryEfficientStrategy`의 32MB, `selectFastStrategy`의 64MB, `selectHighQualityStrategy`의 256MB)는 여전히 각자 다른 숫자다 | 남은 경계 값 자체를 단일 소유자로 통합할지 판단(재현 가능한 버그로 보고되면 착수) |
| Medium | advanced/high-res 테스트 공백 | 공개 고급 API 회귀를 놓치기 쉬움 | 공개 API 기준 단위/통합 테스트 추가 |
| Low | `SmartResizeOptions` 유령 공개 타입 | `src/index.ts`가 재노출하지만 라이브러리 내부에서 이 타입을 파라미터로 받는 곳이 없다(`SmartProcessor` 삭제로 유일한 사용처가 사라짐) | 공개 API 문서·타입에서 제거할지 판단 |

## 기록하지 않는 항목

작은 스타일 차이, 생성 스냅샷의 디렉터리 목록, 일회성 분석 메모는 이 문서에 남기지 않습니다. 실제 작업으로 전환할 때는 구체적인 완료 조건과 테스트 기준을 별도 이슈나 작업 문서에 둡니다.
