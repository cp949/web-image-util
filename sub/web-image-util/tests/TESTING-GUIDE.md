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

## 테스트 이름과 주석

- `describe`, `it`, `test` 제목은 한국어로 작성하고 요구사항이 드러나게 쓴다.
- 주석은 구현을 읽어주는 설명보다 테스트의 의도, 회귀 맥락, mock 신뢰 경계를 설명할 때만 단정하게 작성한다.
- 기존 영문 제목은 관련 파일을 건드릴 때 함께 한국어로 정리한다.

## Helper 사용

- 이미지 입력은 `tests/utils/image-helper.ts`와 `tests/utils/canvas-helper.ts`의 fixture를 우선 사용한다.
- SVG 입력은 `tests/utils/svg-fixtures.ts` 또는 테스트 파일 안의 작은 fixture를 사용한다.
- 여러 파일에서 반복되는 mock fetch, canvas, Blob 생성 로직은 `tests/utils/**`로 옮긴다.

## Node mock 신뢰 경계

`tests/setup/README.md`의 mock 신뢰 경계를 따른다. Node/happy-dom 테스트는 실제 픽셀 품질이나 브라우저별 인코딩 동작을 보장하지 않는다. 그런 검증은 browser 테스트로 올린다.

