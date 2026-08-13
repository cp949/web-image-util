# SVG 경고 축을 참조 판정 소비자로 이관

상태: **구현됨** — 커밋 `f896ae8` (`refactor(svg-sanitizer): URI 경고 축을 참조 판정으로 이관한다`).

이 문서는 설계 확정 시점 기준으로 쓰였고, 구현이 그보다 먼저 커밋된 것을 나중에 알았다. 아래 「구현과의 차이」 절이 실제 코드와 다른 지점을 적는다. 나머지 본문은 설계 시점 기록으로 남긴다.

## 구현과의 차이

**명명이 반대다.** 이 문서는 경고를 **내는** 집합(`REMOVED_REFERENCE_REASONS`, 5종)을 명명하자고 했고, 구현은 경고를 **안 내는** 집합(`NON_WARNING_REFERENCE_REASONS`, 4종)을 명명하고 부정했다. 동작은 같다. 문서 쪽 의도는 `dom-signals`의 `COUNTED_REFERENCE_REASONS`와 같은 양성 집합 셋을 나란히 놓아 "답은 하나, 동작은 셋"을 코드로 읽히게 하는 것이었다. 지금 형태로도 축이 명시적이라는 목적은 달성됐다 — 바꿀 만큼의 이득은 없다.

**잔재 1건은 정리했다.** 이관 후 `src/svg-sanitizer/reference-policy.internal.ts`의 `isSafeInternalReference`가 프로덕션 호출처 0이 됐다. 유일한 소비자가 `tests/unit/svg-sanitizer/internal-policy-files.test.ts`의 import 스모크 테스트였다 — "이 파일에서 import할 수 있다"를 증명하려고 살아 있는 순환 정당화다. 형태가 이관 카드에서 삭제한 `isBlockedSvgPolicyRef`(한 줄 위임)와 같아 함께 삭제했다. `reference-policy.internal.ts`는 `sanitizeStrictUriValue`가 남아 파일 자체는 유지된다.

**테스트 파일 이름**이 문서의 `warnings-reference-axis.test.ts`가 아니라 `warnings-uri-axis.test.ts`다.

## 배경

`classifyUriRef(value, mode) → { verdict, reason }`이 참조 판정의 단일 소유자가 됐고(`2026-08-13-svg-uri-ref-verdict-design.md`), `CONTEXT.md`가 이를 「참조 판정」 도메인 용어로 올렸다. 그런데 소비자 하나가 이관되지 않은 채 남았다.

`src/svg-sanitizer/warnings.internal.ts`의 href 분기가 같은 질문을 술어 3개로 다시 조립한다.

```ts
!isSafeInternalReference(attribute.value) &&
!isSafeRasterDataImageRef(attribute.value) &&
!isSvgDataImageRef(attribute.value)
```

이관 카드의 축 인벤토리가 이 결합을 놓쳤다. `isSafeInternalReference` 경유만 보고 나머지 두 술어와의 AND를 못 봤다. 같은 카드가 인벤토리를 놓친 게 세 번째다 — 앞선 둘은 이관 카드의 「재검토 조건」에 기록돼 있다.

동작은 바뀐 게 없다. 문제는 `CONTEXT.md`가 "단일 판정"을 선언했는데 소비자 하나가 그것을 재조립한 채 남는다는 것이다.

## 결정

이 조립을 이름 붙은 reason 집합 검사로 바꾼다. `dom-signals.internal.ts`가 `COUNTED_REFERENCE_REASONS`로 취한 형태와 같다.

이관 자체보다 중요한 발견이 있다. 현재 면제 집합 `{internal-fragment, safe-raster-data, canonical-svg-data, nested-svg-data}`의 여집합은

```
{ empty, normalized-empty, boundary-quote, unsafe-data, external }
```

인데, 이건 **`sanitizeUriValue`의 `default → null` 분기와 같은 집합**이다. 경고 문구가 "외부 URI 참조 속성이 제거되었습니다"이므로 당연히 그래야 하는 관계인데, 술어 3개로 조립돼 있어 지금은 그 사실이 코드에서 보이지 않는다.

## 변경

`src/svg-sanitizer/warnings.internal.ts` 한 파일.

```ts
/**
 * sanitizer가 제거하는 참조의 근거.
 *
 * `sanitizeUriValue()`의 `default` 분기와 같은 집합이다 — 이 경고는 그 제거를 보고한다.
 * 다만 sanitizer는 reason 말고도 메커니즘 사유(재귀 깊이 초과, nested SVG 디코드 실패)로
 * 제거할 수 있으므로, 두 집합이 같은 것은 **reason 수준에서**다.
 */
const REMOVED_REFERENCE_REASONS: ReadonlySet<UriRefReason> = new Set<UriRefReason>([
  'empty',
  'normalized-empty',
  'boundary-quote',
  'unsafe-data',
  'external',
]);
```

href 분기는 `REMOVED_REFERENCE_REASONS.has(classifyUriRef(attribute.value, 'strict').reason)` 하나가 된다. 모드는 `'strict'`다 — 구 `isSafeInternalReference`가 strict였다.

`isSafeInternalReference`·`isSafeRasterDataImageRef`·`isSvgDataImageRef` import 3개가 이 파일에서 빠진다. `isSafeInternalReference`는 다른 호출처가 없으므로 `reference-policy.internal.ts`에서 함께 삭제할지 검토한다.

이관하면 이름 붙은 reason 집합이 셋이 되어, 이관 카드가 표로만 적었던 "답은 하나, 동작은 셋"이 코드로 읽힌다.

| 소비자 | 집합 | 크기 |
| --- | --- | --- |
| dom-signals (진단 집계) | `COUNTED_REFERENCE_REASONS` | 3 |
| warnings (제거 보고) | `REMOVED_REFERENCE_REASONS` | 5 |
| intake guard (거부) | `verdict === 'threat'` | 4 |

## 테스트 계약

이관 **전에** 특성화 표를 깐다. 순수 리팩터이므로 red 단계가 없고, 기댓값은 손으로 쓰지 않고 실행 결과로 고정한다.

`tests/unit/svg-sanitizer/warnings-reference-axis.test.ts` (신설) — `svg-threat-policy-uri-axes.test.ts`와 같은 코퍼스 입력을 쓰되 `collectInputPolicyWarnings`로 구동해 `'외부 URI 참조 속성이 제거되었습니다.'` 발생 여부를 고정한다. `collectInputPolicyWarnings`가 이미 export되어 있으므로 export를 늘리지 않는다.

등가성은 설계 단계에서 reason 9종을 현재 술어 3개 조합에 대입해 전건 일치를 확인했다. 상한 초과 `data:image/svg+xml`이 `nested-svg-data`로 면제되어 무경고인 것까지 양쪽이 같다.

## 비범위

- **8번째 축** — `src/svg-sanitizer/inspect-sanitization/stage-collectors.internal.ts`의 `collectEmbeddedImageStages`. `data:` 값을 `nested-svg-resanitized` / `data-image-preserved` / `data-image-blocked`로 가르는데, `classifyUriRef`가 만들지 않는 구분(디코드 가능 여부)을 요구한다. `data:image/svg+xml`이면서 `decodeSvgDataImageRef`가 null인 값을 이 축은 blocked로 세지만 classify는 `nested-svg-data` 하나로 묶는다. 디코드 가능성은 판정이 아니라 재귀 메커니즘의 사실이라 `sanitizeUriValue`에 남겼다. 이 축을 흡수하려면 인터페이스가 바뀌므로 별도 설계가 필요하다.
- 공개 warning 문자열 3종. `sanitizeSvgStrictDetailed`의 출력이다.
- `tests/unit/svg-sanitizer/postprocess.test.ts`의 warning 문자열 단언.
- 상한 초과 `data:image/svg+xml`의 무경고 제거 — 선행 이슈이고 이 카드가 바꾸지 않는다. 별도로 다룰 값어치가 있다.

## 재검토 조건

- 특성화 표가 현재 동작과 어긋나는 입력을 하나라도 드러내면 등가성 주장이 틀린 것이다. 표가 정답이고 이 문서가 가설이다.
- `isSafeInternalReference`를 삭제했는데 다른 호출처가 나타나면 인벤토리를 네 번째로 놓친 것이다. 삭제 전에 grep으로 고정한다.
- 세 reason 집합이 나란히 놓였을 때 차이가 설명되지 않는 원소가 있으면, 그건 발산이 의도가 아니라 사고였다는 뜻이다.
