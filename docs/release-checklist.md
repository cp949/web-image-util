# Release Checklist

버전 업데이트와 npm 배포 전에 문서와 실제 패키지 상태가 어긋나지 않도록 확인하는 체크리스트다.

## 버전 동기화

새 버전으로 올릴 때 다음 위치를 같은 버전으로 맞춘다.

- `sub/web-image-util/package.json`의 `version`
- 루트 `README.md`의 `현재 배포 준비 버전`
- `sub/web-image-util/README.md`의 `현재 배포 준비 버전`
- 루트 `CLAUDE.md`의 `현재 배포 준비 버전`
- `sub/web-image-util/CLAUDE.md`의 `현재 배포 준비 버전`

버전 문자열을 바꾼 뒤 아래 명령으로 누락된 이전 버전이 없는지 확인한다.

```bash
rg -n "2\\.0\\.[0-9]+" README.md sub/web-image-util/README.md CLAUDE.md sub/web-image-util/CLAUDE.md sub/web-image-util/package.json
```

## 배포 메모

사용자에게 의미 있는 변경이 있으면 루트 `README.md`와 `sub/web-image-util/README.md`의 `배포 메모`에 같은 버전 섹션을 추가한다.

배포 메모에는 구현 세부보다 사용자가 알아야 할 API 변경, 공개 export 변화, 검증 범위, 호환성 변경을 우선 적는다.

## 스크립트와 문서 동기화

명령어 문서를 수정하거나 `package.json` scripts를 바꿨다면 실제 스크립트와 문서가 같은지 확인한다.

```bash
node -p "Object.keys(require('./package.json').scripts).sort().join('\n')"
node -p "Object.keys(require('./sub/web-image-util/package.json').scripts).sort().join('\n')"
rg -n "pnpm (ci|verify:ci|verify:release|publish:npm|test:scripts|test:coverage|test:browser|test:contract)" README.md CLAUDE.md sub/web-image-util/README.md sub/web-image-util/CLAUDE.md
```

현재 루트 CI 성격의 기본 검증 명령은 `pnpm verify:ci`다. `verify:ci`는 루트 운영 스크립트 테스트인 `pnpm test:scripts`를 먼저 실행한 뒤 Turbo 기반 타입체크, lint, format 검사, Node 테스트, 계약 테스트를 실행한다. 릴리스 전 필수 검증 명령은 `pnpm verify:release`이며, `verify:ci`, browser smoke test, npm pack dry-run을 함께 실행한다. `test:coverage`는 별도 점검 경로이며, `verify:ci`에 포함하기로 결정한 경우에만 문서의 coverage 설명을 바꾼다.

루트 운영 스크립트 테스트는 `tests/unit/scripts/**`에 둔다. `sub/web-image-util/tests/**`는 패키지 라이브러리 테스트를 담당하므로, 루트 `scripts/**`의 테스트를 패키지 내부로 되돌리지 않는다.

## 구조 설명 동기화

아키텍처 문서에서 파일명이나 클래스명을 언급할 때는 실제 파일 존재 여부를 확인한다.

```bash
rg -n "pipeline\\.ts|RenderPipeline|LazyRenderPipeline|lazy-render-pipeline" README.md CLAUDE.md sub/web-image-util/README.md sub/web-image-util/CLAUDE.md
rg --files sub/web-image-util/src/core
```

현재 메인 처리 구조는 `core/lazy-render-pipeline.ts`의 `LazyRenderPipeline`, `core/single-renderer.ts`, `core/onehot-renderer.ts` 중심이다. 과거의 `pipeline.ts`/`RenderPipeline` 설명을 되살리지 않는다.

## 생성 산출물

공개 API, README, 유틸리티 export가 바뀌면 `llm.txt`도 최신 상태여야 한다. 운영 기준은 [llm.txt 운영 가이드](llm-txt.md)를 따른다. `pnpm build`는 `sub/web-image-util/scripts/generate-llm-txt.mjs`를 실행한다.

```bash
pnpm build
git diff -- sub/web-image-util/llm.txt
```

`llm.txt`가 변경되었다면 새 API 설명이 의도대로 반영됐는지 확인한다.

## 배포 전 검증

최소 검증:

```bash
pnpm verify:release
pnpm test:package-subpath
pnpm --filter @cp949/web-image-util package
```

변경 범위에 따라 추가 검증:

```bash
pnpm --filter @cp949/web-image-util test:coverage
pnpm --filter @cp949/web-image-util test:security
```

`test:coverage`가 실패하는 상태에서 배포해야 한다면, 실패 이유와 배포 판단을 릴리스 메모에 명시한다.

## 최종 검색

배포 직전에는 오래된 버전, 없어진 구조, 잘못된 명령이 남아 있지 않은지 검색한다.

```bash
rg -n "2\\.0\\.이전버전|pipeline\\.ts|(^|[^A-Za-z])RenderPipeline([^A-Za-z]|$)|pnpm ci|coverage 목표" README.md CLAUDE.md sub/web-image-util/README.md sub/web-image-util/CLAUDE.md docs
```

검색 결과가 의도된 문맥인지 직접 읽고 확인한다.
