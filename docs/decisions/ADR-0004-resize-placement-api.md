# ADR-0004: resize placement(position 필드) API 설계

## 상태

Accepted (설계만 확정, 구현 미착수)

## 배경

- 로드맵 Track 1B. `cover`/`contain`의 배치가 지금은 무조건 중앙 정렬로 하드코딩돼 있다(`resize-calculator.internal.ts`의 `calculatePosition`이 `fit`이나 위치 옵션과 무관하게 항상 중앙 좌표를 계산). 특정 피사체를 강조하려면 별도 crop 계산이 필요했다.
- grilling 인터뷰(2026-09-12)로 어휘·좌표계·API 위치를 확정했다. 전체 계약·오류 코드·결정 로그는 `_works/resize-placement/decisions.md`(로컬 전용, git 미추적)에 있다 — 이 ADR은 요약이다.

## 결정

1. gravity(9칸 문자열)와 focal-point(`{x, y}`, 0~1 정규화)를 `resize()`의 `position` 필드 하나로 표현한다. `cover`는 둘 다 받고, `contain`은 gravity만 받는다(`contain`은 전체를 자르지 않아 focal-point의 존재 이유가 없다).
2. gravity 값 집합은 `composition/`의 `SimplePosition`(9칸, `custom` 없음, `center` 표기)과 동일하지만, `types/resize-config.ts`에 독립 타입(`ResizeGravity`)으로 재정의한다. `composition/`을 import하지 않는다 — core 타입 모듈이 부수 기능 모듈에 의존하는 역방향 결합을 피한다.
3. `fill`/`maxFit`/`minFit`/`scale`은 offset이 구조적으로 항상 0이라 `position` 필드 자체를 두지 않는다.
4. focal-point 좌표계는 0~1 정규화다. transform crop의 원본 픽셀 좌표계(ADR-0002)와 의도적으로 다르다 — crop은 절대 좌표 지정이 목적이고 focal-point는 소스 크기와 무관하게 재사용 가능한 상대적 지점 지정이 목적이다.
5. 값 검증은 엄격하게 한다: 잘못된 gravity 문자열, 범위 밖 focal-point, `contain`에 focal-point 객체를 잘못 전달하는 경우 모두 오류로 거부한다. 단 focal-point는 `±1e-6` 이내 오차를 부동소수점 노이즈로 보고 `0`/`1`로 clamp한 뒤 통과시킨다.
6. `createThumbnail`/`createAvatar` 프리셋 연동은 이번 v1 범위 밖이다(box() 출시 때와 동일 판단).

## 근거

- 별도 메서드 대신 `resize()` 필드로 둔 이유: gravity/focal-point는 cover/contain의 offset 계산에 내재된 값이라 체인 위치 독립성이 필요 없다. box()(ADR-0003)가 분리된 이유("여러 옛 메커니즘 통합 + 항상 최외곽 적용")가 여기엔 해당하지 않는다.
- `SimplePosition` 값 재사용 + 독립 타입 선언: 라이브러리 전체에서 "박스 안 배치"라는 개념의 어휘를 통일하면서도, `types/`가 `composition/`에 의존하는 역방향 결합은 만들지 않는다.

## 영향

- 구현 미착수. 구현 계획서는 별도 세션에서 작성한다.
- ADR-0002(transform)와는 좌표계 논의에서 서로 참조된다. ADR-0003(box)과는 직교한다 — box는 resize 결과 바깥에만 적용된다.
- 상세 계약(오류 코드, 검증 기준, 결정 로그 Q1~Q13)은 `_works/resize-placement/decisions.md`에 있다. 이 파일은 gitignore 대상이라 로컬 작업 환경에서만 확인 가능하다.
