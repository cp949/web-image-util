# 유지보수 리스크

이 문서는 현재 코드에서 장기적으로 추적할 가치가 큰 항목만 남긴 목록입니다. 작업 전에 실제 코드와 다시 대조하세요.

## 우선 확인할 항목

| 우선순위 | 항목 | 이유 | 다음 행동 |
| --- | --- | --- | --- |
| High | SVG strict 모드 안내 | 신뢰할 수 없는 SVG 입력에서 소비자가 `svgSanitizer: 'strict'` 필요성을 놓칠 수 있음 | README, 타입 JSDoc, `SVG-SECURITY.md`의 선택 기준 유지 |
| High | SVG 구조 제한 | depth, 큰 viewBox, 순환 참조, 무한 애니메이션 방어가 제한적 | `maxDepth`, 좌표 범위, 순환 참조 감지 순으로 설계 |
| High | 테스트 훅 `_SVG_MOCK_MODE` | 프로덕션 번들에 테스트 전용 전역 플래그 검사가 남아 있음 | 테스트 전용 주입 지점으로 이동하거나 빌드 타임 제거 |
| High | Node 전용 `global.gc()` | 브라우저 전용 라이브러리 원칙과 맞지 않는 런타임 분기 | Canvas/Blob URL 생명주기 관리로 통일 |
| Medium | 고해상도 처리 로직 중복 | `HighResolutionManager`와 내부 processor가 발산할 수 있음 | 공통 내부 모듈 추출 또는 한 구현으로 통합 |
| Medium | `performance.memory` 분산 참조 | Chromium 전용 API fallback이 파일마다 달라질 수 있음 | 브라우저 capabilities 유틸 한 곳으로 통합 |
| Medium | advanced/high-res 테스트 공백 | 공개 고급 API 회귀를 놓치기 쉬움 | 공개 API 기준 단위/통합 테스트 추가 |

## 기록하지 않는 항목

작은 스타일 차이, 생성 스냅샷의 디렉터리 목록, 일회성 분석 메모는 이 문서에 남기지 않습니다. 실제 작업으로 전환할 때는 구체적인 완료 조건과 테스트 기준을 별도 이슈나 작업 문서에 둡니다.
