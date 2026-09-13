# ADR-0008: SVG intake guard의 CSS 재검증 범위를 lightweight 엔진과 정렬

## 상태

Accepted

## 배경

- SVG 렌더 파이프라인은 sanitizer(엔진)와 그 이후에 도는 fail-closed 재검증(intake guard) 두 겹으로 방어한다. intake guard는 "엔진에 회귀가 생겨도 잔여 위험 참조를 막는다"는 명시적 backstop 계약을 갖고 있다.
- intake guard는 href/xlink:href/src 참조와 `style` 속성/`<style>` 태그만 재검증했고, lightweight 엔진이 실제로 정제하는 11종 presentation 속성(`fill`, `filter`, `mask` 등)의 CSS `url()` 참조는 재검증 대상 밖이었다 — 엔진의 정제 범위와 backstop의 재검증 범위가 서로 다르게 손으로 짜여 있었다.
- 같은 태그 순회 정규식이 두 파일에 문자 그대로 복제되어 있었고, 속성값 추출(따옴표 3종 처리) 로직도 축(href/style/presentation)마다 손으로 따로 짜여 최소 4벌 존재했다. 같은 종류의 손으로 짠 중복이 이미 한 번 실제 divergence 버그(속성명 경계값 판정 불일치)를 낸 전례가 strict 엔진 쪽에 있었고, 그 전례의 해법(판정 순서를 공유 함수 하나로 합치기)이 이번 대응의 모델이 됐다.
- 진단 API(`inspectSvg`)는 "intake guard가 거부할 것인가"를 예측하도록 설계되어 있고, 그 관계는 회귀 테스트로 고정되어 있다. presentation 속성 축에서는 진단도 guard와 마찬가지로 보고하지 않아 이 거울 관계가 (우연히) 유지되고 있었다. intake guard의 커버리지를 넓히자 이 회귀 테스트가 깨졌다.

## 결정

1. 태그 순회(시작 태그 찾기)와, 속성 이름 집합이 주어졌을 때 따옴표 3종(큰따옴표/작은따옴표/무인용)을 처리해 값을 추출하는 로직을 공유 모듈 하나로 뽑는다. lightweight 엔진과 intake guard 둘 다 이 모듈을 통해 태그·속성값을 얻는다.
2. intake guard가 재검증하는 속성 이름 집합에 lightweight/strict 엔진이 실제로 정제하는 11종 presentation 속성을 추가한다. href 축과 마찬가지로 이름 집합 상수를 엔진과 backstop이 공유해, 엔진의 정제 범위와 backstop의 재검증 범위가 앞으로 다시 벌어지지 않게 한다.
3. on* 이벤트 핸들러 판정은 이 공유 모듈에 포함하지 않는다 — 소비자별로 판정 폭이 의도적으로 다르다는 기존 설계(strict 엔진 쪽 판정 통합 사례)를 그대로 따른다.
4. 진단 API(`inspectSvg`)의 finding 축도 presentation 속성의 외부 `url()` 참조를 새 finding 코드(`presentation-attribute-external-url`)로 보고하도록 넓힌다 — "guard 거부를 예측한다"는 진단 API의 존재 이유를 지키기 위해서다. 진단 API가 이미 다루지 않던 "구문형 CSS 위협"(`@import`, `expression()`, `-moz-binding` 등 — presentation 속성 문법에 나타나지 않는 구문)은 범위 밖으로 그대로 둔다.

## 근거

- intake guard의 재검증 범위가 엔진의 정제 범위보다 좁은 것은 backstop 계약의 미이행이었다. 오늘 당장 뚫려 있는 취약점은 아니다(엔진이 이미 정확히 정제하므로) — 엔진 쪽에 미래 회귀가 생겼을 때의 방어선을 정렬하는 결정이다.
- 같은 종류의 손으로 짠 중복이 이미 한 번 실제 divergence 버그를 낸 전례가 있어, 재발 방지를 "이번만 고친다"가 아니라 공유 모듈로 못박는 쪽을 택했다.
- intake guard만 고치고 진단 API는 그대로 두는 대안도 검토했으나, 그러면 "진단이 guard 거부를 예측한다"는 이미 테스트로 고정된 계약이 깨진 채로 남는다 — 진단 API의 존재 이유 자체가 훼손되므로 함께 넓히는 쪽을 택했다.

## 영향

- SVG 렌더 파이프라인에서 sanitizer 이후 잔여 위험 참조를 막는 fail-closed 재검증을 소유하는 모듈의 재검증 범위가 넓어진다. 공개 sanitizer 옵션(`lightweight`/`strict`/`skip`)의 사용자 관찰 가능한 정제 결과는 바뀌지 않는다(순수 내부 리팩터 + backstop 강화).
- 진단 API(`inspectSvg`)의 공개 finding 코드 집합에 `presentation-attribute-external-url`이 추가된다. 기존 finding 코드의 의미는 바뀌지 않는다.
- `inspectSvgSanitization()`의 stage 보고는 바뀌지 않는다 — presentation 속성은 이미 `style`과 같은 stage로 보고되고 있었다.
