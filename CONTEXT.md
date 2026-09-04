# web-image-util

브라우저 Canvas 2D 위에서 이미지 변환 체이닝 API를 제공하는 라이브러리의 도메인 용어집.

## Language

### Canvas 소유권

**Canvas 임대 (lease)**:
Canvas Pool에서 빌린 canvas의 한시적 사용권. 소비(consume) 또는 소유권 이전(detach)으로만 끝난다. 임대 중인 canvas는 라이브러리 밖으로 나가지 않는다.
_Avoid_: managed canvas, pooled canvas 공유

**소비 (consume)**:
임대 canvas에서 파생물(Blob, Data URL 등)을 만든 뒤 canvas를 pool로 돌려보내는 임대 종료 방식. 파생물 생성이 실패해도 canvas는 pool로 돌아간다.
_Avoid_: release 후 사용

**소유권 이전 (detach)**:
임대를 끝내고 canvas를 호출자 소유로 만드는 종료 방식. canvas는 pool로 돌아가지 않으며, 이후 수명은 호출자 책임이다. `toCanvas()` 계열 출력이 이 방식을 쓴다.
_Avoid_: 반환 생략, no-release

**소유 canvas (owned canvas)**:
처음부터 호출자 소유로 생성되어 pool과 무관한 canvas. 결과 canvas를 호출자에게 직접 반환하는 경로(합성, 고해상도 처리)가 사용한다.
_Avoid_: 임시 canvas, 신규 canvas

### SVG 보안

**위협 정책 (threat policy)**:
SVG에서 무엇이 위험한 참조·요소·속성인가에 대한 판정 규칙의 단일 소유자. 경량·strict 두 집행 엔진과 진단, intake guard는 모두 이 정책의 소비자다.
_Avoid_: sanitizer 규칙, 보안 필터

**집행 엔진 (enforcement engine)**:
위협 정책을 SVG 문서에 적용해 위험 요소를 실제로 제거하는 메커니즘. 무엇이 위험한가는 정의하지 않고 어떻게 제거하는가만 담당한다.
_Avoid_: sanitizer 본체, 정화 로직

**참조 속성 (reference attribute)**:
SVG attribute 하나가 다른 요소·외부 자원에 대한 참조를 담는지 여부 — lowered 이름과 namespace 분리 후의 localName 양쪽으로 판정해 임의 prefix로 선언된 `xlink:href`(예: `xl:href`)도 잡는다. "그 참조가 위협인가"를 다루는 참조 판정보다 한 단계 앞선 구조적 사실이고, 판정 자체와는 무관하다. `svg-reference-attribute.internal.ts` 하나가 소유하며 strict 집행 엔진과 그 입력 진단, `svg-inspection` 신호 수집기, `prefix-svg-ids`, `svg-optimizer`가 공유한다.
_Avoid_: href 체크, xlink 속성 검사

**참조 판정 (uri ref verdict)**:
SVG 참조 하나가 위협인지와 그 근거를 함께 돌려주는 단일 판정. 위협 여부이지 허용 여부가 아니다 — 빈 참조는 위협이 아니지만 집행 엔진은 제거한다. 집행 엔진·진단 수집기·intake guard는 같은 판정을 받고 자기 동작만 고른다.
_Avoid_: URI 검사, 참조 필터

**이유 코드 (reason code)**:
참조 판정이 갈린 근거를 나타내는 닫힌 집합. 소비자별 동작 차이는 이 코드에 대한 매핑으로만 표현한다. 같은 판정에서 제거·거부·집계가 갈리되 답 자체는 갈리지 않는다.
_Avoid_: 판정 사유, 에러 코드

### 원격 본문

**원격 본문 가드 (remote body guard)**:
원격 응답 본문을 읽는 모든 경로가 통과하는 단일 seam. byte 상한, abort/타임아웃 결합, 스트림 취소, 오류 코드 주입을 소유한다. 본문을 읽는 새 경로는 이 seam 밖에 스트림 루프를 만들지 않는다.
_Avoid_: fetch 래퍼, 응답 헬퍼

**거부 읽기 (rejecting read)**:
누적 바이트가 상한을 넘으면 스트림을 취소하고 오류를 던지는 읽기 방식. 본문 전체가 필요한 경로가 쓴다.
_Avoid_: 크기 검사

**절단 읽기 (truncating read)**:
상한까지만 읽고 스트림을 취소하되 초과를 오류로 올리지 않는 읽기 방식. 앞부분 바이트만 필요한 스니핑 경로가 쓴다. 스트림이 없어 절단할 수 없는 응답은 빈 결과로 수렴하며, 본문 전체를 메모리에 올린 뒤 자르지 않는다.
_Avoid_: prefix 읽기, 부분 읽기

### 바이트 시그니처 판정

**바이트 시그니처 판정 (byte signature detection)**:
매직바이트만으로 이미지 포맷을 판정하는 동작. MIME이나 파일명 같은 부가 힌트는 보지 않는다. 판정 표는 `detectFormatFromBytes()` 하나가 소유하며, bmp/tiff/ico처럼 공개 `ImageFormat`이 표현 못 하는 값을 `unknown`으로 접을지는 소비자가 정한다.
_Avoid_: 매직바이트 검사, 포맷 스니핑

### 이미지 디코드

**이미지 디코드 (image decode)**:
소스를 `HTMLImageElement`에 붙여 로드 완료 상태까지 만드는 동작. img 생성, `src` 할당 전 속성 설정, objectURL 수명, 실패의 도메인 오류 래핑을 단일 모듈이 소유한다. 새 호출처는 img에 직접 핸들러를 등록하지 않는다.
_Avoid_: 이미지 로딩, img 로더

**디코드 어댑터 (decode adapter)**:
img를 로드 완료 상태까지 구동하는 방식만 갈라내는 seam. 핸들러 등록·해제와 `src` 할당을 담당하고, 오류 코드·메시지 조립에는 관여하지 않는다. 테스트가 실제 디코딩 없이 호출처를 구동할 때 교체한다.
_Avoid_: 이미지 mock, 디코드 스텁 전역

### 배치와 일괄

**배치 (placement)**:
Canvas에 객체 하나 또는 반복 타일의 draw 원점을 정하고 회전 상태의 수명을 관리하는 동작.
Position/margin 기반 단일 배치와 spacing/stagger 기반 반복 배치는 `placement.internal.ts`가 소유한다.
반복 배치의 frame 회전과 per-tile 회전은 서로 다른 표현이며, 호출자가 모드를 명시한다.
_Avoid_: 워터마크 좌표 루프, 타일 위치 계산

**워터마크 콘텐츠 렌더 (watermark content render)**:
스타일 적용 → 크기 측정 → 배치 호출 → draw를 하나의 canvas 상태 범위 안에서 실행하는 골격. 배치(위치·회전)는 다루지 않고, 그 앞단 — 스타일이 측정보다 먼저 실행돼야 한다는 순서 제약 — 만 소유한다. `watermark-content.internal.ts`의 `WatermarkContentAdapter`(`prepare`/`draw` 2훅)가 단일 소유하며, `TextWatermark`·`ImageWatermark`는 콘텐츠별 준비·그리기만 채워 넣는 adapter다.
_Avoid_: 워터마크 렌더러, 그리기 헬퍼

**일괄 (batch)**:
여러 입력이나 누적된 연산을 한 묶음으로 모아 한 번에 실행하는 동작. 체이닝으로 쌓인 연산을 최종
출력 시점에 단일 `drawImage()`로 실행하는 것과 `BatchResizer`·`batchSmartResize` 계열의 다중 이미지
처리가 여기 속한다. 한국어 「배치」는 placement 전용이므로 batch 의미로 쓰지 않는다.
_Avoid_: 배치 렌더링, 배치 처리, 벌크

### 메모리 예산

**메모리 예산 (memory budget)**:
`performance.memory` 기반 현재 메모리 상태 — 사용량, 한도, 여유, 압력(0~1 비율)을 함께 담는다. `readMemoryBudget()` 하나가 단일 소유하며, 측정 불가 환경(비 Chromium, SSR, jsdom)의 fallback도 이 모듈이 소유하는 단일 값이다. 소비자별 임계값(풀 크기, 압박 버킷, GC 트리거 시점)은 예산이 아니라 소비자의 정책이다.
_Avoid_: 메모리 정보, 메모리 상태 조회
