# ADR-0006: 프리셋(createThumbnail/createAvatar) 옵션 연동 정책

## 상태

Accepted

## 배경

- `ADR-0004`(resize placement) 결정 6은 `createThumbnail`/`createAvatar`에 `position` 연동을 v1 범위 밖으로 뒀다. 이후 별도 설계 인터뷰(2026-09-12)에서 실제로 두 프리셋에 `position`을 연동하기로 뒤집었고, 이미 구현·병합됐다 — 이 ADR이 그 결정을 문서화한다.
- 같은 시기, `ADR-0003`(box API)의 v1 비목표였던 `createAvatar()` radius 연동도 별도 설계 인터뷰(2026-09-12)로 확정했다.
- 두 사례가 같은 패턴이다: 저수준 기능(resize placement, box)은 먼저 출시하고, 프리셋에 얼마나 노출할지는 별도 라운드에서 결정한다. 하나의 정책 ADR로 통합해 세 번째 유사 사례가 나왔을 때 참조할 단일 문서를 만든다.

## 결정

1. `createThumbnail()`/`createAvatar()`가 `position`(gravity 9칸 문자열 또는 focal-point `{x, y}`)을 받는다. 타입은 `resize()`의 `ResizeGravity`/`ResizeFocalPoint`를 그대로 재사용한다. `createAvatar()`는 `fit: 'fill'`과 `position`을 함께 쓰면 `OPTION_INVALID`다(fill은 잘리는 영역이 없어 정렬이 무의미하기 때문 — 저수준 `resize()` 타입 자체에 이 조합을 표현할 필드가 없어 프리셋이 직접 가드한다).
2. `createAvatar()`가 `radius`(`box()`의 `BoxRadius`와 동일 타입: px 숫자 | `${number}%` | CSS 순서 4배열)를 받는다. `createThumbnail()`에는 연동하지 않는다(둥근 모서리 수요가 avatar에 집중돼 있고, thumbnail의 대표 유스케이스는 그런 수요가 확인되지 않았다).
3. 두 옵션 모두 생략 시 기존 동작(중앙 정렬, 사각형)을 그대로 유지한다. opt-in이며 기본 출력 결과를 바꾸지 않는다.
4. 프리셋 옵션은 항상 flat 필드로 노출한다. `box()`처럼 discriminated union으로 프리셋 API를 쪼개지 않는다 — "간단한 함수 호출"이 프리셋의 셀링포인트라는 기존 설계와 일관성을 맞춘다.
5. 값 검증은 가능한 한 저수준 API(`resize()`/`box()`)에 위임한다. 프리셋 레벨 가드는 "저수준 타입 자체에 그 조합을 표현할 필드가 없어 core가 조용히 무시하는 조합"에만 추가한다(결정 1의 `fit: 'fill'` + `position`이 유일한 사례).
6. `ADR-0004` 결정 6("프리셋 연동은 v1 범위 밖")은 이 ADR로 무효화한다. `ADR-0004`의 나머지 결정(position 필드 자체의 어휘·좌표계·검증 규칙)은 그대로 유효하다.

## 근거

- position과 radius 둘 다 "저수준 기능은 이미 완성돼 있고, 프리셋에 얼마나 노출할지"라는 같은 성격의 결정이다. 프리셋 옵션 연동에 공통 원칙(flat 필드, 검증 위임, opt-in 기본값)을 세워두면 다음 유사 확장에서 매번 처음부터 논의하지 않아도 된다.
- `createThumbnail()`에 radius를 연동하지 않은 이유: 확인된 수요 없이 미리 넣는 건 선제적 확장이고, 필요가 확인되면 같은 원칙으로 쉽게 추가할 수 있다.
- `ADR-0004`를 직접 고쳐 쓰지 않고 새 ADR로 무효화한 이유: "배경/결정/근거"는 그 시점 판단의 불변 기록으로 남긴다는 프로젝트 규칙(`docs/decisions/README.md`) 때문이다.

## 영향

- `ADR-0004`(resize placement)는 결정 6에 한해 이 ADR로 대체된다. 상태를 `Superseded by ADR-0006 (결정 6에 한함, 나머지 결정은 유효)`으로 표기했다.
- `ADR-0003`(box)과는 다른 계층이다 — box는 resize 결과 바깥에만 적용되므로 이 정책과 충돌하지 않는다.
- 이 결정이 건드리는 범위: 공개 옵션 필드, 값 검증 위임, `fit: 'fill'` + `position` 가드.
