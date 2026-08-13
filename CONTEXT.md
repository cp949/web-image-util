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
