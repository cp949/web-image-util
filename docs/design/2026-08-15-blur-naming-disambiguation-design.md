# blur 이름 충돌 문서화 설계

## 배경

메인 체이닝 API의 `.blur()`(`src/processor.ts:145`)와 `/advanced`·`/filters`의 `BlurFilterPlugin`(`src/filters/plugins/blur-plugins.ts:79-178`)은 이름만 같고 서로 무관한 독립 구현이다.

- `.blur(radius, options)` → `OutputPipeline.addBlur()`(`src/core/output-pipeline.internal.ts:110`) → `LazyRenderPipeline.addBlur()`(`src/core/lazy-render-pipeline.internal.ts:54`)가 연산을 누적. 최종 출력 시점에 `single-renderer.internal.ts`의 `analyzeBlurOperation()`(97-99행)이 `blur(${radius}px)` CSS 문자열을 `layout.filters`에 push하고, `renderLayout()`(115-160행)이 `ctx.filter = layout.filters.join(' ')`를 설정한 뒤 단 한 번의 `ctx.drawImage()`(149행)로 렌더링한다. 네이티브 CSS Canvas filter이며 별도 픽셀 순회가 없다.
- `BlurFilterPlugin`(`name: 'blur'`, `blur-plugins.ts:79-178`)은 수평/수직 2-pass Gaussian 컨볼루션을 직접 픽셀 단위로 계산하는 독립 구현이다. `AdvancedImageProcessor`(`src/core/advanced-processor.ts:87`)가 `options.filters`(`FilterChain`)를 받아 `applyFilterChain()`(134-155행)으로 실행하며, 사용자는 `{ name: 'blur', params: { radius } }` 형태로 이 문자열 키를 직접 지정한다.

두 구현은 이름뿐 아니라 **호출 방식도 같은 문자열("blur")을 쓴다** — `.blur(2)`와 `applyFilterChain(imageData, { filters: [{ name: 'blur', params: { radius: 2 } }] })`는 코드만 보면 구분이 안 된다. `BlurFilterPlugin`/`BlurFilterPlugins`는 `src/filters/plugins/index.ts` → `src/advanced-index.ts`(`export * from './filters/plugins'`)를 거쳐 `/advanced`·`/filters` 양쪽에서 공개 export된다.

카드가 제시한 두 대안(export 개명 vs 문서 상호 참조) 중 **문서 상호 참조만** 진행한다 — export 개명은 `/advanced`·`/filters` 소비자 대상 breaking change이고, 이 카드는 리뷰 문서에서 유일하게 "Speculative"(최하위 확신도) 등급이라 breaking cost를 정당화할 근거가 약하다.

## 결정

코드는 바꾸지 않는다. `docs/architecture.md`와 `sub/web-image-util/README.md`에 두 blur 구현이 이름만 같고 무관하다는 사실을 각각의 기존 서술 지점에 추가한다 — 새 섹션을 만들지 않고, 이미 있는 "아키텍처 불변조건"·"핵심 모듈" 표·서브패스 표에 끼워 넣어 별도로 찾아야 하는 문서를 늘리지 않는다.

## 변경 상세

### `docs/architecture.md`

**1. "아키텍처 불변조건" 섹션(25-35행)** — `blur()`를 언급하는 기존 불변조건 바로 다음에 새 항목을 추가한다.

```diff
 - `resize()`, `blur()` 같은 체이닝 메서드는 Canvas에 즉시 그리지 않고 연산만 누적합니다.
+- 체이닝 API의 `blur()`(CSS `ctx.filter`, `single-renderer.internal.ts`)와 `/filters`·`/advanced`의 `BlurFilterPlugin`(픽셀 컨볼루션, `src/filters/plugins/blur-plugins.ts`)은 이름만 같고 무관한 별도 구현입니다 — 병합 대상이 아닙니다.
 - 한 체인에서 `resize()`는 한 번만 허용합니다. ...
```

**2. "핵심 모듈" 표(47-80행)** — `src/core/single-renderer.internal.ts` 행(75행) 바로 다음에 두 행을 추가한다. 이 표에 `src/filters/*` 항목이 하나도 없어 필터 플러그인 시스템 자체가 현재 문서에 등장하지 않는다.

```diff
 | `src/core/single-renderer.internal.ts` | 누적 연산 분석(`analyzeAllOperations`)과 최종 Canvas drawImage 렌더링(`renderLayout` → `CanvasLease`) |
+| `src/filters/plugin-system.ts` | 필터 플러그인 레지스트리·실행 — `registerFilter`/`applyFilter`/`applyFilterChain`/`validateFilterChain`. `/advanced`·`/filters`(재노출) 전용, 메인 체이닝 파이프라인과는 별개 시스템 |
+| `src/filters/plugins/blur-plugins.ts` | `BlurFilterPlugin`(`name: 'blur'`)·`SharpenFilterPlugin`·`EmbossFilterPlugin`·`EdgeDetectionFilterPlugin` — 2-pass Gaussian 컨볼루션 등 픽셀 단위 구현. 체이닝 API의 `blur()`(CSS `ctx.filter`, 위 `single-renderer.internal.ts` 행)와 이름만 같고 서로 무관하다 |
 | `src/base/high-res-detector.internal.ts` | ... |
```

### `sub/web-image-util/README.md`

**서브패스 import 경로 표 바로 아래** — 기존에 있는 "서브패스 책임 경계는 ... 참고하세요." 문장 다음에 한 문장을 추가한다.

```diff
 서브패스 책임 경계와 책임 분리는 [Architecture 문서의 공개 API 표면](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md#공개-api-표면) 표를, sanitizer 관련 옵션의 사용 가능/금지 시나리오는 [SVG sanitizer 보안 정책의 "금지 사용처"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#금지-사용처) 표를 참고하세요.
+
+`.blur()`(메인 체이닝 API)와 `/filters`의 `BlurFilterPlugin`은 이름만 같고 무관한 별도 구현입니다 — 전자는 CSS `ctx.filter` 기반 네이티브 블러(단일 `drawImage()`에 녹아듦), 후자는 `/advanced`·`/filters` 전용 2-pass Gaussian 픽셀 컨볼루션입니다. 내부 구조는 [Architecture 문서의 핵심 모듈](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md#핵심-모듈)을 참고하세요.
```

`#핵심-모듈` 앵커는 "## 핵심 모듈" 제목(현재 47행)이 그대로면 GitHub가 자동 생성하는 슬러그와 일치한다(이 README가 이미 쓰는 `#공개-api-표면` 링크와 같은 규칙).

## 문서 계약

- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다:
  `- \`2026-08-15-blur-naming-disambiguation-design.md\`: blur() 체이닝 API와 BlurFilterPlugin이 이름만 같고 무관하다는 사실을 문서로 드러낸 결정 근거`
- 구현 완료 후 `_tmp/arch-review/02.html`의 카드 9(`id="card-9"`)에 다른 완료 카드와 동일한 형식(초록 완료 배지 + `text-xs bg-slate-900` 요약 블록)으로 커밋 해시·검증 결과를 기록한다. 이 파일은 리뷰 산출물이라 별도 커밋으로 관리해도 무방하다.
- `CHANGELOG.md`는 갱신하지 않는다 — 공개 API·런타임 동작 변경이 없다(Keep a Changelog 형식은 사용자 관찰 가능한 변경만 기록).
- `docs/maintenance-risks.md`는 갱신하지 않는다 — 이 카드는 추적 중이던 결함이 아니라 이번 재탐색에서 새로 나온 문서 격차다.

## 비범위

- `BlurFilterPlugin`/`BlurFilterPlugins`/`plugin.name: 'blur'` 등 export·문자열 식별자 개명. (`PixelFilterPlugin` 개명은 breaking change라 이번 결정에서 기각 — 재검토 조건 참고.)
- `.blur()`와 `BlurFilterPlugin`의 동작·시그니처 변경. 둘 다 실재하는 이유가 다르므로 병합하지 않는다(카드 9 원문의 판단 그대로 유지).
- 카드 4(BlendMode 계약)를 포함한 같은 리뷰 문서의 다른 카드.

## 재검토 조건

- 실제 사용자 혼동 사례(이슈·질문)가 보고되면 export 개명(`PixelFilterPlugin` 등)을 별도 카드로 연다 — breaking change이므로 `CHANGELOG.md` Breaking 항목과 마이그레이션 가이드가 함께 필요하다.
- 필터 시스템에 새 카테고리(sharpen 계열 등)가 추가돼 "핵심 모듈" 표의 두 행이 실제 파일 구성과 어긋나면 그때 갱신한다.

## 검증

코드 변경이 없으므로 `pnpm typecheck`/`pnpm test`/`pnpm lint`는 이 변경을 exercise하지 않는다. 대신 다음을 확인한다.

- `git diff --stat`이 `docs/architecture.md`, `sub/web-image-util/README.md`, `docs/design/README.md`, `docs/design/2026-08-15-blur-naming-disambiguation-design.md` 4개 파일만 보여준다(`src/`·`tests/` 변경 없음).
- 추가한 표 행·불변조건 항목의 file:line 인용(`single-renderer.internal.ts`, `blur-plugins.ts:79-178`, `advanced-processor.ts:87,134-155`)이 실제 코드와 일치하는지 diff 적용 직후 다시 grep으로 확인한다.
- README에 추가한 `#핵심-모듈` 링크를 클릭(또는 GitHub 미리보기)해 실제 앵커로 이동하는지 확인한다.
