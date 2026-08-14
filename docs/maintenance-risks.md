# 유지보수 리스크

이 문서는 현재 코드에서 장기적으로 추적할 가치가 큰 항목만 남긴 목록입니다. 작업 전에 실제 코드와 다시 대조하세요.

## 우선 확인할 항목

| 우선순위 | 항목 | 이유 | 다음 행동 |
| --- | --- | --- | --- |
| High | SVG strict 모드 안내 | 신뢰할 수 없는 SVG 입력에서 소비자가 `svgSanitizer: 'strict'` 필요성을 놓칠 수 있음 | README, 타입 JSDoc, `SVG-SECURITY.md`의 선택 기준 유지 |
| High | SVG 구조 제한 | depth, 큰 viewBox, 순환 참조, 무한 애니메이션 방어가 제한적 | `maxDepth`, 좌표 범위, 순환 참조 감지 순으로 설계 |
| Medium | 고해상도 전략 선택 임계값 불일치 | `high-res-detector`/`high-res-manager`/`auto-high-res`/`smart-processor` 4곳이 direct/stepped/tiled 선택 임계값을 각자 다른 숫자로 판정함(adapter 레지스트리 중복은 해소됨 — `docs/design/2026-08-14-resize-strategy-seam-design.md`) | 4개 지점의 임계값을 단일 소유자로 통합 |
| Medium | advanced/high-res 테스트 공백 | 공개 고급 API 회귀를 놓치기 쉬움 | 공개 API 기준 단위/통합 테스트 추가 |

## 기록하지 않는 항목

작은 스타일 차이, 생성 스냅샷의 디렉터리 목록, 일회성 분석 메모는 이 문서에 남기지 않습니다. 실제 작업으로 전환할 때는 구체적인 완료 조건과 테스트 기준을 별도 이슈나 작업 문서에 둡니다.
