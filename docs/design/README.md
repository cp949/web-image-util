# 설계 결정 기록

이 폴더는 현재 운영 절차가 아니라, 특정 기능이나 정책을 왜 그렇게 설계했는지 남기는 결정 기록을 보관한다.

반복해서 실행해야 하는 운영 절차는 `docs/` 루트의 주제별 문서에 둔다. 예를 들어 배포 절차는 `docs/release-checklist.md`, `llm.txt` 생성과 검증 기준은 `docs/llm-txt.md`를 기준으로 한다.

## 현재 기록

- `2026-05-02-ensure-converters-design.md`: `ensureXxx()` 변환 API의 계약과 비범위
- `2026-05-03-browser-smoke-release-gate-design.md`: browser smoke test를 `verify:release` gate로 둔 결정 근거
- `2026-08-13-image-decode-seam-design.md`: 이미지 디코드를 단일 소유 모듈로 모으고 구동 방식만 adapter로 가른 결정 근거
- `2026-08-13-svg-uri-ref-verdict-design.md`: SVG 참조 판정을 이유 코드 하나로 모으고 제거·거부·집계를 소비자 동작으로 남긴 결정 근거
- `2026-08-14-svg-warning-reference-axis-design.md`: 참조 판정 이관에서 빠진 경고 축을 소비자로 이관한 결정 근거
