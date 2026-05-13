# @cp949/web-image-util 아키텍처

이 문서는 라이브러리의 내부 처리 흐름과 핵심 모듈을 설명합니다. 사용 가이드는 [README](../sub/web-image-util/README.md)를 참고하세요.

## 전체 처리 방식

`processImage()`는 입력 소스를 브라우저에서 렌더링 가능한 이미지 요소로 변환한 뒤, `ImageProcessor` 체이닝 API를 반환합니다. 문자열, URL, Blob/File, ArrayBuffer 계열 입력은 먼저 소스 타입을 판정하고, SVG 입력은 MIME과 내용 스니핑을 함께 확인한 다음 브라우저 렌더링에 맞게 정규화합니다.

체이닝 단계에서는 `resize()`, `blur()` 같은 연산을 즉시 Canvas에 그리지 않고 `LazyRenderPipeline`에 누적합니다. 최종 출력 메서드(`toBlob()`, `toDataURL()`, `toFile()`, `toCanvas()`)가 호출되면 `ResizeCalculator`가 fit 모드와 최종 레이아웃을 계산하고, `OnehotRenderer`가 한 번의 `drawImage()` 중심 렌더링으로 품질 설정, 배경색, 포맷 변환까지 처리합니다.

## 핵심 흐름

1. **입력 처리**: 파일, URL, SVG 등 여러 소스를 `HTMLImageElement`로 변환
2. **연산 누적**: `.resize()`, `.blur()` 같은 체이닝 메서드를 `LazyRenderPipeline`에 저장
3. **배치 렌더링**: 최종 출력 시점에 단 한 번의 Canvas 처리로 전체 연산 실행
4. **포맷 변환**: Canvas 결과를 Blob, DataURL, File 등으로 변환

## 핵심 특성

- **지연 렌더링**: 중간 Canvas를 만들지 않아 메모리 효율이 높음
- **SVG 호환성 보정**: 브라우저별 SVG 렌더링 차이를 자동 보정
- **타입 안정성**: 잘못된 체이닝(예: `resize()` 중복 호출)을 컴파일 타임에 방지
- **포맷 선택**: 브라우저 지원 여부를 바탕으로 적절한 포맷 선택

## 아키텍처 불변조건

아래 규칙은 기능 추가나 리팩터링 때 우선 확인합니다.

- `resize()`, `blur()` 같은 체이닝 메서드는 Canvas에 즉시 그리지 않고 연산만 누적합니다.
- 한 체인에서 `resize()`는 한 번만 허용합니다. 타입 상태와 런타임 가드를 함께 유지합니다.
- 실제 Canvas 렌더링은 출력 메서드 호출 시점에 한 번만 수행합니다.
- 내부 렌더링 Canvas는 `CanvasPool`을 통해 획득하고 반환합니다.
- `toCanvas()`와 `toCanvasDetailed()`의 반환 Canvas는 사용자 소유이므로 pool에 반환하지 않습니다.
- 공개 진입점은 `sub/web-image-util/package.json`의 `exports` 필드에 선언된 경로로 제한합니다.
- SVG 입력은 단순 문자열 검사로 분기하지 않고 `source-converter/`의 다단계 판정 경로를 사용합니다.

## Canvas Pool

라이브러리는 내부적으로 Canvas Pool을 사용해 Canvas 객체를 재사용합니다. 매 처리마다 새 Canvas를 생성·파괴하는 대신, 완료된 Canvas를 풀에 반환하여 다음 처리에 재사용합니다.

- **GC 압력 감소**: 반복 처리 시 Canvas 생성·소멸로 인한 Garbage Collection 빈도를 줄입니다.
- **처리 비용 감소**: 반복 처리에서 Canvas 생성 오버헤드를 줄입니다.
- **자동 관리**: 별도 설정 없이 `toBlob()`, `toDataURL()`, `toFile()` 사용 시 자동으로 작동합니다.

`.toCanvas()` 또는 `.toCanvasDetailed()`를 사용하면 Canvas 객체를 직접 받습니다. 이 경우 Canvas는 풀에 자동 반환되지 않으므로 사용이 끝나면 참조를 해제하면 됩니다. 대용량 반복 작업에서는 `toBlob()`을 사용하여 Canvas 수명 주기를 자동으로 관리하는 것을 권장합니다.

## 핵심 모듈

| 파일 | 역할 |
| --- | --- |
| `src/processor.ts` | `processImage()` 팩토리와 `ImageProcessor` 체이닝 API |
| `src/core/source-converter.ts` | 위 서브모듈의 공개 API(`convertToImageElement`, `detectSourceType`, `getImageDimensions`)를 모은 배럴 |
| `src/core/source-converter/index.ts` | `convertToImageElement` / `getImageDimensions` 오케스트레이션 |
| `src/core/source-converter/detect.ts` | `detectSourceType()`과 `SourceType` 정의 |
| `src/core/source-converter/options.ts` | 내부 옵션 타입과 `MAX_SVG_BYTES` 등 상수 |
| `src/core/source-converter/svg/` | SVG 안전 경로 — `data-url.ts`, `loader.ts`, `safety.ts` |
| `src/core/source-converter/url/` | HTTP/Blob URL 로더 — `policy.ts`, `fetch-guards.ts`, `loader.ts` |
| `src/core/source-converter/loaders/` | 형태별 입력 변환기 — `string.ts`, `blob.ts`, `canvas.ts` |
| `src/utils/svg-detection.ts` | `isInlineSvg()` 등 SVG 문자열 판정 |
| `src/utils/svg-sanitizer.ts` | `sanitizeSvgForRendering()`, `sanitizeSvg()` (deprecated alias) |
| `src/utils/inspect-svg.ts` | SVG 문자열 진단 API — 부수효과 없이 findings·dimensions·sanitizer 추천을 반환하는 진단 레이어 |
| `src/utils/prefix-svg-ids.ts` | SVG `id`와 fragment reference를 prefix하는 standalone 정규화 유틸 — 파이프라인 외부, `@cp949/web-image-util/utils` 서브패스 |
| `src/svg-sanitizer/inspect-sanitization.ts` | sanitizer 정책 영향 진단 API — `inspectSvgSanitization()`. 정책별 stage 카운트를 반환하며 파이프라인 외부의 진단 레이어다. strict는 동적 import. |
| `src/core/lazy-render-pipeline.ts` | 연산 누적과 최종 렌더링 트리거 |
| `src/core/single-renderer.ts` | 누적 연산 분석 및 단일 렌더링 진입점 |
| `src/core/onehot-renderer.ts` | 최종 Canvas drawImage 렌더링 |
| `src/types/resize-config.ts` | ResizeConfig 타입 시스템 |

## 공개 API 표면

새 export를 추가하거나 제거할 때는 `sub/web-image-util/package.json`의 `exports` 필드, 배럴 파일, contract 테스트를 함께 갱신합니다.

| npm 경로 | 소스 진입점 |
| --- | --- |
| `@cp949/web-image-util` | `src/index.ts` |
| `@cp949/web-image-util/advanced` | `src/advanced-index.ts` |
| `@cp949/web-image-util/presets` | `src/presets/index.ts` |
| `@cp949/web-image-util/utils` | `src/utils/index.ts` |
| `@cp949/web-image-util/filters` | `src/filters/plugins/index.ts` |
| `@cp949/web-image-util/svg-sanitizer` | `src/svg-sanitizer/index.ts` |

## SVG 감지의 중요성

`source-converter/`의 SVG 감지 로직은 이 라이브러리의 가장 중요한 기술입니다. 단순 문자열 검사(`includes('<svg')`나 `startsWith('<?xml')`)에 의존하지 않고 다음 단계로 이중 검증합니다.

- `detectSourceType()` *(source-converter/detect.ts)* — 소스 타입 감지
- `isInlineSvg()` *(utils/svg-detection.ts)* — 인라인 SVG 판정
- `stripXmlPreambleAndNoise()` *(utils/svg-detection.ts)* — BOM, XML 선언, 주석, DOCTYPE 제거 후 판정
- `sniffSvgFromBlob()` *(source-converter/svg/data-url.ts)* — Blob 내용 스니핑(첫 4KB만 읽음)
- `parseSvgFromDataUrl()` *(source-converter/svg/data-url.ts)* — Data URL SVG 검증
- `assertSafeSvgContent()` *(source-converter/svg/safety.ts)* — sanitize 후 잔여 외부 참조 fail-closed 차단
- `convertSvgToElement()` *(source-converter/svg/loader.ts)* — SVG 정규화와 고품질 브라우저 렌더링

수정 시 다양한 케이스 테스트, XSS·canvas 오염 방지를 함께 고려해야 합니다.
