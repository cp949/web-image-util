# ADR-0003: box() API 설계

## 상태

Accepted

## 배경

- 배경색 지정 개념이 `resize.background`, 죽은 `ProcessorOptions.defaultBackground`, 검토 중이던 `transform.background`·`flatten.background`까지 넷으로 흩어져 있었다.
- Sharp 검토의 `flatten()`과 Jimp 검토의 shape mask 제안을 대체할 단일 기능이 필요했다.
- 상세 설계는 설계 인터뷰로 확정했다. 이 ADR은 결정의 요약이다(영향 절 참조).

## 결정

1. `box({ padding, background, radius, border })` 단일 메서드로 배경·여백·모서리 둥글림·테두리를 CSS box model 어휘로 통일한다.
2. `box()`는 체인당 1회, 체인 위치 무관(resize 앞뒤 모두 가능)하지만 적용 순서는 항상 가장 바깥(transform → resize → box)으로 고정한다. 렌더 파이프라인 계층이 이 제약을 가드한다.
3. `radius`는 CSS `border-radius`와 동일 의미(축별 %, 비정사각형은 타원 모서리, 인접 반지름 합이 변 길이를 넘으면 CSS 규칙대로 축소). `border`는 `{ width, color, inset? }`이며 반투명 색을 허용한다.
4. 렌더 골격은 fill(background) → clip(radius) → drawImage 1회 → stroke(border) 순으로 고정한다. 중간 Canvas는 생성하지 않는다.
5. `resize.padding`/`resize.background`/`ProcessorOptions.defaultBackground`는 `@deprecated` 별칭으로 유지한다. `box()`와 동시 지정하면 `OPTION_INVALID`. 다음 메이저에서 제거한다.
6. `flatten()` 메서드는 도입하지 않는다(`box.background`가 대체). 별도 shape mask API도 두지 않는다(`radius: '50%'`가 원형 mask 역할을 한다).

## 근거

- 배경 개념이 여러 곳에 흩어지면 어느 옵션이 실제로 적용되는지 사용자가 예측하기 어렵다. 이미 익숙한 CSS box model 어휘로 통일해 학습 비용을 낮췄다.
- box()가 체인 위치와 무관하면서도 항상 최외곽에 적용되는 이유: 여러 옛 메커니즘(resize 안 padding/background)을 대체하는 기능이라 resize() 호출 순서에 종속되면 안 된다.

## 영향

- Chrome 75 하한선(ADR-0001) 준수: `ctx.roundRect()`(Chrome 99+) 대신 `ctx.ellipse()`(Chrome 48+)로 모서리 경로를 직접 구성한다.
- 알려진 미해결 이슈(의도적 보류): `radius` 없이 padding/border만 쓰고 소스 비율이 `resize({ fit: 'cover' })`와 다르면 리사이즈된 이미지가 padding/border 영역을 침범할 수 있다. 기존 `resize({ fit: 'cover', padding })` 경로도 같은 특성이라 회귀는 아니다. 픽셀 테스트 인프라가 갖춰지기 전까지는 손대지 않기로 확정했다.
- Track 1B(resize placement, ADR-0004)와는 직교한다 — box()는 resize 결과(content) 바깥에만 적용되므로 resize의 배치 옵션과 충돌하지 않는다.
- 공개 타입·호출 시점 검증, 바깥 상자 크기·radius·border 경로 기하 계산, 렌더 골격(fill → clip → `drawImage()` 1회 → stroke), 1회 가드와 deprecated 옵션 동시 지정 거부는 모두 코드베이스에 구현되어 있고 단위·통합·브라우저 테스트로 커버된다. 사용자 문서(README "박스" 절, CHANGELOG)도 갱신되어 있다.
