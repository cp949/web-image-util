# SVG 참조 판정 인터페이스 설계

## 배경

`CONTEXT.md`는 위협 정책을 "SVG에서 무엇이 위험한 참조·요소·속성인가에 대한 판정 규칙의 단일 소유자"로 정의한다. 실제로는 참조 하나를 두고 판정이 여섯 축으로 흩어져 있고, 같은 입력에 서로 다른 답을 준다.

| 축 | 위치 | 소비자 |
| --- | --- | --- |
| `isAllowedUri(value, mode)` | `src/utils/svg-threat-policy.internal.ts:54` | `sanitizeUriValue` 내부, `src/svg-sanitizer/reference-policy.internal.ts:26` → `warnings.internal.ts:63` |
| `sanitizeUriValue(value, mode, depth, cb)` | 같은 파일 `:89` | lightweight `src/utils/svg-sanitizer.ts:47`, strict `reference-policy.internal.ts:49` |
| `isBlockedPipelineUriRef(ref)` | 같은 파일 `:123` | `src/core/source-converter/url/policy.internal.ts:108` → `svg/safety.internal.ts:170`·`:223`, `src/utils/svg-inspection/dom-signals.internal.ts:26` |
| `isRemovedSvgReference(value)` | `dom-signals.internal.ts:23` | 모듈 private |
| `assertSafeSvgContent(svg)` | `src/core/source-converter/svg/safety.internal.ts:197` | `svg/loader.internal.ts:99` |
| `getCssPolicyValueVariants(v).some(isBlockedPipelineUriRef)` | `src/utils/svg-inspection/dom-analysis.internal.ts:151`·`:161`·`:173` | 진단 |

`<image href="">` 하나가 세 답을 받는다.

- `isAllowedUri('')` → `false`, `sanitizeUriValue('')` → `null` — 제거한다
- `isBlockedPipelineUriRef('')` → `false` — 허용한다
- `isRemovedSvgReference('')` → `true` — 제거로 집계한다
- `assertSafeSvgContent` — 빈 `refValue`가 `refValue &&`에서 걸러져 허용한다

정규화도 네 벌이다. strict는 `trim()`, lightweight와 intake guard는 `normalizePolicyValue()`, dom-signals는 `isDataURLString()` 선제외, dom-analysis는 `getCssPolicyValueVariants()` 전개.

이 발산은 전부 산문 주석에 의도로 기록되어 있다(`svg-threat-policy.internal.ts:44-45`·`:113-118`, `dom-signals.internal.ts:18-21`, `dom-analysis.internal.ts:123-127`). 문제는 drift가 조용한 것이 아니라 **타입이 아무것도 강제하지 않는 것**이다. 축이 어긋났는지 확인할 곳이 인터페이스가 아니라 동치성 코퍼스(`tests/unit/utils/svg-inspection-axis-alignment.test.ts`, 66케이스)뿐이다.

CSS 정책에도 같은 모양의 중복이 있다. 위협 정책의 위험 구문 정규식이 진단 수집기에 verbatim으로 복사되어 있다 — 탐지 6개(`svg-threat-policy.internal.ts:196-201` ≡ `css-signals.internal.ts:65-70`)와 제거 3개(`:208-211` ≡ `:36-51`). 한쪽은 제거하고 한쪽은 센다.

## 결정

참조 판정을 **이유 코드를 돌려주는 함수 하나**로 모은다. "제거 / 거부 / 집계"는 소비자 쪽 동작으로만 남는다. CSS 위험 구문은 탐지와 제거를 한 항목이 소유하는 테이블 1벌로 모은다.

이 결정은 `src/utils/image-decode.internal.ts`가 디코드에 취한 형태와 같다. 정책은 모듈이 소유하고, 갈리는 부분만 소비자에게 남긴다.

## 판정 계약

`src/utils/svg-threat-policy.internal.ts`에 둔다.

```ts
export type UriRefReason =
  | 'internal-fragment'   // 정규화 후 #id
  | 'empty'               // 원본 trim이 빈 값
  | 'normalized-empty'    // 원본은 비지 않으나 정규화하면 빈 값 (엔티티 공백·제어문자·따옴표 단독)
  | 'boundary-quote'      // 경계 따옴표/백슬래시로 시작
  | 'safe-raster-data'    // 상한 이내 허용 MIME data:image/*
  | 'canonical-svg-data'  // sanitizer가 emit한 base64 data:image/svg+xml
  | 'nested-svg-data'     // 그 외 data:image/svg+xml — 재귀 정제 대상
  | 'unsafe-data'         // 나머지 data: (비허용 MIME·상한 초과·파싱 실패)
  | 'external';           // 상대 경로·명시 스킴·기타

export interface UriRefVerdict {
  /** 위협 여부. "허용 여부"가 아니다 — 소비자 동작은 reason이 정한다. */
  verdict: 'threat' | 'no-threat';
  reason: UriRefReason;
}

export function classifyUriRef(value: string, mode: SvgThreatPolicyMode): UriRefVerdict;
```

`verdict`를 **위협 여부**로 정의한다. "허용 여부"로 두면 `empty`에서 즉시 모순난다 — sanitizer는 제거하고 intake guard는 허용한다. 위협 축에서는 `empty`가 `no-threat`이고, sanitizer의 제거는 위협 대응이 아니라 위생 동작이다. `:113-115` 주석이 말하는 바와 같다.

`data:` 계열 reason의 분기는 **원본 값 기준 `isDataURLString(value)`**에 건다. 소비자마다 감지 형태가 다르기 때문이다 — dom-signals는 원본, intake guard는 정규화값, 세 data 술어는 `parseSvgDataUrlRef(value.trim())`을 쓴다. `&#100;ata:image/png;base64,…`는 원본 기준 `false`, 정규화 기준 `true`다. 정규화 기준으로 통일하면 dom-signals의 집계가 조용히 바뀐다. 원본 기준을 택하고, 정규화는 non-data 축에만 쓴다.

빈 값도 두 갈래다. `&#32;`는 `value.trim()`으로는 비지 않고 `normalizePolicyValue(value)`로는 빈다. dom-signals는 원본 trim 기준이라 세지 않고, intake guard는 정규화 기준이라 허용한다. reason 하나로 묶으면 dom-signals 집계가 바뀌므로 `empty`(원본 trim)와 `normalized-empty`(정규화)로 가른다.

### 검사 순서

순서가 계약의 일부다. `isBlockedPipelineUriRef`가 빈 값 검사를 경계 따옴표보다 먼저 하므로 `&quot;`(따옴표 단독)는 오늘 허용된다. 이 순서를 그대로 옮긴다.

```ts
export function classifyUriRef(value: string, mode: SvgThreatPolicyMode): UriRefVerdict {
  // 1. data: 계열 — 원본 값 기준으로 가른다 (dom-signals의 감지 형태)
  if (isDataURLString(value)) {
    if (isSafeRasterDataImageRef(value)) return { verdict: 'no-threat', reason: 'safe-raster-data' };
    if (isSanitizedSvgDataImageRef(value)) return { verdict: 'no-threat', reason: 'canonical-svg-data' };
    if (isSvgDataImageRef(value)) return { verdict: 'threat', reason: 'nested-svg-data' };
    return { verdict: 'threat', reason: 'unsafe-data' };
  }
  // 2~3. 빈 값 — 경계 따옴표보다 먼저다
  if (value.trim() === '') return { verdict: 'no-threat', reason: 'empty' };
  if (normalizePolicyValue(value) === '') return { verdict: 'no-threat', reason: 'normalized-empty' };
  // 4. 경계 따옴표
  if (startsWithPolicyBoundaryQuote(value)) return { verdict: 'threat', reason: 'boundary-quote' };
  // 5~6. 모드별 정규화 후 fragment 판정
  const normalized = mode === 'strict' ? value.trim() : normalizePolicyValue(value);
  if (normalized.startsWith('#')) return { verdict: 'no-threat', reason: 'internal-fragment' };
  return { verdict: 'threat', reason: 'external' };
}
```

reason은 모드에 따라 갈릴 수 있다. `&#35;frag`는 strict에서 `external`, lightweight에서 `internal-fragment`다 — strict가 문자참조를 디코드하지 않기 때문이다. verdict도 함께 갈린다. 오늘 `isAllowedUri`의 모드별 답과 같다.

이 구현은 코퍼스 38행 × 6축(228건)에 대해 현재 동작과 불일치 0으로 검증했다.

## 소비자 매핑

| reason | verdict | `sanitizeUriValue` | intake guard | dom-signals | dom-analysis |
| --- | --- | --- | --- | --- | --- |
| `internal-fragment` | no-threat | 보존 | 허용 | skip | skip |
| `empty` | no-threat | **제거** | 허용 | **집계** | skip |
| `normalized-empty` | no-threat | **제거** | 허용 | skip | skip |
| `safe-raster-data` | no-threat | 보존 | 허용 | skip | skip |
| `canonical-svg-data` | no-threat | 재귀 정제 | 허용 | skip | skip |
| `nested-svg-data` | **threat** | **재귀 정제** | 거부 | skip | 집계 |
| `unsafe-data` | threat | 제거 | 거부 | skip | 집계 |
| `boundary-quote` | threat | 제거 | 거부 | 집계 | 집계 |
| `external` | threat | 제거 | 거부 | 집계 | 집계 |

굵은 칸이 "답은 하나, 동작은 셋"이다. `empty`는 위협이 아닌데 sanitizer만 제거하고, `nested-svg-data`는 위협인데 sanitizer만 재귀 정제로 무해화한다. 지금은 술어 다섯에 흩어져 주석으로만 남은 사실이 표 하나로 읽힌다.

부수 효과로 strict 모드에도 `boundary-quote` 판정이 생긴다. 경계 따옴표로 시작하는 값은 `#`로 시작할 수 없으므로 오늘 strict에서 이미 전부 `external`이다. verdict는 불변이고 reason만 정밀해진다.

`sanitizeUriValue`는 남는다. 판정이 아니라 값 변환(재귀 정제·재인코딩)이므로 집행 소비자로 재작성한다. `MAX_NESTED_SVG_DEPTH` 깊이 검사와 디코드 실패 시 fail-closed는 이 함수에 그대로 둔다 — 판정이 아니라 재귀 메커니즘의 일부다.

## CSS 구문 테이블

```ts
/** CSS 위험 구문 1건. 탐지와 제거를 한 항목이 소유한다. */
interface DangerousCssConstruct {
  code: 'at-import' | 'image-set' | 'expression' | 'moz-binding';
  /** 존재 탐지 — /g 없음(lastIndex 상태 없음) */
  detect: RegExp;
  /** 값 단위 제거 — /g lastIndex 공유를 피해 팩토리 */
  createStripPattern(): RegExp;
}

/** 배열 순서가 곧 제거 순서다. 두 소비자가 같은 순서를 쓴다. */
export const DANGEROUS_CSS_CONSTRUCTS: readonly DangerousCssConstruct[];

/** CSS escape 디코드 프로브 — 디코드 결과와 위험 노출 여부를 함께 준다. */
export function probeDecodedCss(css: string): { decoded: string; revealsDangerous: boolean };
```

두 소비자는 같은 테이블을 같은 순서로 순회하고 동작만 다르다. `sanitizeCssValue`는 `replace(pattern, '')`로 제거하고, `countCssPolicyTriggersInPlainCss`는 replacer에서 센다. 현재 두 파일의 제거 순서가 `@import` → `image-set` → `expression` → `-moz-binding`로 동일함을 확인했으므로 배열 1벌이 양쪽을 그대로 재현한다.

`probeDecodedCss`가 디코드 결과를 함께 돌려주는 이유는 진단 쪽이 디코드된 문자열로 다시 세기 때문이다(`css-signals.internal.ts:73`).

## 이관표

기준: `main` @ `2909496`. 첫 파일을 수정하면 뒤 줄 번호가 밀린다. **위치는 함수 이름으로 다시 찾는다.**

| 파일 | 변경 |
| --- | --- |
| `src/utils/svg-threat-policy.internal.ts` | `classifyUriRef` 신설. `isAllowedUri`·`isBlockedPipelineUriRef` 흡수 삭제. `sanitizeUriValue`를 reason 스위치로 재작성. `DANGEROUS_CSS_CONSTRUCTS`·`probeDecodedCss` 신설, 인라인 정규식 9개 대체 |
| `src/utils/svg-inspection/dom-signals.internal.ts` | `isRemovedSvgReference` 삭제, reason 집합 판정으로 대체 |
| `src/utils/svg-inspection/dom-analysis.internal.ts` | 3곳을 `variants.some(v => classifyUriRef(v, 'lightweight').verdict === 'threat')`로 전환 |
| `src/utils/svg-inspection/css-signals.internal.ts` | 탐지·제거 정규식 사본 삭제, 테이블·`probeDecodedCss` 소비로 전환 |
| `src/core/source-converter/url/policy.internal.ts` | `isBlockedSvgPolicyRef` 삭제 — `isBlockedPipelineUriRef` 한 줄 위임인 얇은 래퍼다 |
| `src/core/source-converter/svg/safety.internal.ts` | 2곳을 `classifyUriRef` 직접 호출로 전환 |
| `src/svg-sanitizer/reference-policy.internal.ts` | `isSafeInternalReference`를 `classifyUriRef(v, 'strict').reason === 'internal-fragment'`로 재작성 |
| `src/utils/svg-sanitizer.ts` | `sanitizeUriValue` 호출은 유지 — 계약 불변 |
| `CONTEXT.md` | 도메인 용어 「참조 판정」·「이유 코드」 추가 |
| `docs/design/README.md` | 현재 기록에 이 문서 추가 |

## 테스트 계약

이관 전에 **특성화 표**로 현재 답을 고정한다. 순수 리팩터이므로 red 단계가 없다. 기댓값은 손으로 쓰지 않고 실행 결과를 확인한 뒤 고정한다.

`tests/unit/utils/svg-threat-policy-uri-axes.test.ts` (신설) — 코퍼스 38항목 × 6축.

```ts
type UriAxes = {
  allowedStrict: boolean;              // isAllowedUri(v, 'strict')
  allowedLightweight: boolean;         // isAllowedUri(v, 'lightweight')
  sanitizedStrict: string | null;      // sanitizeUriValue(v, 'strict', 0, passthrough)
  sanitizedLightweight: string | null;
  blockedPipeline: boolean;            // isBlockedPipelineUriRef(v)
  domSignalCounted: boolean;           // collectSvgDomSecuritySignals 경유 externalHrefCount
};
```

`isRemovedSvgReference`는 모듈 private다. export를 늘리지 않고 `collectSvgDomSecuritySignals(doc)`로 구동해 pin한다 — 기존 `svg-inspection-dom-signals.test.ts`와 같은 방식이다.

코퍼스는 reason 9종을 각각 최소 2개씩 덮고, 설계 단계에서 확인한 함정 4종을 반드시 포함한다.

| 입력 | 왜 함정인가 |
| --- | --- |
| `&#100;ata:image/png;base64,iVBORw0KGgo=` | 원본 기준 `data:` 아님, 정규화 기준 맞음 → `external` |
| `"data:image/png;base64,iVBORw0KGgo="` | 따옴표가 `isDataURLString`을 깨뜨려 data 분기를 타지 않음 → `boundary-quote` |
| `&#32;` | `trim()`으론 비지 않고 정규화하면 빔 → `normalized-empty`, dom-signals 미집계 |
| `&quot;` | 경계 따옴표지만 빈 값 검사가 먼저라 허용 → `normalized-empty` |

`tests/unit/utils/svg-threat-policy-css-axes.test.ts` (신설) — `[css, sanitizeCssValue(css), collectSvgCssReferenceSignals 경유 externalCssCount]`. escape 디코드 케이스(`\75rl(...)`), 위험 구문 4종 각각, 순서 의존 조합.

기존 `tests/unit/utils/svg-inspection-axis-alignment.test.ts`는 그대로 둔다. 두 API 간 정합을 검사하는 테스트이고, 특성화 표는 판정 값 자체를 pin한다 — 역할이 다르다.

`tests/unit/utils/svg-threat-policy.test.ts`는 삭제된 술어 단언을 `classifyUriRef` 단언으로 재작성한다. warning 문자열 매칭이 아니라 이유 코드로 단언한다.

## 문서 계약

`CONTEXT.md`의 「SVG 보안」 절에 도메인 용어 2개를 추가한다.

- **참조 판정 (uri ref verdict)**: SVG 참조 하나가 위협인지와 그 이유를 돌려주는 단일 판정. 집행 엔진·진단 수집기·intake guard는 같은 판정을 받고 자기 동작만 고른다.
- **이유 코드 (reason code)**: 판정이 갈린 근거를 나타내는 닫힌 집합. 소비자별 동작 차이는 이 코드에 대한 매핑으로만 표현한다.

`SVG-SECURITY.md`가 술어 이름을 참조하는지 확인하고 필요하면 갱신한다.

## 비범위

- 공개 warning 문자열 3종(`'외부 URI 참조 속성이 제거되었습니다.'` 등) 변경. `sanitizeSvgStrictDetailed`의 출력이고 `tests/unit/svg-sanitizer/postprocess.test.ts`가 단언한다.
- `inspectSvg` finding 코드와 `inspectSvgSanitization` stage 코드 변경.
- 소비자 간 발산 자체의 수정. 표의 굵은 칸은 현재 동작 그대로 보존한다. 특성화 표 작성 중 미문서화 발산이 드러나면 고치지 않고 보고한다.
- `svg-threat-policy.internal.ts` 파일 분할. 313줄 → 약 370줄로 예상되며 기존 주석 배너 3개(URI / CSS / 요소·속성)가 경계를 나눈다. 450줄을 넘으면 그때 분리한다.
- 요소·속성 정책(`FORBIDDEN_SVG_ELEMENT_NAMES`, `isEventHandlerAttributeName`, `stripDoctypeAndEntityDeclarations`) 변경.

## 재검토 조건

- 특성화 표가 소비자 매핑 표와 어긋나는 항목을 하나라도 드러내면 매핑 표를 먼저 고치고 설계를 다시 읽는다. 표가 정답이고 이 문서가 가설이다.
- reason 9종으로 모든 소비자를 재현할 수 없으면 코드를 늘리기 전에 축이 하나 더 있는지 의심한다. 착수 시 5축으로 셌으나 실사에서 `dom-analysis`의 변형 전개 축이 더 있어 6축이었다. CSS 정규식도 6개로 셌으나 제거 계열 3개가 더 있었다. reason도 8종으로 설계했다가 실측에서 `empty` 분할이 필요해 9종이 됐다.
- `verdict`를 읽는 소비자가 없고 전부 `reason`만 스위치하면 `verdict` 필드를 삭제한다.
