# SVG 유효 크기 parity 설계

날짜: 2026-08-16
관련: `_tmp/arch-review/04.html` candidate 3

## 문제

SVG 유효 크기를 판정하는 경로가 둘로 갈라져 있다.

1. **렌더 경로** — `convertSvgToElement()`
   (`src/core/source-converter/svg/loader.internal.ts`)가
   `enhanceSvgForBrowser()`(`src/utils/svg-compatibility/enhance.ts`)를 먼저 태우고
   `extractSvgDimensions()`를 부른다. `enhanceSvgForBrowser()`는 `mode: 'fit-content'`를
   고정으로 넘기고, `applyViewBoxPolicy()`가 이 모드에서 유일한 조기 반환 조건인 `hasVB`
   (기존 `viewBox` 존재) 없이는 콘텐츠 BBox를 계산해 덮어쓴다. BBox 산출이 실패하면 명시
   width/height 또는(단서가 전혀 없으면) `defaultSize`(512×512)로 떨어진다.

2. **크기 조회 경로** — 공개 API `extractSvgDimensions()`(`src/utils/svg-dimensions.ts`)는
   이 BBox 로직을 타지 않는다. 원본 문자열의 width/height/viewBox 속성만 읽고, 단서가 없으면
   축별로 `100` 하드코딩 폴백을 쓴다. `getImageDimensions()`
   (`src/utils/image-info/dimensions.internal.ts`)는 SVG 인라인/Blob 소스에 대해
   `extractSvgDimensions()`를 원본 문자열에 직접 돌리므로(enhance 안 거침) 같은 divergence를
   그대로 물려받는다.

리뷰 문서(04.html candidate 3)는 "크기 정보가 아예 없는 SVG"(100 vs 512) 케이스만 재현했다.
코드를 추적한 결과 divergence 범위가 더 넓다:

- **width/height는 명시돼 있지만 viewBox가 없고, 콘텐츠 BBox가 그 명시값과 다른 SVG**도
  렌더 결과가 `extractSvgDimensions()` 반환값과 달라진다 — Case A가 fit-content 모드에서
  무조건 BBox로 덮어쓰기 때문. 문서가 재현한 케이스보다 실무에서 더 흔할 수 있는 범위다.

**범위 결정: 전체 parity.** 위 두 케이스를 모두 렌더 경로와 일치시킨다(narrow: 크기 정보
없는 케이스만 고치는 안은 기각).

## 설계

### 1. `viewbox-policy.internal.ts` — 순수 함수 추출

`applyViewBoxPolicy()`의 `hasVB` 분기 이후 Case A/B/C 결정 트리를 `resolveEffectiveViewBox()`로
뽑는다.

```
resolveEffectiveViewBox(root, opts, report?, svgString?)
  → { minX, minY, width, height }
```

- DOM을 수정하지 않는다(속성 읽기만).
- Case A(width/height 둘 다 px류): `preserve-framing`이면 그대로, `fit-content`면
  `computeBBox()` → 실패 시 명시값으로 폴백.
- Case B(한쪽만 또는 px 외 단위): 경고만 남기고 Case C로 이어짐(기존 동작 그대로).
- Case C(단서 없음): `fit-content` 또는 `ensureNonZeroViewport`면 `computeBBox()` 시도,
  실패하면 `defaultSize`.
- `report`는 옵션 — 안 넘기면 내부에서 버려지는 리포트 객체를 만들어 `computeBBox()`에 넘긴다.

`applyViewBoxPolicy()`는 `hasVB` 조기 반환 로직은 그대로 두고, 이후 전체를
`resolveEffectiveViewBox()` 호출 + `setVB(...)` 한 번으로 대체한다.

**동작 변화 없는 순수 리팩터** — 회귀 증거는 기존
`tests/unit/utils/svg-compatibility.test.ts`가 무수정 통과하는 것.

### 2. `svg-dimensions.ts` — `extractSvgDimensions()`

- `viewBox`가 있으면 기존 동작 유지(속성 값 우선, 없으면 viewBox 값).
- `viewBox`가 없으면 `resolveEffectiveViewBox()`를 렌더 경로와 동일한 옵션으로 호출해
  `width`/`height`를 그 결과값으로 채운다(속성값을 우선하지 않는다 — 렌더 경로도 fit-content
  모드에서 BBox 산출 성공 시 명시값을 무시하므로 동일하게 맞춘다).
  옵션: `{ ...DEFAULT_OPTIONS, mode: 'fit-content' }`
  (`enableLiveBBox: false`, `enableHeuristicBBox: true`, `paddingPercent: 0`,
  `ensureNonZeroViewport: true`, `defaultSize: {width:512,height:512}`는 `DEFAULT_OPTIONS`와
  이미 일치 — `enhanceSvgForBrowser()`가 넘기는 옵션과 동일).
- `hasExplicitSize`는 속성 존재 여부 그대로 유지(의미 변경 안 함).

### 3. `image-info/dimensions.internal.ts`

코드 변경 없음 — `extractSvgDimensions()`를 그대로 호출하므로 자동으로 수혜.

### 4. 의존 방향

새로 생기는 의존: `svg-dimensions.ts → svg-compatibility/viewbox-policy.internal.ts`.
역방향 의존 없음(확인 완료) — 순환 없음.

## 비범위

- `viewBox`는 있지만 0×0인 손상 케이스(`hasVB && ensureNonZeroViewport && !hasW && !hasH`
  보정 분기)는 건드리지 않는다.
- Live `getBBox()`는 렌더 경로와 동일하게 계속 비활성(`enableLiveBBox: false`) — 크기 조회가
  DOM attach를 유발하지 않도록 유지.

## 영향

`extractSvgDimensions()`는 `src/index.ts`에서 재export되는 공개 API이자
`tests/contract/runtime-contract.test.ts`의 계약 테스트 대상이다. 반환값이 바뀌므로
CHANGELOG에 **Fixed**로 기재한다(Breaking 아님 — 실제 렌더 결과와 일치시키는 버그 수정).

## 테스트 계획

`tests/unit/utils/svg-dimensions.test.ts`:

- 크기 정보 전혀 없는 SVG → 기존 100×100 pin을 512×512로 교체.
- width/height는 있지만 viewBox 없고 콘텐츠 BBox가 다른 SVG(신규) → BBox 값과 일치.

기존 `svg-compatibility.test.ts`, `runtime-contract.test.ts`는 무수정 통과 확인.
