# Node 테스트 mock 신뢰 경계

`tests/setup.ts`는 Node.js/happy-dom 테스트에서 브라우저 API의 빈 부분을 보완하기 위해 `tests/setup/canvas-mock.ts`를 로드한다. 이 mock은 빠른 단위 테스트와 계약 테스트를 위한 편의 계층이며, 실제 브라우저 렌더링 품질을 보장하지 않는다.

장기적인 테스트 파일 배치와 이름 규칙은 [`../TESTING-GUIDE.md`](../TESTING-GUIDE.md)를 따른다.

## 파일 구조

`canvas-mock.ts`는 진입점이며, 실제 mock 구현은 책임별로 `mocks/` 하위에 분리되어 있다. 외부 vitest 설정은 진입점 경로(`./tests/setup/canvas-mock.ts`)만 참조한다.

| 파일 | 책임 |
| --- | --- |
| [`canvas-mock.ts`](./canvas-mock.ts) | 진입점 — 아래 모듈을 side-effect import + SVG mock 플래그 |
| [`mocks/canvas-element.ts`](./mocks/canvas-element.ts) | `HTMLCanvasElement`, `CanvasRenderingContext2D`, `toBlob`/`toDataURL` |
| [`mocks/image-element.ts`](./mocks/image-element.ts) | `HTMLImageElement`, `Image` (src 설정 시 즉시 onload) |
| [`mocks/document-globals.ts`](./mocks/document-globals.ts) | `document.createElement` 패치, `window`, `DOMParser`, `XMLSerializer` |
| [`mocks/object-url.ts`](./mocks/object-url.ts) | `URL.createObjectURL` / `URL.revokeObjectURL` |
| [`mocks/file-reader.ts`](./mocks/file-reader.ts) | `FileReader` (`readAsDataURL`/`readAsArrayBuffer`/`readAsText`) |

import 순서는 의존성(canvas/image → document-globals) 때문에 진입점에서 고정한다.

## 이 mock이 맡는 것

- `document.createElement('canvas')`, `document.createElement('img')`, `new Image()`를 예측 가능한 객체로 만든다.
- `HTMLCanvasElement.toBlob()`이 요청 MIME과 대략적인 크기를 가진 `Blob`을 반환하도록 한다.
- `HTMLCanvasElement.toDataURL()`이 고정 Data URL 문자열을 반환하도록 한다.
- `CanvasRenderingContext2D`의 주요 메서드가 호출 가능하게 한다.
- `FileReader`, `URL.createObjectURL()`, `URL.revokeObjectURL()`처럼 Node 환경에 없는 API를 최소 구현한다.

## 이 mock이 보장하지 않는 것

- 실제 픽셀 색상, 안티앨리어싱, 블러, 그라디언트, 텍스트 렌더링 품질
- 브라우저별 `canvas.toBlob()` MIME fallback 동작
- 실제 이미지 디코딩, Data URL/Blob 로딩 타이밍, `HTMLImageElement` 오류 이벤트
- SVG 문자열이나 SVG Data URL이 브라우저 렌더러에서 그려지는지 여부
- 실제 파일 크기나 압축 품질

## 테스트를 어디에 둘지 판단하는 기준

- 옵션 검증, 타입 계약, metadata 계산, 오류 경로, 호출 순서 검증은 Node/happy-dom 테스트에 둔다.
- 실제 MIME, 픽셀 샘플, SVG 렌더링, Data URL/Blob/HTMLImageElement 실제 로딩 경로는 `tests/browser/**`에 둔다.
- Node 테스트 이름에는 실제 렌더링 품질을 보장하는 것처럼 쓰지 않는다. mock 경로라면 크기, metadata, 호출 순서, 예외처럼 mock이 실제로 표현할 수 있는 결과를 기준으로 이름을 붙인다.
