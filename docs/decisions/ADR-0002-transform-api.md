# ADR-0002: transform() API 설계

## 상태

Accepted

## 배경

- 로드맵 Track 1. crop/flip/rotate를 Sharp처럼 개별 메서드(`rotate()`, `flip()`, `flop()`, `extract()`, `affine()`)로 흩어놓지 않고 단일 렌더 파이프라인에 결합해야 했다.
- 상세 설계는 설계 인터뷰로 확정했다. 이 ADR은 결정의 요약이다(영향 절 참조).

## 결정

1. `processImage(source).transform({ crop, flip, rotate })` — 체인당 1회, `resize()` 앞에서만 호출 가능하다. 렌더 파이프라인 계층이 이 제약을 가드한다.
2. 연산 순서는 crop → flip → rotate → resize로 고정한다. 옵션 객체 작성 순서와 무관하다.
3. crop 좌표는 원본 픽셀 기준(`getImageDimensions()` 보고값)이다. 원본을 벗어나도 되며 밖은 투명 처리한다.
4. `rotate: number | { degrees; expand?: boolean }`, `expand` 기본값 `true`. `false`면 입력 프레임을 유지하고 모서리가 잘린다.
5. `transform()`에는 `background` 옵션이 없다. 배경 지정은 `box()`(ADR-0003) 하나로 통일한다.
6. crop/flip/rotate 기하를 변환 행렬로 합성해 최종 `drawImage()` 1회로 렌더한다. 중간 Canvas는 생성하지 않는다.

## 근거

- Sharp 호환 메서드 표면 복제는 로드맵 비목표다. 개별 메서드 대신 단일 `transform()`을 채택해 API 표면을 좁혔다.
- `background`를 transform에도 두면 box()의 배경 개념과 두 곳으로 갈라져 어느 쪽이 실제로 적용되는지 사용자가 예측하기 어렵다 — 배경 개념은 하나로 통일한다(ADR-0003).
- 원본 픽셀 좌표계는 "정확한 절대 좌표로 잘라내기"라는 crop의 요구사항에 맞다. 이후 resize placement(ADR-0004)의 focal-point가 정규화 좌표를 쓰는 것과는 목적이 달라 의도적으로 다르다.

## 영향

- Track 3(box, ADR-0003)의 배경 개념은 transform에 `background`가 없다는 전제 위에서 설계됐다.
- Track 1B(resize placement, ADR-0004)의 focal-point 좌표계 논의에서 crop의 원본 픽셀 좌표계가 비교 대상(반례)으로 쓰였다.
- 공개 타입·호출 시점 검증, crop/회전 기하 계산, 렌더 골격(변환 행렬 합성 + `drawImage()` 1회), 1회·resize 앞 가드는 모두 코드베이스에 구현되어 있고 단위·통합·브라우저 테스트로 커버된다. 사용자 문서(README "변환" 절, CHANGELOG)도 갱신되어 있다.
