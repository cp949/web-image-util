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
