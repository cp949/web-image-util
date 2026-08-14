# SVG id 참조 무결성 설계

## 배경

`SvgOptimizer.getDefaultOptions()`는 `removeMetadata`·`simplifyPaths`·`optimizeGradients`·
`removeUnusedDefs`를 함께 켠다(`mergeElements`만 기본 false). 1단계 `removeMetadata`의
`UNNECESSARY_ATTRIBUTE_PATTERNS`에는 `/id="[^"]*"/g`가 있다. 참조 여부와 무관하게 문서의
모든 `id="..."`를 지운다. 뒤따르는 3·4단계는 그 id가 남아있다고 가정한다.

실측 재현:

```
<defs><symbol id="g1" .../></defs>
<use href="#g1" .../>
```

기본 옵션으로 `SvgOptimizer.optimize()`를 돌리면 1단계에서 `id="g1"`이 먼저 사라진다.
`<use href="#g1"/>`는 대상을 잃는다 — 렌더링 회귀.

3단계 `optimizeGradients`는 `gradient.getAttribute('id')`가 `null`이면 해당 그라디언트를
건너뛴다. 4단계 `removeUnusedDefs`도 `defs` 안에서 id를 찾지 못해 아무것도 지우지 못한다.
1단계가 뒤 단계를 무력화한 상태다. 수정 후에는 1단계가 참조 id를 보존하므로
`definedIds ⊆ referencedIds`가 성립한다. 4단계의 "미사용 정의만 제거" 루프는 여전히
지울 대상이 없다. 이번 카드의 범위는 참조 id 무결성이다.
파이프라인 순서 재설계는 비범위다.

"이 id가 참조되는가" 판정은 이미 두 곳에 갈라져 구현돼 있다.

- `remove-unused-defs.internal.ts`의 `collectUsedIds()`는 DOM `querySelector`로 8개
  presentation 속성과 `[href="#id"]`만 검사한다. `url(#id)`와 `href`는 지원하지만
  `xlink:href`·`src`는 지원하지 않는다.
- `prefix-svg-ids/reference-rewrite.internal.ts`는 `REF_ATTR_NAMES`와
  `classifyFragmentReference()`로 `href`·`xlink:href`·`src`를 분류한다. 네임스페이스를
  인지하지만 presentation 속성의 `url(#id)`는 지원하지 않는다.

`remove-unused-defs`의 `[href="#id"]` 셀렉터는 브라우저에서 `xlink:href`를 매치하지 않는다.
`<use xlink:href="#id">`만 참조하는 `<defs>` 정의를 미사용으로 오판해 제거하는 2차 결함이다.
jsdom은 이 셀렉터를 실제 브라우저와 다르게 처리하므로 별도 소비자 배선 테스트도 둔다.

adapter count: 판정 소비자는 `remove-unused-defs`와 `prefix-svg-ids` 두 곳이다. 독립 구현이
두 벌로 진화했다. `remove-metadata`는 판정 자체가 없는 세 번째 변형이다.

## 결정

id 참조 판정을 `collectReferencedIds(doc: Document): Set<string>` 단일 함수로 모은다.
위치: `src/utils/svg-optimizer/collect-referenced-ids.internal.ts`(신설).

- `url(#id)` 스타일: `remove-unused-defs`의 `REFERENCE_ATTRIBUTES` 목록을 그대로 옮긴다.
  대상은 `fill`·`stroke`·`filter`·`clip-path`·`mask`·`marker-start`·`marker-mid`·`marker-end`다.
- fragment 속성 스타일: `prefix-svg-ids`의 `REF_ATTR_NAMES`·`readReferenceAttribute()`·
  `classifyFragmentReference()`를 import해 재사용한다. 재구현하지 않는다.
- 두 결과의 합집합을 반환한다.
- 같은 모듈의 `rewriteReferencedIds(doc, replacements)`가 수집과 동일한 참조 형태를 재작성한다.
  presentation 속성의 따옴표·fallback은 보존하고, fragment 속성은 기존
  `rewriteFragmentReferences()`를 재사용한다.

**소비자 배선:**

- `remove-unused-defs.internal.ts`는 자체 판정을 지우고 `collectReferencedIds(doc)`를 쓴다.
  defs 자식 id를 수집하는 `collectDefinedIds()`는 그대로 둔다.
- `remove-metadata.internal.ts`는 `Set<string> | null` 참조 집합을 인자로 받는다. `null`은
  DOMParser 미가용·파싱 실패를 뜻한다. 이 경우 안전하게 id를 하나도 지우지 않는다.
- `optimizer.internal.ts`가 `removeMetadata` 직전에 `optimizedSvg`를 파싱한다. 성공하면
  `collectReferencedIds(doc)`를, 실패하면 `null`을 넘긴다.
- `optimize-gradients.internal.ts`는 중복 정의를 삭제한 뒤 `rewriteReferencedIds()`로
  삭제된 id의 모든 presentation/fragment 참조를 살아남은 id로 바꾼다.

**행동 변화(의도됨):**

- 참조되는 id는 기본 옵션에서도 이제 보존된다(이번 수정의 목적).
- 참조되지 않는 id는 기존과 동일하게 제거된다.
- `remove-unused-defs`가 `xlink:href` 참조를 인식한다. 사용 중인 `<defs>` 정의를 보존한다.
- `optimizeGradients`가 중복 정의를 병합해도 `href`/`xlink:href`/`src`와 8개
  presentation 속성의 참조는 살아남은 id로 재작성된다.
- **DOMParser 미가용 환경**에서는 id를 하나도 지우지 않는다. 이전에는 전부 지웠다.
  이 환경에서는 `optimizeGradients`와 `removeUnusedDefs`도 원본을 반환하므로 기존 패턴과 맞는다.

**부수 변경(공개 타입, Breaking):** `SvgOptimizationOptions.mergeElements` 필드를 제거한다.
이 필드는 `types.ts`와 `getDefaultOptions()`에만 있고 `optimize()`가 읽지 않는다. 실제 요소 병합
기능을 만드는 일은 비범위다. 구현되지 않은 공개 약속을 제거한다.
타입을 실제 동작과 맞춘다.

## 변경 상세

**`src/utils/svg-optimizer/collect-referenced-ids.internal.ts`(신설)**

```ts
export declare function collectReferencedIds(doc: Document): Set<string>;

export declare function rewriteReferencedIds(
  doc: Document,
  replacements: Map<string, string>
): void;
```

두 함수는 같은 presentation 속성 목록과 `url(#id)` 패턴을 공유한다. fragment 읽기·쓰기는
`prefix-svg-ids/reference-rewrite.internal.ts`의 기존 함수를 재사용한다.

**`src/utils/svg-optimizer/remove-unused-defs.internal.ts`**

- `REFERENCE_ATTRIBUTES` 상수와 `collectUsedIds()` 함수를 삭제한다.
- `import { collectReferencedIds } from './collect-referenced-ids.internal';` 추가.
- `removeUnusedDefs()`의 `collectUsedIds(...)` 호출을 `collectReferencedIds(doc)`로 교체한다.
- 파일 상단 JSDoc에 `collectReferencedIds()` 위임과 `xlink:href`·`src` 포함을 기록한다.

**`src/utils/svg-optimizer/remove-metadata.internal.ts`**

- `UNNECESSARY_ATTRIBUTE_PATTERNS`에서 `/id="[^"]*"/g,` 줄(및 주석)을 제거한다.
- `removeMetadata()`에 `referencedIds: Set<string> | null` 인자를 추가한다.
- 함수 끝, `UNNECESSARY_ATTRIBUTE_PATTERNS` 루프 다음에 조건부 id 스트립을 추가한다:
  ```ts
  if (referencedIds !== null) {
    cleaned = cleaned.replace(/id="([^"]*)"/g, (match, id) => (referencedIds.has(id) ? match : ''));
  }
  ```

**`src/utils/svg-optimizer/optimizer.internal.ts`**

- `parseAndClassifySvg`와 `collectReferencedIds` import를 추가한다.
- `if (options.removeMetadata) { ... }` 블록을 다음으로 교체:
  ```ts
  if (options.removeMetadata) {
    const parsed = parseAndClassifySvg(optimizedSvg);
    const referencedIds = parsed.ok ? collectReferencedIds(parsed.doc) : null;
    optimizedSvg = removeMetadata(optimizedSvg, referencedIds);
    optimizations.push('metadata removal');
  }
  ```
- `getDefaultOptions()`에서 `mergeElements: false,` 줄을 삭제한다.

**`src/utils/svg-optimizer/optimize-gradients.internal.ts`**

- `fill`/`stroke` 전용 `rewriteGradientReferences()`를 삭제한다.
- 중복 id의 `replacementMap`을 `rewriteReferencedIds()`에 넘긴다.
- 따옴표·fallback을 포함한 8개 presentation 속성과 fragment 속성 3종을 모두 재작성한다.

**`src/utils/svg-optimizer/types.ts`**

- `SvgOptimizationOptions.mergeElements: boolean;` 필드(및 JSDoc 줄)를 삭제한다.

## 테스트 계약

**신규 — `tests/unit/utils/svg-optimizer.test.ts`:**

- `collectReferencedIds`: URL·fragment·namespace·외부 fragment·빈 집합·혼합 참조를 검증한다.
- `removeMetadata`: 미참조 id 제거, 참조 id 보존, `null`일 때 전체 보존을 검증한다.
- `removeUnusedDefs`: `xlink:href="#id"` 참조 정의 보존을 검증한다.
- jsdom의 namespace selector 한계로 구배선에서도 통과하는 `xlink:href` 출력 테스트를 보완하도록
  `src="#id"` 소비자 테스트를 추가한다. 이 테스트는 구형 `href` 전용 배선에서 실패한다.
- 기본 옵션에서 `<use href="#g1">`의 대상 id가 보존되는 end-to-end 회귀를 검증한다.
- 기본 옵션에서 중복 gradient 병합 후 `xlink:href`가 살아남은 id로 바뀌는 회귀를 검증한다.
- `optimizeGradients`가 presentation·fragment 참조 형태를 모두 재작성하는지 검증한다.

**기존 테스트 갱신:**

- `getDefaultOptions()` 기대 객체(2곳)에서 `mergeElements: false,` 제거.
- 나머지 기존 `removeUnusedDefs`·`optimizeGradients`·`simplifyPaths` 테스트는 그대로 통과해야 한다.

## 문서 계약

- `CHANGELOG.md`: Fixed에 id 참조 무결성 수정, Changed에 `mergeElements` 제거를 추가한다.
- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다.
- `docs/architecture.md`: svg-optimizer 내부 구조 표가 없어 갱신하지 않는다.
- `docs/maintenance-risks.md`: 완료된 신규 결함은 추적하지 않는 정책에 따라
  갱신하지 않는다.

## 비범위

- `<style>` 태그·`style` 속성 내부 CSS의 `url(#id)` 참조 처리.
- `mergeElements`의 실제 구현. 유령 필드 제거만 한다.
- `remove-unused-defs`의 다른 동작(빈 `defs` 제거, 파싱 실패 폴백 등)은 변경하지 않는다.
- `optimizeGradients`·`removeUnusedDefs`의 독자적인 파싱을 한 번으로 합치는 성능 최적화.

## 재검토 조건

- `<style>`/CSS 내부 `url(#id)` 참조가 실제 렌더링 버그로 재현되면 별도 카드로 다룬다.
- `optimize()`의 파싱 중복이 실측 성능 문제로 보고되면 파싱 1회 공유로 재설계한다.
