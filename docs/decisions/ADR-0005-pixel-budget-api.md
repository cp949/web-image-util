# ADR-0005: input/output pixel budget API 설계

## 상태

Accepted

## 배경

- 로드맵 Track 0. 압축 바이트 크기 제한(`maxSourceBytes`)만으로는 디코드된 이미지의 총 픽셀 수나 최종 출력 Canvas 크기를 제어할 수 없다. 메인 resize/render 경로는 지금 초대형 Canvas를 경고만 남기고 항상 성공시킨다.
- 설계 인터뷰로 계약을 확정했다. 이 ADR은 결정의 요약이다.

## 결정

1. `ProcessorOptions`에 `maxInputPixels`/`maxOutputPixels`를 opt-in 필드로 추가한다. 기본값은 둘 다 `undefined`(무제한) — 지정하지 않은 기존 호출자의 동작은 완전히 그대로 유지된다.
2. `maxInputPixels`는 `convertToImageElement()` 완료 직후 `naturalWidth × naturalHeight`로 검사한다. 소스 타입 무관 — SVG도 항상 자기 선언 크기로 디코드되므로 별도 분기가 없다.
3. PNG/GIF/BMP(고정 오프셋 헤더)에 한해 디코드 전 헤더 사전 검사를 추가로 시도한다(`maxInputPixels` 지정 시에만, fail-open). JPEG/WebP처럼 세그먼트 스캔이 필요한 포맷은 v1 범위 밖으로 미룬다.
4. `maxOutputPixels`는 `calculateFinalLayout()`의 `canvasSize` 계산 직후, Canvas pool 획득 전에 검사한다.
5. 신규 픽셀/축 길이 예산 검사 모듈이 입력/출력 픽셀 수 검사와, 기존 축별 하드 거부 경로·면적 경고 경로의 축 길이 검사 코드를 공유해 소유한다 — 단 두 기존 경로의 동작은 각각 그대로 보존한다(메인 resize 체인에 새 하드 제약을 추가하지 않는다).
6. `maxSourceBytes`(바이트 한도, 원격 fetch 스트림에 얽힌 보안 코드)는 이 모듈이 흡수하지 않는다. "단일 정책 소유"는 축 길이·픽셀 수 두 축에만 적용한다.
7. 위반 시 신규 error code `PIXEL_BUDGET_EXCEEDED` 하나를 던진다. `details.direction`(`'input' | 'output'`)과 `details.stage`(입력만, `'header' | 'decoded'`)로 구분한다. 기존 `DIMENSION_TOO_LARGE`(축 길이 전용)는 재사용하지 않는다.

## 근거

- opt-in인 이유: 브라우저 SDK 특성상 몰래 새 에러가 튀어나오면 라이브러리 사용자의 페이지에서 조용히 깨진다. `maxSourceBytes`의 기본값(100MiB)은 "원격 다운로드 안전"이라는 이미 있던 위험에 대한 방어라 기본값이 정당했지만, pixel budget은 이번에 신설하는 안전장치라 옵트인으로 시작하는 편이 안전하다.
- 파사드 통합인 이유: 원격 SVG/이미지 fetch를 다루는 가드는 보안 코드라 물리적 이동은 검증 부담과 회귀 위험이 크다. "단일 정책 소유"의 실질은 "한 곳에서 결정하고 다른 곳이 임의로 새 한도를 만들지 않는다"는 것이지, 이미 검증된 보안 코드를 재배치해야 한다는 뜻은 아니다.
- 메인 체인의 경고-only 정책을 유지하는 이유: 그 정책은 메인 렌더 경로 안에서 이미 의도적으로 내려진 결정이다("초대형 canvas는 오류 대신 경고만"). 이번 Track의 목적은 opt-in 픽셀 예산을 신설하는 것이지 기존 기본 동작을 조용히 바꾸는 것이 아니다.
- 헤더 사전 검사를 PNG/GIF/BMP로 한정한 이유: 사후 검사(`naturalWidth × naturalHeight`)는 브라우저가 이미 디코드를 마친 뒤에야 작동해 디코드 자체의 메모리 스파이크를 막지 못한다. 고정 오프셋 헤더만 스캔 없이 저비용으로 미리 읽을 수 있다. JPEG/WebP까지 포함한 완전한 포맷별 파서는 로드맵의 기존 비목표("모든 포맷의 완전한 metadata parser 구현")와 충돌한다.
- `PIXEL_BUDGET_EXCEEDED` 코드 하나로 통일한 이유: `SOURCE_BYTES_EXCEEDED`가 이미 "코드 하나 + 구분 필드(`label`)" 관례를 세워뒀다. 방향별로 코드를 늘리지 않고 그 관례를 따른다.

## 영향

- ADR-0004(resize placement)와는 직교 — resize placement는 배치를, 이 ADR은 크기 상한을 다룬다.
- 로드맵 Track 2(normalize/threshold) 이후 모든 신규 Canvas·분석 기능의 선행 조건이다.
- 공개 타입·오류 코드, 픽셀/축 길이 예산 검사를 소유하는 모듈, 헤더 사전 검사 파서, source-converter·출력 파이프라인·렌더 계층으로의 배선은 모두 코드베이스에 구현되어 있고 단위·통합 테스트로 커버된다. 사용자 문서(README "픽셀 예산" 절, CHANGELOG)도 갱신되어 있다.
