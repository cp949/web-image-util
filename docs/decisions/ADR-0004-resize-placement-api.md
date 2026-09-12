# ADR-0004: resize placement(position 필드) API 설계

## 상태

Accepted (설계만 확정, 구현 미착수)

## 배경

- 로드맵 Track 1B. `cover`/`contain`의 배치가 지금은 무조건 중앙 정렬로 하드코딩돼 있다(`resize-calculator.internal.ts`의 `calculatePosition`이 `fit`이나 위치 옵션과 무관하게 항상 중앙 좌표를 계산). 특정 피사체를 강조하려면 별도 crop 계산이 필요했다.
- 설계 인터뷰(2026-09-12)로 어휘·좌표계·API 위치를 확정했다. 구현 전이라 저장소 안에 코드·테스트가 없으므로 값·오류 계약과 검증 기준을 이 ADR에 직접 둔다.

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
- 구현이 끝나면 이 ADR의 계약 절을 코드·테스트·README 출처 목록으로 바꾼다(ADR-0002/0003과 같은 형식).

## 값·오류 계약

| 조건 | 처리 |
| --- | --- |
| gravity 문자열이 9개 값 밖 | 오류. 코드는 구현 시 기존 `ImageProcessError` 코드 목록과 대조해 확정(가칭 `INVALID_GRAVITY`) |
| focal-point `x`/`y`가 `[0, 1]` 밖이고 `[-1e-6, 1+1e-6]`도 벗어남 | 오류(가칭 `INVALID_FOCAL_POINT`) |
| focal-point `x`/`y`가 `[-1e-6, 0)` 또는 `(1, 1+1e-6]` | 오류 아님. `0` 또는 `1`로 clamp 후 진행. epsilon `1e-6`은 내부 상수이며 옵션으로 노출하지 않는다 |
| `contain`의 `position`에 focal-point 객체가 런타임으로 들어옴(타입 우회) | 오류(가칭 `FOCAL_POINT_NOT_SUPPORTED`) |
| `position` 생략 | 오류 아님. 기존 중앙 배치와 동일 |

- 검증 시점은 `resize()` 호출 시점(기존 `validateResizeConfig`와 같은 지점).
- gravity 문자열도 focal-point 객체와 같은 엄격도로 검증한다.

## 검증 기준

- gravity 9방향 각각의 offset 계산값(경계 접촉, 중앙 정렬)
- focal-point 경계값(0, 1), 중간값, 한 축만 overflow, 양 축 overflow
- epsilon 경계: `-1e-7`/`1+1e-7`은 clamp 후 통과, `-1e-5`/`1.01`은 오류
- `contain` + focal-point 객체 오류, 잘못된 gravity 문자열 오류
- `position` 생략 시 기존 결과와 동일(회귀 없음)
- 렌더 1회 유지(`drawImage` spy), deprecated `resize.padding`과 동시 사용 시 available space 안에서 정상 동작
