# SVG id 참조 무결성 설계

## 배경

`SvgOptimizer.getDefaultOptions()`는 `removeMetadata`·`simplifyPaths`·`optimizeGradients`·`removeUnusedDefs`를 함께 켠다(`mergeElements`만 기본 false). 1단계 `removeMetadata`(`src/utils/svg-optimizer/remove-metadata.internal.ts:29-38`)의 `UNNECESSARY_ATTRIBUTE_PATTERNS`에 `/id="[^"]*"/g`가 있어, 참조 여부와 무관하게 문서의 모든 `id="..."`를 정규식으로 지운다. 뒤따르는 3·4단계는 그 id가 남아있다고 가정한다.

실측 재현:

```
<defs><symbol id="g1" .../></defs>
<use href="#g1" .../>
```

기본 옵션으로 `SvgOptimizer.optimize()`를 돌리면 1단계에서 `id="g1"`이 먼저 사라지고, `<use href="#g1"/>`는 대상을 잃는다 — 렌더링 회귀. 3단계 `optimizeGradients`(`optimize-gradients.internal.ts:74-76`)는 `gradient.getAttribute('id')`가 `null`이면 그 그라디언트를 그냥 건너뛰고(병합도 제거도 안 함), 4단계 `removeUnusedDefs`는 `defs` 안에서 id 자체를 못 찾으므로 아무 것도 지우지 못한다 — 1단계가 이미 모두 지워버려 뒤 단계가 무력화된 상태다.

"이 id가 참조되는가" 판정은 이미 두 곳에 갈라져 구현돼 있다.

| 파일 | 판정 방식 | 커버리지 |
| --- | --- | --- |
| `remove-unused-defs.internal.ts:14-23`(`REFERENCE_ATTRIBUTES`) + `collectUsedIds()`(36-48행) | DOM `querySelector`로 `[fill="url(#id)"], [stroke="url(#id)"], ...` 8개 속성 + `[href="#id"]` 셀렉터만 검사 | `url(#id)` 스타일 O, `href="#id"` O, `xlink:href`/`src` **X** |
| `prefix-svg-ids/reference-rewrite.internal.ts:5,41-49`(`REF_ATTR_NAMES`, `classifyFragmentReference()`) | `href`/`xlink:href`/`src` 속성 값을 읽어(네임스페이스 인지) internal/external/non-fragment로 분류 | fragment 속성 3종 O, `url(#id)` 스타일 **X**(`src/utils/prefix-svg-ids.ts:150` — "CSS 내부 `url(#id)` rewrite는 본 함수 비범위다"라고 명시) |

`remove-unused-defs`의 `[href="#id"]` 셀렉터는 `xlink:href` 속성을 매칭하지 못한다 — 실제로 `<use xlink:href="#id">`만 있고 `href`는 없는 `<defs>` 정의를 미사용으로 오판해 제거하는 2차 결함이 이미 존재한다(이번 조사에서 재현 확인, 별도 테스트로 고정한다).

adapter count: 이 판정을 필요로 하는 소비자가 이미 둘(`remove-unused-defs`, `prefix-svg-ids`) 독립적으로 갈라져 존재한다 — 가상의 seam이 아니라 실제로 두 벌로 진화한 로직이다. `remove-metadata`는 판정 자체를 안 하는 세 번째, 가장 안전하지 않은 변형이다.

## 결정

id 참조 판정을 `collectReferencedIds(doc: Document): Set<string>` 단일 함수로 모은다. 위치: `src/utils/svg-optimizer/collect-referenced-ids.internal.ts`(신설).

- `url(#id)` 스타일: `remove-unused-defs`의 `REFERENCE_ATTRIBUTES` 목록(`fill`/`stroke`/`filter`/`clip-path`/`mask`/`marker-start`/`marker-mid`/`marker-end`)을 그대로 옮긴다.
- fragment 속성 스타일: `prefix-svg-ids/reference-rewrite.internal.ts`가 이미 가진 `REF_ATTR_NAMES`·`readReferenceAttribute()`·`classifyFragmentReference()`를 **import해서 재사용**한다("두 기존 구현 중 더 완전한 prefix-svg-ids쪽 정합") — 재구현하지 않는다.
- 두 결과의 합집합을 반환한다.

**소비자 배선:**

- `remove-unused-defs.internal.ts`는 자체 `REFERENCE_ATTRIBUTES`·`collectUsedIds()`를 지우고 `collectReferencedIds(doc)`를 쓴다. `collectDefinedIds()`(defs 자식의 id 수집이라는 다른 책임)는 그대로 둔다.
- `remove-metadata.internal.ts`는 참조 집합을 인자로 받는다: `removeMetadata(svgString: string, referencedIds: Set<string> | null): string`. `null`은 "판정 불가"(DOMParser 미가용·파싱 실패)를 뜻하며, 이 경우 **id를 하나도 지우지 않는다** — 렌더링을 깨느니 최적화를 덜 하는 쪽을 택하는 안전 우선 폴백이다. `UNNECESSARY_ATTRIBUTE_PATTERNS`에서 `id="..."` 정규식을 빼내 별도 조건부 치환(참조되지 않는 id만 제거)으로 옮긴다.
- `optimizer.internal.ts`(오케스트레이터)가 배선 책임을 진다. `removeMetadata` 단계 진입 직전에 그 시점의 `optimizedSvg` 문자열을 `parseAndClassifySvg()`로 한 번 파싱하고, 성공하면 `collectReferencedIds(doc)`를, 실패하면 `null`을 넘긴다.

**행동 변화(의도됨):**

- 참조되는 id는 기본 옵션에서도 이제 보존된다(이번 수정의 목적).
- 참조되지 않는 id는 기존과 동일하게 제거된다 — 기존 테스트(`svg-optimizer.test.ts`의 `not.toContain('id="box"')`, 참조 없는 단순 `<rect id="box">`)는 그대로 통과한다.
- `remove-unused-defs`가 `xlink:href` 참조를 이제 인식한다 — 이전에 잘못 제거되던 `<defs>` 정의가 보존된다(2차 결함 해소).
- **DOMParser 미가용 환경**(순수 Node 등)에서는 이제 id를 하나도 지우지 않는다. 이전에는 이 환경에서도 무조건 전부 지웠다. 이 환경에서는 애초에 `optimizeGradients`/`removeUnusedDefs`도 원본을 그대로 반환하므로(파서 없으면 스킵), 새로운 비대칭이 아니라 기존 패턴과의 정합이다.

**부수 변경(공개 타입, Breaking):** `SvgOptimizationOptions.mergeElements` 필드를 제거한다. `types.ts`와 `getDefaultOptions()`에만 존재하고 `optimize()`의 5단계 어디에서도 읽지 않는 유령 필드다(구현 0줄) — 카드가 "정리 계기"로 지목한 항목이다. 실제 유사-요소-병합 기능을 새로 만드는 일은 하지 않는다(비범위, 아래 참고). enum을 실구현에 맞춰 좁히는 카드 4(`BlendMode`)와 같은 패턴 — "약속을 못 지키면 약속 자체를 없앤다."

## 변경 상세

**`src/utils/svg-optimizer/collect-referenced-ids.internal.ts`(신설)**

```ts
import {
  classifyFragmentReference,
  readReferenceAttribute,
  REF_ATTR_NAMES,
} from '../prefix-svg-ids/reference-rewrite.internal';

const URL_REFERENCE_ATTRIBUTES = [
  'fill', 'stroke', 'filter', 'clip-path', 'mask',
  'marker-start', 'marker-mid', 'marker-end',
] as const;

function extractUrlReferenceId(value: string): string | null {
  const match = /^url\(#([^)]+)\)$/.exec(value.trim());
  return match ? match[1] : null;
}

export function collectReferencedIds(doc: Document): Set<string> {
  const referenced = new Set<string>();
  const all = doc.getElementsByTagName('*');

  for (let i = 0; i < all.length; i++) {
    const el = all[i];

    for (const attr of URL_REFERENCE_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const id = extractUrlReferenceId(value);
      if (id) referenced.add(id);
    }

    for (const attrName of el.getAttributeNames()) {
      const lowered = attrName.toLowerCase();
      if (!REF_ATTR_NAMES.has(lowered)) continue;
      const value = readReferenceAttribute(el, attrName, lowered);
      if (value === null) continue;
      const classification = classifyFragmentReference(value);
      if (classification.kind === 'internal') referenced.add(classification.token);
    }
  }

  return referenced;
}
```

**`src/utils/svg-optimizer/remove-unused-defs.internal.ts`**

- `REFERENCE_ATTRIBUTES` 상수와 `collectUsedIds()` 함수를 삭제한다.
- `import { collectReferencedIds } from './collect-referenced-ids.internal';` 추가.
- `removeUnusedDefs()` 안 `const usedIds = collectUsedIds(doc.documentElement, definedIds);` → `const usedIds = collectReferencedIds(doc);`로 교체.
- 파일 상단 JSDoc의 판정 범위 서술(`fill/stroke/.../href="#id"`)을 `collectReferencedIds()` 위임과 `xlink:href`/`src` 포함으로 정정한다.

**`src/utils/svg-optimizer/remove-metadata.internal.ts`**

- `UNNECESSARY_ATTRIBUTE_PATTERNS`에서 `/id="[^"]*"/g,` 줄(및 주석)을 제거한다.
- `removeMetadata(svgString: string)` → `removeMetadata(svgString: string, referencedIds: Set<string> | null)`로 시그니처 변경.
- 함수 끝, `UNNECESSARY_ATTRIBUTE_PATTERNS` 루프 다음에 조건부 id 스트립을 추가한다:
  ```ts
  if (referencedIds !== null) {
    cleaned = cleaned.replace(/id="([^"]*)"/g, (match, id) => (referencedIds.has(id) ? match : ''));
  }
  ```

**`src/utils/svg-optimizer/optimizer.internal.ts`**

- `import { parseAndClassifySvg } from '../svg-document.internal';`, `import { collectReferencedIds } from './collect-referenced-ids.internal';` 추가.
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

**`src/utils/svg-optimizer/types.ts`**

- `SvgOptimizationOptions.mergeElements: boolean;` 필드(및 JSDoc 줄)를 삭제한다.

## 테스트 계약

**신규 — `tests/unit/utils/svg-optimizer.test.ts`:**

- `describe('collectReferencedIds 내부 판정', ...)`: `url(#id)` 판정, `href="#id"` 판정, `xlink:href="#id"` 판정(네임스페이스), 참조 없을 때 빈 집합, 혼합 참조 전부 수집, 외부 fragment(`sprite.svg#id`)는 세지 않음 — 6개.
- `describe('removeMetadata 내부 패스', ...)`: 참조 없는 id 제거, 참조되는 id 보존, `referencedIds: null`이면 모든 id 보존 — 3개.
- `removeUnusedDefs 내부 패스`에 `xlink:href="#id"` 참조 보존 테스트 1개 추가(회귀 — 이전에는 오판 제거).
- `SVG 최적화`(최상위 describe)에 기본 옵션 end-to-end 회귀 테스트 1개 추가: `<use href="#g1">` + `<defs><symbol id="g1">`가 `SvgOptimizer.optimize()` 기본 옵션에서 `id="g1"`과 `href="#g1"` 둘 다 보존.

**기존 테스트 갱신:**

- `getDefaultOptions()` 기대 객체(2곳)에서 `mergeElements: false,` 제거.
- 나머지 기존 테스트(`removeUnusedDefs`/`optimizeGradients`/`simplifyPaths` 내부 패스 전체, "기본 최적화는..." 테스트의 `not.toContain('id="box"')`)는 **무변경으로 통과**해야 한다 — 동작 보존 리팩터의 회귀 방지망.

## 문서 계약

- `CHANGELOG.md` `[Unreleased]` → `### 수정`(Fixed) 끝에 id 참조 무결성 수정 항목 추가, `### 변경`(Changed, Breaking) 끝에 `mergeElements` 필드 제거 항목 추가.
- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다.
- `docs/architecture.md` — svg-optimizer 내부 구조를 다루는 표 항목이 없어(현재 `/utils` 서브패스 노출 목록에 `SvgOptimizer` 한 줄만 존재) 갱신 대상 없음.
- `docs/maintenance-risks.md` — 이 결함은 이번 재탐색(02.html)에서 신규 발견된 항목이라 기존에 기록이 없었다. 수정 완료로 새 행을 추가하지 않는다(완료된 항목은 이 문서가 추적하지 않는 컨벤션 — 카드 1·2도 동일하게 처리됨).

## 비범위

- `<style>` 태그·`style` 속성 내부 CSS의 `url(#id)` 참조 처리. `prefix-svg-ids`도 이 경우 전체를 deopt한다(`dom-utils.internal.ts`의 `detectStyleDeoptReasons()`) — 기존 정책과 동일하게 비범위로 남긴다.
- `mergeElements`의 실제 구현(유사 요소 병합 기능 자체를 새로 만드는 일). 유령 필드 제거만 한다.
- `remove-unused-defs`의 다른 동작(빈 `defs` 제거, 파싱 실패 폴백 등)은 변경하지 않는다.
- `optimizeGradients`/`removeUnusedDefs`의 독자적인 `parseAndClassifySvg()` 재파싱을 하나로 합치는 성능 최적화(각 패스가 이미 svgString을 받아 자체 파싱하는 기존 구조를 유지 — `optimizer.internal.ts`가 `removeMetadata`를 위해 한 번 더 파싱하게 되어 optimize() 1회당 파싱 횟수가 늘지만, 기존에도 옵션 조합에 따라 패스마다 독립 파싱하던 구조라 새로운 비일관성이 아니다).

## 재검토 조건

- `<style>`/CSS 내부 `url(#id)` 참조가 실제 렌더링 버그로 재현되면 별도 카드로 다룬다.
- `optimize()`의 파싱 중복이 실측 성능 문제로 보고되면 파싱 1회 공유로 재설계한다.
