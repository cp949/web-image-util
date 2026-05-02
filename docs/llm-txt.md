# llm.txt 운영 가이드

`llm.txt`는 `@cp949/web-image-util` 패키지에 포함되는 LLM용 공개 API 인덱스다. 패키지 사용자가 라이브러리의 주요 API와 사용 흐름을 빠르게 파악할 수 있도록 배포 산출물에 함께 포함한다.

## 생성 방식

`sub/web-image-util` 패키지의 `build` 스크립트는 TypeScript 번들 생성 후 `sub/web-image-util/scripts/generate-llm-txt.mjs`를 실행한다.

```bash
pnpm build
```

생성 스크립트는 아래 입력을 기준으로 `sub/web-image-util/llm.txt`를 갱신한다.

- `sub/web-image-util/dist/*.d.ts`
- `sub/web-image-util/README.md`

API 시그니처는 declaration 파일을 기준으로 추출한다. README는 설명 보조 입력으로만 사용한다.

## 배포 전 확인

공개 API, README, 유틸리티 export, 패키지 export 구성이 바뀌면 `llm.txt`도 최신 상태인지 확인한다.

```bash
pnpm build
git diff -- sub/web-image-util/llm.txt
```

`llm.txt`가 변경되었다면 다음을 확인한다.

- 새 공개 API가 누락되지 않았는가
- 제거되었거나 비공개인 API가 남아 있지 않은가
- 설명이 현재 README와 어긋나지 않는가
- 출력이 같은 입력에 대해 안정적으로 재생성되는가

## 배포 포함 정책

`sub/web-image-util/package.json`의 `files` 목록은 `llm.txt`를 포함해야 한다. 배포 전 `pnpm verify:release`의 `npm pack --dry-run` 결과에서 `llm.txt`가 tarball contents에 포함되는지 확인한다.

## 유지보수 원칙

- internal/private API는 포함하지 않는다.
- 공개 API 목록은 실제 `.d.ts` 산출물을 기준으로 한다.
- 생성 스크립트는 외부 LLM 호출 없이 저장소 내부 입력만 사용한다.
- 출력 형식이나 포함 기준을 바꾸면 생성기 테스트와 이 문서를 함께 갱신한다.
