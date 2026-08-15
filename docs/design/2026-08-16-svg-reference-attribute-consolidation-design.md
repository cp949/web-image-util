# SVG 참조 속성 판정 통합 설계

## 배경

"이 attribute가 `href`/`xlink:href`/`src` 참조를 담는가"라는 구조적 판정이 4곳에 따로 구현돼 있다.

- `src/utils/svg-inspection/reference-attribute.internal.ts`의 `isReferenceAttribute()`/`readReferenceAttribute()` — lowered 이름과 namespace 분리 후 `localName` 양쪽을 검사해 임의 prefix로 선언된 `xlink:href`(예: `xmlns:foo` + `foo:href`)도 참조로 인식한다.
- `src/svg-sanitizer/enforce-dom-policy.internal.ts:53`의 인라인 복제본 — `localName`까지 검사해 위 벌과 동등하게 permissive하다.
- `src/svg-sanitizer/warnings.internal.ts:71`의 인라인 복제본 — 마찬가지로 `localName`까지 검사한다.
- `src/utils/prefix-svg-ids/reference-rewrite.internal.ts`의 `REF_ATTR_NAMES`(`Set<string>(['href', 'xlink:href', 'src'])`) — lowered 문자열 3개만 담은 `Set`이다. `localName` fallback이 없다.

`src/utils/svg-optimizer/collect-referenced-ids.internal.ts`는 마지막 벌(`REF_ATTR_NAMES`/`readReferenceAttribute`)을 그대로 import해서 쓰면서도 자기 docblock에는 "prefix-svg-ids의 판정 로직을 그대로 재사용해 네임스페이스까지 인지한다"고 적어 뒀다 — 재사용은 맞지만 인지 범위는 4벌 중 가장 좁은 벌이다.

**재현 가능한 결함:** `<svg xmlns:foo="http://example.test/foo">`로 표준과 다른 prefix를 선언하고 `<use foo:href="#icon"/>`를 쓰는 SVG를 `prefixSvgIds()`에 넣으면, `id="icon"`은 `id="prefix-icon"`으로 바뀌지만 `foo:href="#icon"`은 `REF_ATTR_NAMES`에 lowered 이름 `"foo:href"`가 없어 그대로 남는다 — dangling reference. 같은 벌을 쓰는 `svg-optimizer`의 `removeUnusedDefs`/`removeMetadata`는 그 `<defs>` id를 "미참조"로 오판해 삭제한다.

### 시그니처 불일치

승격 대상인 `svg-inspection` 벌과 유지 대상인 `prefix-svg-ids` 벌은 `readReferenceAttribute()` 시그니처도 다르다.

```ts
// svg-inspection/reference-attribute.internal.ts — 2-arg, 내부에서 자체 정규화
export function readReferenceAttribute(element: Element, attrName: string): string | null

// prefix-svg-ids/reference-rewrite.internal.ts — 3-arg, 호출자가 미리 계산한 lowered를 받음
export function readReferenceAttribute(element: Element, attrName: string, lowered: string): string | null
```

`attrName.toLowerCase()`는 트리비얼한 연산이라 캐리어 파라미터로 넘길 비용상의 이유가 없다. 오늘의 4중 분산도 각자 다른 방식으로 `lowered`를 다루다 갈라진 흔적이다.

### 레이어 배치 — 조사 결과

`svg-inspection`의 벌을 그대로 승격하고 나머지가 그걸 import하게 하는 방향을 처음 검토했지만, 그렇게 하면 `enforce-dom-policy.internal.ts`(strict 집행 엔진, 보안 핵심 경로)가 `svg-inspection`(`docs/architecture.md`가 "파이프라인 외부의 진단 레이어"로 명시한 계층)을 의존하게 된다 — 레이어 역전이다. 현재 유일한 svg-sanitizer↔svg-inspection 연결(`inspect-sanitization/stage-collectors.internal.ts` → `svg-inspection/sanitizer-exports.internal.ts`)도 진단 레이어끼리의 연결이지 집행 엔진발이 아니다.

대안으로 `src/utils/svg-document.internal.ts`를 검토했다 — 이미 4개 소비자 영역(svg-sanitizer/prefix-svg-ids/svg-optimizer/svg-inspection) 전부가 의존하고, 그 자신은 아무것도 import하지 않는 leaf-of-leaves다. 하지만 파일을 직접 읽어보면 자기 docblock이 책임을 "SVG DOM 파싱 경계"로 명시적으로 좁혀 놨다 — "dimension 읽기·finding 수집·정책 적용은 소비자 책임". attribute 판정을 얹으면 그 경계를 깬다.

## 결정

`src/utils/svg-reference-attribute.internal.ts`(신설)를 참조 속성 판정의 단일 소유자로 삼는다. `svg-threat-policy.internal.ts`/`svg-contract.internal.ts`와 같은 레이어 — 아무것도 import하지 않는 leaf.

```ts
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

export function isReferenceAttribute(element: Element, attrName: string): boolean;
export function readReferenceAttribute(element: Element, attrName: string): string | null;
```

두 함수는 인자로 받은 `attrName`을 내부에서 직접 `.toLowerCase()`한다. `isReferenceAttribute()`는 일반 이름을 먼저 판정하고 prefixed `*:href`/`*:src` 후보에만 `getAttributeNode()`를 호출해 namespace 분리 후 `localName`을 검사한다. XML namespace 선언(`xmlns:*`)은 참조 속성이 아니므로 제외한다. `readReferenceAttribute()`는 같은 `localName`을 가진 다른 namespace 속성과 혼동하지 않도록 전달된 qualified name의 값을 정확히 읽는다. 호출자가 `lowered`를 미리 계산해 넘기는 3-arg 오버로드는 두지 않는다.

**범위에 포함하는 것:**

- 판정 함수 2개(`isReferenceAttribute`/`readReferenceAttribute`)와 `XLINK_NAMESPACE` 상수. 이 상수는 판정 로직과 근원이 같은 사실(xlink namespace URI)이라 함께 정리한다.

**범위에서 제외하는 것:**

- `prefix-svg-ids`의 `writeReferenceAttribute()` 통합 — 대상에서 제외한다. "참조인가"와 "참조를 어떻게 다시 쓰는가"는 다른 책임이고, write는 지금 한 곳만 갖고 있어 중복(real seam)이 아니다. 이 함수는 `prefix-svg-ids/reference-rewrite.internal.ts`에 남고, 자기 호출부에서 `attrName.toLowerCase()`로 `lowered`를 직접 계산해 넘긴다(4-arg 시그니처 유지). 다만 기존 attribute를 쓸 때는 qualified name으로 찾은 `Attr.value`를 변경해 같은 localName의 다른 namespace 속성을 건드리지 않는다.
- `src/utils/svg-compatibility/attributes.internal.ts`의 독립 `XLINK_NAMESPACE` — 값은 같지만(W3C 스펙 고정 URI) 하는 일이 다르다(`xmlns:xlink` 선언 자동 삽입, 구식 `xlink:href` → `href` 마이그레이션이지 참조 판정이 아니다). 나머지 4곳과 import 관계도 전혀 없다. 무관한 파일에 판정 leaf를 억지로 의존시키지 않는다.

**소비자 배선(6곳, 전부 `.internal.ts` — 공개 표면 변화 없음):**

- `svg-inspection/dom-signals.internal.ts`, `svg-inspection/dom-analysis.internal.ts` — import 경로만 교체(호출부 시그니처 이미 2-arg라 호출 코드 변경 없음).
- `svg-inspection/sanitizer-exports.internal.ts` — re-export 소스만 교체. `stage-collectors.internal.ts`가 보는 외부 인터페이스는 그대로다.
- `svg-sanitizer/enforce-dom-policy.internal.ts`, `svg-sanitizer/warnings.internal.ts` — 인라인 조건문을 `isReferenceAttribute()` 호출로 교체.
- `prefix-svg-ids/reference-rewrite.internal.ts` — `rewriteFragmentReferences()` 내부 루프의 `REF_ATTR_NAMES.has(lowered)` + 3-arg `readReferenceAttribute()`를 새 leaf의 2-arg 버전으로 교체. `writeReferenceAttribute()`는 그대로 남되 `XLINK_NAMESPACE`를 새 leaf에서 import한다.
- `svg-optimizer/collect-referenced-ids.internal.ts` — `collectReferencedIds()` 루프만 교체(`rewriteReferencedIds()`는 `rewriteFragmentReferences()`에 위임하므로 무변경).

`src/utils/svg-inspection/reference-attribute.internal.ts`는 삭제한다. 그 파일에만 있던 `SvgInspectionPolicy` 타입 별칭(`SvgThreatPolicyMode`의 alias)은 실사용 0건(자기 재export 1곳뿐)이라 같이 지운다.

**행동 변화(의도됨):**

- 비표준 prefix로 선언된 xlink 참조(`xmlns:foo` + `foo:href` 등)가 `prefixSvgIds()`에서 이제 rewrite된다. 이전에는 조용히 건너뛰었다.
- 같은 종류의 참조가 `SvgOptimizer`의 `collectReferencedIds()`에서도 이제 "참조됨"으로 잡힌다. `removeUnusedDefs`/`removeMetadata`가 그 id를 더 이상 오판 삭제하지 않는다.
- `svg-inspection`·`enforce-dom-policy`·`warnings` 세 벌은 오늘도 이미 permissive했으므로 동작 변화가 없다. `enforce-dom-policy.internal.ts`의 실제 `sanitizeSvgStrict()` 출력에는 지금까지 이 케이스를 검증하는 테스트가 없었다 — 이번에 추가한다(§테스트 계약).

## 변경 상세

**`src/utils/svg-reference-attribute.internal.ts`(신설)**

```ts
/**
 * SVG 참조 속성 판정 — 라이브러리 전체의 단일 소유자.
 *
 * `href`/`xlink:href`/`src` attribute가 다른 요소·외부 자원에 대한 참조를 담는지
 * 판정한다. lowered 이름과 namespace 분리 후의 localName 양쪽을 검사해 임의
 * prefix로 선언된 xlink:href(예: `xmlns:foo` + `foo:href`)도 잡는다.
 *
 * "그 참조가 위협인가"를 다루는 참조 판정(uri ref verdict, svg-threat-policy.internal.ts)
 * 보다 한 단계 앞선 구조적 사실이며, 판정 자체와는 무관하다.
 *
 * 이 모듈은 public export가 아니다(`package.json` exports 비대상).
 */

/** xlink namespace URI. happy-dom과 브라우저 모두에서 동일하다. */
export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/**
 * `href` / `xlink:href` / `src` 참조 속성 여부를 판정한다.
 *
 * lowered attribute 이름과 namespace 분리 후의 localName 양쪽으로 검사해
 * `xlink:href`처럼 prefix가 붙은 경우와 namespace 처리된 경우를 모두 잡는다.
 */
export function isReferenceAttribute(element: Element, attrName: string): boolean {
  const lowered = attrName.toLowerCase();
  if (lowered === 'href' || lowered === 'xlink:href' || lowered === 'src') return true;
  if (!lowered.endsWith(':href') && !lowered.endsWith(':src')) return false;

  const attribute = element.getAttributeNode(attrName);
  if (attribute === null || attribute.namespaceURI === XMLNS_NAMESPACE) return false;

  const localName = attribute.localName.toLowerCase();
  return localName === 'href' || localName === 'src';
}

/**
 * `href` / `xlink:href` / `src` 속성값을 전달된 qualified name 그대로 읽는다.
 */
export function readReferenceAttribute(element: Element, attrName: string): string | null {
  return element.getAttribute(attrName);
}
```

기존 `svg-inspection/reference-attribute.internal.ts`의 판정 범위를 유지하되, 통합으로 소비자가 늘어나는 경계에서 XML namespace 선언 오탐과 같은 localName을 가진 속성 간 값 혼동을 제거한다. 일반 속성 fast-path로 무관한 attribute마다 DOM 조회가 발생하지 않게 한다.

**`src/utils/svg-inspection/reference-attribute.internal.ts`(삭제)**

**`src/utils/svg-inspection/dom-signals.internal.ts`**

```diff
-import { isReferenceAttribute, readReferenceAttribute } from './reference-attribute.internal';
+import { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';
```

**`src/utils/svg-inspection/dom-analysis.internal.ts`**

```diff
-import { isReferenceAttribute, readReferenceAttribute } from './reference-attribute.internal';
+import { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';
```

**`src/utils/svg-inspection/sanitizer-exports.internal.ts`**

```diff
 export { collectSvgCssReferenceSignals, type SvgCssReferenceSignals } from './css-signals.internal';
 export { collectSvgDomSecuritySignals, type SvgDomSecuritySignals } from './dom-signals.internal';
-export {
-  isReferenceAttribute,
-  readReferenceAttribute,
-  type SvgInspectionPolicy,
-  XLINK_NAMESPACE,
-} from './reference-attribute.internal';
+export { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';
 export { pushCappedSample } from './sample-utils.internal';
```

`XLINK_NAMESPACE`/`SvgInspectionPolicy` 재export는 소비자(`stage-collectors.internal.ts`)가 쓰지 않아 함께 지운다.

**`src/svg-sanitizer/enforce-dom-policy.internal.ts`**

```diff
 import { FORBIDDEN_SVG_ELEMENT_NAMES } from '../utils/svg-threat-policy.internal';
+import { isReferenceAttribute } from '../utils/svg-reference-attribute.internal';
 import { sanitizeCssValue, shouldSanitizeCssAttribute } from './css-policy.internal';
 import { sanitizeStrictUriValue } from './reference-policy.internal';
 import type { NestedSanitize, StrictSvgSanitizerOptions } from './types';
 import { pushUniqueWarning } from './warnings.internal';
```

```diff
-      if (name === 'href' || name === 'xlink:href' || name === 'src' || localName === 'href' || localName === 'src') {
+      if (isReferenceAttribute(element, attribute.name)) {
```

`name`/`localName` 변수는 바로 위 `on*` 이벤트 핸들러 검사에서 계속 쓰이므로 그대로 둔다.

**`src/svg-sanitizer/warnings.internal.ts`**

```diff
 import { parseAndClassifySvg } from '../utils/svg-document.internal';
+import { isReferenceAttribute } from '../utils/svg-reference-attribute.internal';
 import { classifyUriRef, type UriRefReason } from '../utils/svg-threat-policy.internal';
 import { sanitizeCssValue, shouldSanitizeCssAttribute } from './css-policy.internal';
```

```diff
-      if (name === 'href' || name === 'xlink:href' || name === 'src' || localName === 'href' || localName === 'src') {
+      if (isReferenceAttribute(element, attribute.name)) {
```

**`src/utils/prefix-svg-ids/reference-rewrite.internal.ts`**

```diff
-/** xlink namespace URI. xlink:href attribute 처리에 사용한다. */
-export const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
-
-/** fragment reference를 담을 수 있는 attribute 이름 집합(소문자 기준). */
-export const REF_ATTR_NAMES = new Set<string>(['href', 'xlink:href', 'src']);
-
-/**
- * element에서 reference attribute 값을 읽는다.
- * xlink:href는 getAttributeNS를 우선 시도하고, 없으면 getAttribute로 폴백한다.
- */
-export function readReferenceAttribute(element: Element, attrName: string, lowered: string): string | null {
-  if (lowered === 'xlink:href') {
-    const nsVal = element.getAttributeNS(XLINK_NAMESPACE, 'href');
-    if (nsVal !== null) return nsVal;
-    return element.getAttribute(attrName);
-  }
-  return element.getAttribute(attrName);
-}
+import { isReferenceAttribute, readReferenceAttribute, XLINK_NAMESPACE } from '../svg-reference-attribute.internal';
```

```diff
 /**
  * element의 reference attribute를 새 값으로 쓴다.
  * 기존 속성은 qualified name으로 찾아 namespace·prefix를 보존하고, 없는 xlink:href는 XLink namespace로 만든다.
  */
 export function writeReferenceAttribute(element: Element, attrName: string, lowered: string, newValue: string): void {
   const attribute = element.getAttributeNode(attrName);
   if (attribute !== null) {
     attribute.value = newValue;
     return;
   }

   if (lowered === 'xlink:href') {
     element.setAttributeNS(XLINK_NAMESPACE, attrName, newValue);
   } else {
     element.setAttribute(attrName, newValue);
   }
 }
```

`writeReferenceAttribute`의 소유 위치와 4-arg 시그니처는 유지한다. 기존 속성은 정확한 qualified name의 `Attr.value`를 갱신하고, 속성이 없는 직접 helper 호출만 기존 namespace-aware 생성 경로를 사용한다.

```diff
   const all = doc.getElementsByTagName('*');
   for (let i = 0; i < all.length; i++) {
     const el = all[i];
     for (const attrName of el.getAttributeNames()) {
-      const lowered = attrName.toLowerCase();
-      if (!REF_ATTR_NAMES.has(lowered)) continue;
-
-      const value = readReferenceAttribute(el, attrName, lowered);
+      if (!isReferenceAttribute(el, attrName)) continue;
+
+      const value = readReferenceAttribute(el, attrName);
       if (value === null) continue;

       const classification = classifyFragmentReference(value);
       if (classification.kind === 'non-fragment') continue;
       if (classification.kind === 'external') {
         externalCount += 1;
         continue;
       }

       // internal
       const token = classification.token;
       if (!idSet.has(token)) {
         danglingCount += 1;
         continue;
       }
       const newId = rewrites.get(token);
       if (newId !== undefined) {
+        const lowered = attrName.toLowerCase();
         writeReferenceAttribute(el, attrName, lowered, `#${newId}`);
         rewrittenCount += 1;
       }
     }
   }
```

`lowered`는 실제로 쓰는 자리(`writeReferenceAttribute` 호출 직전)에서만 계산한다.

**`src/utils/svg-optimizer/collect-referenced-ids.internal.ts`**

```diff
 import {
   classifyFragmentReference,
-  REF_ATTR_NAMES,
-  readReferenceAttribute,
   rewriteFragmentReferences,
 } from '../prefix-svg-ids/reference-rewrite.internal';
+import { isReferenceAttribute, readReferenceAttribute } from '../svg-reference-attribute.internal';
```

```diff
     // href/xlink:href/src 형태(fragment 속성) — prefix-svg-ids 판정을 재사용한다.
     for (const attrName of el.getAttributeNames()) {
-      const lowered = attrName.toLowerCase();
-      if (!REF_ATTR_NAMES.has(lowered)) continue;
-      const value = readReferenceAttribute(el, attrName, lowered);
+      if (!isReferenceAttribute(el, attrName)) continue;
+      const value = readReferenceAttribute(el, attrName);
       if (value === null) continue;
       const classification = classifyFragmentReference(value);
       if (classification.kind === 'internal') {
         referenced.add(classification.token);
       }
     }
```

파일 상단 docblock의 "prefix-svg-ids의 판정 로직을 그대로 재사용해 네임스페이스까지 인지한다"는 문장도 "공유 leaf(`svg-reference-attribute.internal.ts`)의 판정을 재사용한다"로 고쳐 실제 소스와 맞춘다. `rewriteReferencedIds()`는 `rewriteFragmentReferences()`에 위임하므로 변경 없다.

## 테스트 계약

**신규 — `tests/unit/utils/svg-reference-attribute.test.ts`(신설):**

- `isReferenceAttribute`: `href`/`xlink:href`(표준 prefix)/`src`가 true, 무관한 속성(`fill`, `id`)이 false임을 검증.
- `isReferenceAttribute`: `xmlns:foo` + `foo:href`처럼 비표준 prefix로 선언된 xlink 참조도 true임을 검증(namespace 분리 후 localName 판정).
- `readReferenceAttribute`: `xlink:href`(표준 prefix)를 전달된 qualified name으로 읽음을 검증.
- `readReferenceAttribute`: 존재하지 않는 attribute에 `null`을 반환함을 검증.
- `isReferenceAttribute`: `xmlns:href` namespace 선언을 참조 속성으로 오탐하지 않음을 검증.
- `readReferenceAttribute`: `xlink` prefix가 재바인딩된 입력에서도 전달된 qualified name의 값을 읽음을 검증.
- `writeReferenceAttribute`: 같은 localName의 다른 namespace 속성을 보존하고 전달된 qualified name만 갱신함을 검증.

**신규 — `tests/security/strict-svg-sanitizer.test.ts`에 추가:**

- `xmlns:foo="http://example.test/foo"` + `<image foo:href="https://example.test/tracker.png"/>`를 `sanitizeSvgStrict()`에 넣으면 결과에 `foo:href`도 `tracker.png`도 남지 않음을 검증(비표준 prefix xlink 참조가 실제 enforcement 출력에서도 제거됨 — 이전에는 진단 API 경로만 커버돼 있었다).

**신규 — `tests/unit/utils/prefix-svg-ids-reference-rewrite.test.ts`에 추가(`describe('fragment reference rewrite — 비표준 prefix xlink')` 블록):**

- `xmlns:foo="http://example.test/foo"` + `<use foo:href="#a"/>`가 `prefixSvgIds()`에서 `#p-a`로 rewrite됨을 검증(`getAttributeNS`가 아니라 `getAttribute('foo:href')`로 읽어 비교 — `foo:href`는 표준 xlink 네임스페이스 조회 대상이 아니므로 리터럴 attribute 조회로 확인).

**신규 — `tests/unit/utils/svg-optimizer.test.ts`의 `describe('collectReferencedIds 내부 판정')`에 추가:**

- `xmlns:foo="http://example.test/foo"` + `<use foo:href="#sym3"/>`가 `collectReferencedIds()`에서 `sym3`을 참조로 잡음을 검증.
- 같은 입력에 `<defs><symbol id="sym3"/></defs>`를 추가하고 기본 옵션 `SvgOptimizer.optimize()`를 돌려 `id="sym3"`이 보존됨을 검증(end-to-end 회귀 — 이전에는 `removeUnusedDefs`가 미참조로 오판해 제거했다).

**기존 테스트 — 변경 없이 통과해야 함(회귀 확인 대상):**

- `tests/unit/utils/svg-inspection-dom-signals.test.ts`(`foo:href` 케이스, 이미 permissive였음을 재확인)
- `tests/unit/utils/inspect-svg-findings.test.ts`(`foo:href` 케이스)
- `tests/unit/utils/svg-inspection-contract.test.ts`의 REF-03(`xmlns:xl`/`xl:href` 케이스)
- `tests/unit/svg-sanitizer/inspect-sanitization-stages.test.ts`, `inspect-sanitization-embedded-images.test.ts`(`foo:href` 진단 stage 케이스)
- `tests/unit/utils/prefix-svg-ids-reference-rewrite.test.ts`, `prefix-svg-ids-reference-rewrite-helper.test.ts`의 기존 표준 `xlink:href` 케이스
- `tests/unit/utils/svg-optimizer.test.ts`의 기존 xlink 케이스(43-46, 158-169, 287-293, 356-372행)
- `tests/security/strict-svg-sanitizer.test.ts`, `tests/security/svg-sanitizer-core.test.ts`의 표준 `xlink:href` 케이스

## 문서 계약

- `CHANGELOG.md`(`sub/web-image-util/CHANGELOG.md`) `### 수정`에 추가:
  > Fixed: `prefixSvgIds()`와 `SvgOptimizer`가 비표준 prefix로 선언된 `xlink:href`(예: `xmlns:foo` + `foo:href`) 참조를 인식하지 못해 id rewrite를 건너뛰거나 참조 중인 `<defs>` 정의를 미참조로 오판해 삭제하던 문제를 수정합니다. 표준 `xmlns:xlink` prefix를 쓰는 입력의 동작은 바뀌지 않습니다.
- `docs/design/README.md` — 이 설계 문서를 색인에 추가.
- `CONTEXT.md`의 "SVG 보안" 섹션, "참조 판정" 항목 앞에 신규 용어 추가:
  > **참조 속성 (reference attribute)**:
  > SVG attribute 하나가 다른 요소·외부 자원에 대한 참조를 담는지 여부 — lowered 이름과 namespace 분리 후의 localName 양쪽으로 판정해 임의 prefix로 선언된 `xlink:href`(예: `xl:href`)도 잡는다. "그 참조가 위협인가"를 다루는 참조 판정보다 한 단계 앞선 구조적 사실이고, 판정 자체와는 무관하다. `svg-reference-attribute.internal.ts` 하나가 소유하며 두 집행 엔진, `svg-inspection` 신호 수집기, `prefix-svg-ids`, `svg-optimizer`가 공유한다.
  > _Avoid_: href 체크, xlink 속성 검사
- `docs/architecture.md` — 핵심 모듈 표가 다른 내부 leaf도 나열하므로 신규 단일 소유 leaf를 추가한다.
- `docs/maintenance-risks.md` — 이 결함은 추적 목록에 없었고 이번 카드로 완전히 해소되므로 갱신하지 않는다.

## 비범위

- `prefix-svg-ids`의 `writeReferenceAttribute()`를 2-arg로 단순화하는 것. 별개 축이라 이번 카드에서 다루지 않는다.
- `src/utils/svg-compatibility/attributes.internal.ts`의 독립 `XLINK_NAMESPACE` 통합. 참조 판정과 무관한 책임(네임스페이스 선언 삽입, legacy 마이그레이션)이고 import 관계도 없다.
- `svg-optimizer/collect-referenced-ids.internal.ts`의 presentation 속성(`url(#id)`) 판정 로직. 이번 카드는 fragment 속성(`href`/`xlink:href`/`src`) 판정만 다룬다.
- `enforce-dom-policy.internal.ts`/`warnings.internal.ts`의 `on*` 이벤트 핸들러 판정을 같은 방식으로 leaf화하는 것. 참조 판정과 다른 축이며 이번 조사에서 중복이 확인되지 않았다.

## 재검토 조건

- `writeReferenceAttribute()`가 같은 이유(호출자 precompute 불필요)로 정리 대상이 되려면, `prefix-svg-ids` 밖에 두 번째 write 소비자가 생기는 시점에 재검토한다.
- `svg-compatibility/attributes.internal.ts`가 나중에 실제로 참조 판정을 필요로 하는 방향으로 바뀌면(예: `src`도 인식해야 하는 요구), 그때 `svg-reference-attribute.internal.ts` 소비자로 편입한다.
