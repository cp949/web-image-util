# 테스트 작성 가이드

이 문서는 `@cp949/web-image-util` 테스트를 장기적으로 늘릴 때 파일 구조와 검증 책임이 흐트러지지 않도록 잡아두는 기준이다.

## 디렉터리 기준

- `tests/unit/**`: 순수 함수, 옵션 정규화, metadata 계산, 오류 경로, mock으로 표현 가능한 브라우저 API 호출 계약을 검증한다.
- `tests/contract/**`: 공개 export, 패키지 매니페스트, 배포 산출물의 API 계약을 검증한다.
- `tests/security/**`: SVG 정화, 원격 입력 제한, fail-closed 정책처럼 보안 요구사항을 검증한다.
- `tests/browser/**`: 실제 브라우저 렌더링, MIME fallback, 이미지 디코딩, 픽셀 샘플처럼 Node mock이 보장하지 않는 동작을 검증한다.
- `tests/integration/**`: 여러 공개 API가 함께 연결되는 사용자 흐름을 검증한다.
- `tests/performance/**`: 시간/메모리 예산을 다루는 회귀 방지 테스트를 둔다.

루트 `tests/**`는 릴리스/검증 스크립트 같은 모노레포 운영 코드에만 사용하고, 라이브러리 동작 테스트는 `sub/web-image-util/tests/**`에 둔다.

## 파일 분리 기준

- 새 테스트 파일은 기능 축을 기준으로 만든다. 예: `processor/processor-resize/output-formats.test.ts`, `utils/image-info/get-image-format.test.ts`.
- 한 파일이 250~300줄을 넘기기 시작하면 다음 테스트 추가 시점에 하위 디렉터리나 세부 파일로 나눈다.
- 같은 setup, fixture, helper를 공유하는 테스트끼리는 한 파일에 두되, 서로 다른 실패 원인을 가진 영역은 파일을 분리한다.
- 기존 파일은 대규모로 쪼개기보다, 해당 영역을 새로 수정하거나 테스트를 추가할 때 함께 정리한다.

## 테스트 환경 정책

새로 추가하는 테스트는 jsdom 환경을 가정하고 작성한다. jsdom에서 의미가 흔들리는 브라우저 로딩/렌더링 검증은 `tests/browser/**`로 옮긴다.

jsdom은 실제 브라우저를 완벽하게 대체하는 환경이 아니다. DOM 표준 API와 브라우저 API 호출 계약을 빠르게 검증하기 위한 단위 테스트 환경으로 본다. 렌더링, 레이아웃, 이미지 디코딩, 브라우저별 인코딩 품질처럼 실제 브라우저 엔진이 필요한 결과는 jsdom 통과 여부를 production 동작의 증거로 삼지 않는다.

특정 DOM 시뮬레이터 고유의 비표준 동작에 의존하지 않는다. 대표 예시는 다음과 같다.

- `HTMLImageElement.onload`가 `src` 할당 직후 동기 호출되는 타이밍에 기반한 단정
- 표준 브라우저와 다르게 동기적으로 끝나는 DOM 이벤트 흐름 가정
- 단위 테스트 환경이 미구현이라 비어 있는 결과를 "정상 동작"으로 단정

테스트 환경이 보장하지 않는 결과를 강하게 단정하지 않는다. 환경 차이가 의심되면 [환경 차이가 의심될 때](#환경-차이가-의심될-때)를 참고해 검증 위치를 옮긴다.

## 테스트 이름과 주석

- `describe`, `it`, `test` 제목은 한국어로 작성하고 요구사항이 드러나게 쓴다.
- 주석은 구현을 읽어주는 설명보다 테스트의 의도, 회귀 맥락, mock 신뢰 경계를 설명할 때만 단정하게 작성한다.
- 기존 영문 제목은 관련 파일을 건드릴 때 함께 한국어로 정리한다.

## Helper 사용

- 이미지 입력은 `tests/utils/image-helper.ts`와 `tests/utils/canvas-helper.ts`의 fixture를 우선 사용한다.
- SVG 입력은 `tests/utils/svg-fixtures.ts` 또는 테스트 파일 안의 작은 fixture를 사용한다.
- fetch/네트워크 mock은 `tests/utils/fetch-helper.ts`의 `withFetchMock` 같은 scope helper를 사용한다.
- 여러 파일에서 반복되는 mock fetch, canvas, Blob 생성 로직은 `tests/utils/**`로 옮긴다.

## 전역 API 직접 수정 금지

테스트에서 다음 전역을 직접 덮어쓰거나 patch하지 않는다.

- `globalThis.fetch`
- `document.createElement`, `window.*` 직접 patch
- `URL.createObjectURL`, `URL.revokeObjectURL`
- `console.warn`, `console.error` 등 로깅 전역
- `Image`, `HTMLImageElement` 같은 전역 생성자

대신 `tests/utils/`의 scoped helper(예: `withFetchMock`)를 사용한다. helper는 setup과 teardown을 내부에서 끝내, 호출 측 테스트가 cleanup을 잊어도 다음 테스트가 깨지지 않도록 한다.

필요한 helper가 없으면 `tests/utils/`에 추가하고 `tests/utils/index.ts`로 공개 표면을 정리한다. 한 파일에서 일회성으로 사용하는 짧은 mock은 그대로 파일 안에 둬도 된다 — 같은 모양이 여러 파일에 세 번 이상 반복되면 그때 helper로 옮긴다.

이 helper 묶음은 라이브러리가 실제로 접촉하는 브라우저 API 표면을 그대로 따라간다. 사용 데이터가 충분히 자라면 production 코드에 같은 모양의 추상화(예: BrowserRuntime adapter)를 도입할지 그때 판단한다. helper 사용 사례 없이 production 추상화를 먼저 만들지 않는다.

## jsdom 신뢰 경계

단위 테스트 환경(jsdom + canvas)은 실제 픽셀 품질이나 브라우저별 인코딩 동작을 보장하지 않는다. 그런 검증은 browser 테스트로 올린다.

## 환경 차이가 의심될 때

특정 동작이 실제 브라우저와 다르게 동작한다고 의심되면 검증 위치를 다음 기준으로 옮긴다.

- 픽셀 색상, 안티앨리어싱, 실제 디코딩 결과, 이미지 로드 이벤트 순서, MIME fallback: `tests/browser/**`로 옮긴다.
- DOM/`DOMParser`/`URL`/`fetch` 표준 동작: jsdom에서 재현되면 `tests/unit/**`에 둔다. 재현되지 않으면 browser 테스트로 옮긴다.
- 단위 테스트 환경이 보장하지 않는 결과를 강하게 단정하지 않는다.

테스트 위치를 판단할 때 다음 기준을 우선한다.

| 검증하려는 것 | 권장 위치 | 이유 |
| --- | --- | --- |
| 옵션 정규화, 타입 계약, 에러 경로, 호출 순서 | `tests/unit/**` + jsdom | 실제 렌더링 없이도 계약을 검증할 수 있다. |
| DOM 구조, 속성, `DOMParser`, URL 파싱, fetch guard | `tests/unit/**` + jsdom | jsdom이 제공하는 표준 DOM API 범위에 가깝다. |
| Canvas API 호출 인자, pool 반환 여부, metadata | `tests/unit/**` + jsdom | 결과 품질이 아니라 호출 계약을 검증한다. |
| `getBoundingClientRect()`, `offset*`, viewport 기반 가시성, CSS layout | `tests/browser/**` 또는 강한 단정 금지 | jsdom은 layout을 계산하지 않는다. |
| `HTMLImageElement` 실제 로드, Blob/Data URL 이미지 디코딩, object URL 생명주기 | `tests/browser/**` | jsdom의 resource loader와 실제 브라우저 로더가 다르다. |
| 픽셀 샘플, SVG 실제 렌더링, `canvas.toBlob()` MIME fallback, 압축 품질 | `tests/browser/**` | 브라우저 렌더링/인코딩 엔진의 책임이다. |
| `window.location.href` 변경 같은 navigation | `tests/browser/**` 또는 별도 추상화 검증 | jsdom은 새 Window/Document로 navigation하지 않는다. |

테스트 환경 차이를 맞추려고 production 동작을 바꾸지 않는다. production 표준 동작과 단위 테스트 환경이 어긋나면 production이 옳다고 본다. 환경이 미구현이라는 이유로 production 단정을 약화하지 않는다.

## 알려진 jsdom 제약

jsdom 29 환경에서 다음 동작은 지원되지 않거나 표준과 다르게 끝난다. 해당 단정이 필요한 테스트는 `tests/browser/**`로 옮긴다.

- `URL.createObjectURL(blob)` + `HTMLImageElement` 로드: jsdom 자체에는 `URL.createObjectURL`이 없다. vitest 환경에서는 Node 전역 구현이 노출되지만 결과 URL이 `blob:nodedata:` 스킴이라 jsdom resource loader가 해석하지 못해 `img.onerror`가 즉시 발생한다. Blob → Object URL → Image 로드 자체가 동작하지 않는다.
- layout/rendering: jsdom은 실제 레이아웃과 렌더링을 하지 않는다. `getBoundingClientRect()`, `offsetTop`, `offsetWidth` 같은 값은 실제 브라우저 배치 결과로 보지 않는다.
- `pretendToBeVisual`: `requestAnimationFrame()`과 visibility 관련 값을 켜는 옵션일 뿐이다. 이 옵션을 사용해도 layout/rendering 엔진이 생기지 않는다.
- subresource loading: 기본적으로 이미지, stylesheet, iframe, script를 로드하지 않는다. `resources: "usable"`을 켜도 이미지 로드는 `canvas` 패키지와 jsdom resource loader의 제약을 받는다.
- navigation: `window.location.href` 변경이나 link click이 새 `Window`/`Document` 생성으로 이어지지 않는다. URL 값만 바꾸는 테스트와 실제 페이지 전환 테스트를 구분한다.

이런 제약은 `tests/jsdom-limits/**`에 회귀 테스트로 박아둔다. 해당 테스트가 통과하면 제약이 그대로다. 실패한다면 jsdom이 해당 경로를 지원하기 시작했다는 신호이므로 위 정책과 마이그레이션 후보 목록을 재평가한다.
