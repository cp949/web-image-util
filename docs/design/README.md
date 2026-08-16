# 설계 결정 기록

이 폴더는 현재 운영 절차가 아니라, 특정 기능이나 정책을 왜 그렇게 설계했는지 남기는 결정 기록을 보관한다.

반복해서 실행해야 하는 운영 절차는 `docs/` 루트의 주제별 문서에 둔다. 예를 들어 배포 절차는 `docs/release-checklist.md`, `llm.txt` 생성과 검증 기준은 `docs/llm-txt.md`를 기준으로 한다.

## 현재 기록

- `2026-05-02-ensure-converters-design.md`: `ensureXxx()` 변환 API의 계약과 비범위
- `2026-05-03-browser-smoke-release-gate-design.md`: browser smoke test를 `verify:release` gate로 둔 결정 근거
- `2026-08-13-image-decode-seam-design.md`: 이미지 디코드를 단일 소유 모듈로 모으고 구동 방식만 adapter로 가른 결정 근거
- `2026-08-13-svg-uri-ref-verdict-design.md`: SVG 참조 판정을 이유 코드 하나로 모으고 제거·거부·집계를 소비자 동작으로 남긴 결정 근거
- `2026-08-14-svg-warning-reference-axis-design.md`: 참조 판정 이관에서 빠진 경고 축을 소비자로 이관한 결정 근거
- `2026-08-14-byte-signature-facts-design.md`: 매직바이트 이미지 포맷 판정을 detectFormatFromBytes 하나로 모으고 소비자별 폴백을 투영으로 남긴 결정 근거
- `2026-08-14-processor-interface-parity-design.md`: shortcut 프로세서 인터페이스의 출력 메서드 표면을 실제 구현과 맞춘 결정 근거
- `2026-08-14-composition-placement-design.md`: 워터마크 단일·반복 배치를 내부 모듈로 모으고 frame/per-tile 회전 표현을 보존한 결정 근거
- `2026-08-15-svg-id-reference-integrity-design.md`: SVG id 참조 판정을 단일 모듈로 모으고 제거·병합 단계가 참조 무결성을 보존하게 한 결정 근거
- `2026-08-15-browser-capability-detector-facade-design.md`: BrowserCapabilityDetector 위임 파사드를 제거하고 테스트 전용 clearCache를 배럴 밖 모듈 함수로 옮긴 결정 근거
- `2026-08-15-get-image-dimensions-shadow-removal-design.md`: source-converter의 죽은 getImageDimensions 그림자 구현과 전용 테스트를 함께 제거한 결정 근거
- `2026-08-15-resize-performance-options-ghost-fields-design.md`: ResizePerformanceOptions의 구현이 읽지 않는 유령 필드(useCanvasPool/memoryLimitMB)를 제거한 결정 근거
- `2026-08-15-blur-naming-disambiguation-design.md`: blur() 체이닝 API와 BlurFilterPlugin이 이름만 같고 무관하다는 사실을 문서로 드러낸 결정 근거
- `2026-08-15-high-res-threshold-dedup-design.md`: high-res-manager의 selectFastStrategy/selectHighQualityStrategy가 들고 있던 64MB/256MB 리터럴을 high-res-detector의 단일 소유 상수로 교체하고, 무호출 죽은 코드(AutoMemoryManager.recommendProcessingStrategy 등)를 함께 제거한 결정 근거
- `2026-08-16-svg-reference-attribute-consolidation-design.md`: SVG 참조 속성 판정(href/xlink:href/src)을 단일 leaf로 모으고 prefix-svg-ids/svg-optimizer의 비표준 prefix xlink 인식 결함을 해소한 결정 근거
- `2026-08-16-svg-effective-size-parity-design.md`: viewBox 없는 SVG의 크기 조회와 렌더 경로가 동일한 fit-content 유효 크기를 사용하게 한 결정 근거
- `2026-08-17-canvas-limit-single-source-design.md`: compose.ts의 canvas 크기 상한 검증과 single-renderer.internal.ts의 대형 canvas 경고가 각자 하드코딩하던 리터럴을 canvas-limits.internal.ts leaf 참조로 정합한 결정 근거
