# 유지보수 리스크

이 문서는 현재 코드에서 장기적으로 추적할 가치가 큰 항목만 남긴 목록입니다. 작업 전에 실제 코드와 다시 대조하세요.

## 우선 확인할 항목

| 우선순위 | 항목 | 이유 | 다음 행동 |
| --- | --- | --- | --- |
| High | SVG strict 모드 안내 | 신뢰할 수 없는 SVG 입력에서 소비자가 `svgSanitizer: 'strict'` 필요성을 놓칠 수 있음 | README, 타입 JSDoc, `SVG-SECURITY.md`의 선택 기준 유지 |
| High | SVG 구조 제한 | depth, 큰 viewBox, 순환 참조, 무한 애니메이션 방어가 제한적 | `maxDepth`, 좌표 범위, 순환 참조 감지 순으로 설계 |
| Medium | 고해상도 전략 선택 정책 방향 불일치(내부 경계) | 4개 티어 함수(balanced/fast/high/memory-pressure) 전부 `src/base/strategy-policy.internal.ts` 한 곳으로 통합됨(`docs/design/2026-08-16-high-res-strategy-policy-consolidation-design.md`) — 임계값(16/32/64/256MB, scaleRatio 0.3)은 이 통합으로 손대지 않았다. 부수로, fast/high/memory-pressure가 빠뜨리던 캔버스 크기 한계 가드가 이제 balanced와 동일하게 공통 적용된다. 남는 문제는 여전히 임계값 숫자 불일치가 아니라 balanced(16MB 초과 TILED — 공격적)와 fast(64MB 이하 DIRECT — 관대)의 정책 방향 자체가 다르다는 점이다 — 이번 카드는 표를 한 곳으로 모았을 뿐 방향 자체는 재설계하지 않았다(의도적 비범위) | 정책 방향 불일치가 실제 버그로 보고되면(예: 같은 이미지가 priority별로 다른 전략을 타는 사용자 리포트) 우선순위별 트레이드오프를 재설계하는 별도 카드로 착수 |
| Low | `SmartResizeOptions` 유령 공개 타입 | `src/index.ts`가 재노출하지만 라이브러리 내부에서 이 타입을 파라미터로 받는 곳이 없다(`SmartProcessor` 삭제로 유일한 사용처가 사라짐) | 공개 API 문서·타입에서 제거할지 판단 |
| Low | `/advanced` 포맷 선택·일괄 처리 다중 구현(관찰) | 포맷 최적화 판정이 최소 2곳에 존재 — `OutputPipeline`의 내부 `getBestFormat()`(core 기본값, webp>png, `output-pipeline.internal.ts:382-387`), `SmartFormatSelector.selectOptimalFormat()`(advanced, 픽셀 샘플링, `smart-format.ts:61-90`) — 런타임 판정 로직 간 호출·공유 없음. (`FormatDetector.getBestFormat()`은 내부 호출자 0건이 재확인되어 2026-08-16 제거됨 — `isSupported()`/`getSupportedFormats()`는 `SmartFormatSelector`가 실사용하므로 유지) 일괄 처리도 `advanced-index.ts` 배럴에서 `BatchResizer`(concurrency+timeout+AutoMemoryManager)와 `batchOptimize()`(advanced-index.ts, →`AdvancedImageProcessor.batchProcess()`, concurrency+progress 콜백, timeout·메모리 점검 없음)가 나란히 재노출된다. 두 실행기는 concurrency 청크 루프를 `processInChunks()` 공유 seam에 위임하지만 timeout·메모리 점검·progress 계약은 독립적이다. 둘 다 core 경로(`ImageProcessor`/`OutputPipeline`)를 건드리지 않고 각각 전용 테스트가 있다 | 실사용 리포트(예: "왜 스마트 포맷이 두 개냐")나 두 짝 중 하나가 실제로 같이 수정돼야 하는 사건이 생기면, `SmartFormatSelector`를 `OutputPipeline`의 선택적 전략으로 흡수하거나 `AdvancedImageProcessor.batchProcess()`가 `BatchResizer`에 위임하도록 재설계하는 별도 카드로 착수. 그 전까지는 교차 참조 JSDoc(2026-08-15 추가, Task 1-5)으로 탐색성만 확보 |

## 기록하지 않는 항목

작은 스타일 차이, 생성 스냅샷의 디렉터리 목록, 일회성 분석 메모는 이 문서에 남기지 않습니다. 실제 작업으로 전환할 때는 구체적인 완료 조건과 테스트 기준을 별도 이슈나 작업 문서에 둡니다.
