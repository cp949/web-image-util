# llm.txt 자동 생성 설계

## 목표

`@cp949/web-image-util` 패키지의 최종 배포 산출물에 `llm.txt`를 포함한다.
생성은 외부 LLM 호출 없이 저장소 내부 규칙 기반 스크립트로 수행한다.

## 설계

- 입력 원천은 `sub/web-image-util/dist/*.d.ts`와 `sub/web-image-util/README.md`다.
- `llm.txt` 생성 스크립트는 빌드가 끝난 뒤 실행한다.
- 스크립트는 TypeScript declaration 파일에서 핵심 public API 시그니처를 추출한다.
- 출력 형식은 `_works/llm_txt-생성-프롬프트.md`의 구조를 따른다.
- 결과 파일은 `sub/web-image-util/llm.txt`로 기록하고 npm 배포 파일 목록에 포함한다.

## 구현 범위

- `dist/*.d.ts`를 읽는 deterministic 생성 스크립트 추가
- 생성 규칙을 검증하는 테스트 추가
- `build` 또는 `package` 스크립트에서 자동 실행되도록 연결
- `files` 필드에 `llm.txt` 추가

## 제약

- internal/private API는 포함하지 않는다.
- 출력은 같은 입력에 대해 항상 동일해야 한다.
- README는 설명 보조용으로만 사용하고, API 시그니처는 `.d.ts`를 기준으로 한다.
