# SVG sanitizer 보안 정책

이 문서는 `@cp949/web-image-util`의 `svgSanitizer` 옵션과 관련 API가 SVG 입력에 대해 무엇을 처리하고, 무엇을 처리하지 않는지 정리합니다. 정책은 `processImage(source, options)`가 입력을 SVG로 판정한 경우에만 적용되며, PNG/JPEG/WebP 등 비-SVG 입력에는 영향을 주지 않습니다.

## 빠른 선택

| 상황 | 옵션 |
| --- | --- |
| 사용자 업로드, 외부 URL 등 신뢰 경계 밖의 SVG | `svgSanitizer: 'strict'` |
| 앱 내부에서 만든 신뢰 가능한 SVG | `svgSanitizer: 'lightweight'` (기본값) |
| 호출처가 이미 자체 정제를 끝낸 SVG | `svgSanitizer: 'skip'` |
| 개발/디버깅 (신뢰 가능한 SVG 한정, 프로덕션 금지) | `unsafe_processImage()` |

```ts
import { processImage } from '@cp949/web-image-util';

await processImage(userProvidedSource, { svgSanitizer: 'strict' }).toBlob();
```

정책 적용 결과를 미리 보고 싶다면 `@cp949/web-image-util/svg-sanitizer`의 `inspectSvgSanitization()`을 사용합니다(보안 경계가 아닌 진단 API).

## 왜 항상 `strict`가 기본값이 아닌가?

기본값은 "모든 SVG를 가장 강하게 정제"가 아니라 "기존 SVG 렌더링을 깨지 않게 다룸"입니다.

- **렌더링 보존성**: `strict`는 내부 프래그먼트가 아닌 `href`/`src`를 보수적으로 제거합니다. 아이콘, 필터, 패턴, 이미지 참조를 활용하는 정상 SVG도 결과가 달라질 수 있습니다.
- **성능과 번들**: `strict`는 DOMPurify, DOMParser, XMLSerializer를 동적으로 불러옵니다. 기본 경로(`lightweight`)는 이를 top-level로 끌어오지 않습니다.
- **역할 분리**: 이 패키지는 이미지 처리 라이브러리입니다. 신뢰 경계 판단은 호출처가 명시적으로 하도록 설계했습니다.

운영 기준: **신뢰 경계 밖 입력은 항상 `strict`**, 신뢰 가능한 내부 에셋은 기본 `lightweight`.

## 금지 사용처

옵션과 API의 사용 가능 / 금지 시나리오를 한 표에 모읍니다. 본 표가 단일 출처이며 README와 `docs/architecture.md`는 이 섹션을 링크로만 가리킵니다.

| API / 옵션 | 사용 가능 | 금지 | 사유 |
| --- | --- | --- | --- |
| `svgSanitizer: 'strict'` | 신뢰 경계 밖의 모든 입력 | 없음 | DOMPurify SVG 프로필 + 라이브러리 강제 정책 |
| `svgSanitizer: 'lightweight'` (기본값) | 앱 내부 신뢰 가능한 SVG, 빠른 처리 경로 | 사용자 업로드, 외부 URL 등 신뢰 경계 밖 | 경량 방어층이며 DOM 기반 완전 sanitizer가 아님 |
| `svgSanitizer: 'skip'` | 호출처가 자체 정제를 끝낸 SVG, 호환성 보정만 필요한 내부 에셋 | 신뢰 경계 밖의 입력 | sanitizer/assert를 건너뛰므로 신뢰 불가 입력에 쓰면 보안 우회 |
| `unsafe_processImage()` | 개발/디버깅, 신뢰 가능한 SVG에 한정 | 프로덕션 사용자에게 노출되는 모든 경로 | 경량 방어층과 호환성 보정을 모두 건너뜀. `svgSanitizer` 옵션은 적용 불가 |

각 옵션의 세부 동작은 아래 "옵션별 책임 범위"를, `unsafe_processImage()`는 별도 섹션을 참고합니다.

## 옵션별 책임 범위

### `lightweight`

렌더링 파이프라인을 보호하기 위한 경량 방어층입니다. 정규식 기반으로 위험 패턴을 제거하고, 제거 후에도 위험 참조가 남으면 `INVALID_SOURCE`로 차단합니다.

처리:

- `<script>`, `<foreignObject>`, `on*` 이벤트 핸들러 속성 제거
- `href`/`xlink:href`/`src`의 `http:`, `https:`, `//`, 비이미지 `data:`, `javascript:` 참조 제거
- `data:image/png|jpeg|webp`는 크기 제한 안에서 보존, `data:image/svg+xml`은 nested SVG를 같은 정책으로 재정제 후 보존
- `style` 속성과 `<style>` 본문의 외부 `url(...)` 제거, CSS escape/문자 참조 우회 패턴 처리(아래 "CSS escape 우회 처리" 참조)
- 정제 후 잔여 외부 참조(`./`, `../`, `/`, 외부 URL) 차단
- 원본/정제 후 SVG 크기 제한, 브라우저 호환성 보정 유지

처리하지 않음:

- DOM 기반의 완전한 sanitizer 역할, 모든 우회 기법/브라우저별 파서 차이까지 포괄하는 보장
- DOCTYPE/ENTITY 정제, 정제 후 노드 개수 제한
- 중첩 깊이, `viewBox`/좌표 상한, 순환 참조, SMIL 분석
- 메타데이터 제거, 접근성/다크모드/RTL/Retina 보정

### `strict`

신뢰할 수 없는 SVG를 위한 opt-in 경로입니다. DOMPurify SVG 프로필을 동적으로 불러와 정제하고, 라이브러리 강제 정책을 후처리로 적용합니다.

처리:

- DOMPurify SVG 프로필(`svg`, `svgFilters`) 정제 + `<script>`, `<foreignObject>`, `on*` 강제 제거
- `href`/`xlink:href`/`src`는 `#id` 내부 프래그먼트와 크기 제한을 통과한 `data:image/*`만 보존
- `data:image/svg+xml`은 nested SVG sanitizer를 재귀 적용
- CSS 외부 참조 제거: `url(...)`, `image-set(...)`, `@import`, `expression(...)`, `-moz-binding`. CSS escape로 숨긴 위험 패턴도 보수적으로 제거
- BOM, XML 선언, HTML 주석, DOCTYPE/ENTITY 제거(XXE/XML bomb 위험 완화)
- 입력 바이트 크기 제한, 정제 후 자손 Element 노드 개수 제한
- `@cp949/web-image-util/svg-sanitizer`의 `removeMetadata: true`에서 `<metadata>` 제거
- `sanitizeSvgStrictDetailed()`는 라이브러리가 적용한 사전/후처리 경고 반환

처리하지 않음:

- SVG 보안을 완전히 보장하는 만능 필터
- 중첩 깊이, `viewBox`/좌표 상한, SMIL 분석, `<use>`/`<filter>`/`<pattern>` 순환 참조 감지
- 접근성/다크모드/RTL/Retina 보정, SVGO 최적화, DOMPurify 내부 `removed` 배열 노출

#### strict 정책을 완화하는 DOMPurify 설정은 무시됨

`domPurifyConfig`로 전달해도 라이브러리가 강제하는 strict 정책을 우회할 수 없습니다. 다음 설정은 무시되며 `warnings`에 기록됩니다.

- `ALLOWED_TAGS`, `ALLOWED_ATTR`
- `ADD_TAGS`, `ADD_ATTR`, `ADD_DATA_URI_TAGS`, `ADD_URI_SAFE_ATTR`
- `ALLOW_UNKNOWN_PROTOCOLS`, `ALLOWED_URI_REGEXP`, `CUSTOM_ELEMENT_HANDLING`
- `USE_PROFILES`, `SAFE_FOR_TEMPLATES`, `SAFE_FOR_XML`, `WHOLE_DOCUMENT`
- `RETURN_DOM`, `RETURN_DOM_FRAGMENT`, `RETURN_TRUSTED_TYPE`, `IN_PLACE`, `KEEP_CONTENT`

`FORBID_TAGS`와 `FORBID_ATTR`는 사용자 값과 라이브러리 강제 값(`script`, `foreignObject`, `on*`)이 union 머지됩니다.

### `skip`

호출처가 이미 자체 정제를 끝낸 SVG를 위한 escape hatch입니다. sanitizer/assert를 건너뛰고 브라우저 호환성 보정과 최종 SVG 크기 제한만 유지합니다. **신뢰할 수 없는 SVG에는 사용하지 마세요.**

## embedded image 정책

SVG 본문 안의 `<image>`/`<use>`가 `data:` URL로 raster 또는 nested SVG를 포함할 때, `lightweight`와 `strict`는 동일한 MIME 분기를 적용합니다.

| `data:` MIME | 처리 |
| --- | --- |
| `data:image/png`, `data:image/jpeg`, `data:image/webp` | 크기 제한 안에서 보존 |
| `data:image/svg+xml` | nested SVG를 같은 정책으로 재귀 정제 후 보존 |
| 그 외 raster MIME (`gif`, `bmp` 등), 비이미지 `data:` | 제거 |

nested SVG 재정제에서 byte cap 초과 또는 parse 실패가 발생하면 nested SVG가 제거되며, 정제 후 외부 참조가 남으면 입력 전체가 `INVALID_SOURCE`로 차단됩니다. Fabric.js, Illustrator, Figma export 같은 정상 사용 사례를 깨지 않으려는 정책입니다.

## `unsafe_processImage()`

`processImage()`와 같은 체이닝 API를 제공하지만 SVG sanitizer/assert와 브라우저 호환성 보정을 모두 우회해 원본 SVG를 그대로 로딩합니다. **개발/디버깅 전용**이며, `<script>`, `on*`, 외부 `href`/`src`, 외부 CSS URL이 그대로 통과되어 XSS와 canvas taint 위험이 발생합니다.

- `svgSanitizer: 'skip'`과 다릅니다. `skip`은 sanitizer/assert만 건너뛰고 호환성 보정은 유지하지만, `unsafe_processImage()`는 호환성 보정까지 우회합니다.
- `unsafe_processImage()`에는 `svgSanitizer` 옵션을 적용할 수 없습니다. sanitizer 정책이 필요하면 `processImage()`를 사용하세요.
- 브라우저의 CORS/tainted canvas 모델과 SVG 크기 제한은 이 경로에서도 유지됩니다.

신뢰할 수 없는 입력에는 `processImage(source, { svgSanitizer: 'strict' })`, 자체 정제를 끝낸 입력에 호환성 보정만 받으려면 `processImage(source, { svgSanitizer: 'skip' })`을 사용하세요.

## 진단 / 정규화 유틸리티

다음 API들은 **sanitizer를 실행하지 않으며 보안 경계가 아닙니다.** 신뢰할 수 없는 입력은 별도로 `svgSanitizer: 'strict'`로 정제한 뒤 사용해야 합니다.

- **`prefixSvgIds(svg, prefix)`**: SVG의 `id`와 fragment reference를 일괄 prefix하는 정규화 유틸리티. `<style>` 요소 또는 `style` 속성이 있으면 rewrite를 전면 보류하고(`deoptimized: true`) 원본 SVG를 그대로 반환합니다.
- **`inspectSvgSource(input)`**: `string | Blob | File | URL` 입력의 source 종류(SVG/비-SVG/불명)를 진단. `fetch: 'body'` 모드는 byte cap과 abort/timeout guard 위에서 응답 본문을 **1회만** 소비합니다(`report.source.consumed`로 확인). `report.source.url`은 origin+path까지만 노출되며 query/fragment, base64 payload는 마스킹됩니다.
- **`inspectSvg(svg)`**: SVG 문자열을 부수효과 없이 진단.
- **`inspectSvgSanitization(svg, mode)`**: 정책 적용 시 어떤 stage가 발동(또는 발동할)했는지 진단. `lightweight`/`strict`는 실제 실행, `skip`은 lightweight 시뮬레이션 결과를 `potentialStages`로 노출합니다. 보고서에는 SVG 원문, Data URL payload, 외부 URL 원본을 담지 않고 `samples`는 tagName/attrName/고정 토큰/MIME만 stage당 최대 3개, 항목당 32자 이내로 노출합니다. strict 실행 실패는 throw 대신 `impact.status === 'failed'` + `failure.code`로 보고됩니다. `@cp949/web-image-util/svg-sanitizer`에서 import합니다.

`inspectSvg()`와 `inspectSvgSanitization()`은 happy-dom과 실제 브라우저의 DOM 파싱 차이가 `report.environment` 필드(`'happy-dom'` 또는 `'browser'`)에 드러납니다.

## 입력 형태별 적용 범위

`strict`와 `lightweight`는 SVG로 확인된 다음 입력에 적용됩니다. 비-SVG URL은 sanitizer 경로를 타지 않습니다.

| 입력 형태 | 적용 방식 |
| --- | --- |
| 인라인 SVG 문자열 | 문자열이 실제 SVG 루트인지 판정 후 적용 |
| SVG Data URL | 디코딩 후 SVG 확인되면 적용 |
| 원격 `.svg` URL, `image/svg+xml`/`text/xml`/`application/xml` 응답 | 본문이 실제 SVG이면 적용 |
| Blob/File | MIME, 파일명, 내용 스니핑으로 SVG 확인 후 적용 |
| Blob URL | fetch로 본문을 읽어 SVG 확인 후 적용 |
| ArrayBuffer/Uint8Array | 텍스트로 해석 가능한 SVG이면 적용 |

## 일반 SVG 보안 요구사항과 현재 상태

서비스 보안 정책에 따라 서버 측 검증, CSP, 업로드 제한, 별도 보안 리뷰는 라이브러리와 무관하게 추가해야 할 수 있습니다.

| 요구사항 | 현재 상태 |
| --- | --- |
| 확장자가 아닌 내용으로 SVG 여부 판단 | 제공 |
| `<script>`, `on*`, `<foreignObject>` 제거 | `lightweight`, `strict` 제공 |
| 외부 `href`/`src` 참조 차단 | `lightweight`는 잔여 위험 참조 차단, `strict`는 내부 프래그먼트만 보존 |
| CSS 외부 URL 차단 | `lightweight`는 `url(...)` 중심, `strict`는 `image-set(...)`, `@import` 등 추가 처리 |
| `javascript:` 등 위험 스킴 차단, 비이미지 `data:` 제거 | `lightweight`, `strict` 제공 |
| DOCTYPE/ENTITY 제거 | `strict` 제공 |
| 입력 파일 크기 제한 | 제공 |
| 정제 후 노드 개수 제한 | `strict` 제공 |
| 메타데이터 제거 | `@cp949/web-image-util/svg-sanitizer`의 `removeMetadata: true` 제공 |
| 중첩 깊이, `viewBox`/좌표 상한, ID 충돌 방지 prefix | 향후 후보 |
| SMIL 무한 애니메이션, `<use>`/`<filter>`/`<pattern>` 순환 참조 감지 | 미제공 |
| 접근성 속성 자동 보정, SVGO 최적화 | 미제공 |
| CSP 헤더, `<img>`/Shadow DOM/iframe sandbox 격리 정책 | 라이브러리 범위 밖 |
| 정제와 호환성 보정을 모두 건너뛰는 디버깅 경로 | `unsafe_processImage()` 제공(프로덕션 금지) |

## 향후 제공 후보

기본 동작을 갑자기 바꾸기보다 `strict` 서브패스 옵션 또는 별도 유틸리티로 추가하는 방향입니다.

| 후보 | 예상 제공 방식 |
| --- | --- |
| 중첩 깊이 제한 | `sanitizeSvgStrict()` 옵션 |
| 거대한 `viewBox`/좌표값 제한 | `sanitizeSvgStrict()` 옵션 |
| ID 충돌 방지 prefix | `prefixSvgIds(svg, prefix)` 같은 별도 유틸리티 |
| 에디터 메타데이터 확장 제거 | `removeMetadata` 확장 옵션으로 `sodipodi:*`, `inkscape:*`, `dc:*` 제거 |

## CSS escape 우회 처리

`lightweight`와 `strict`의 CSS `url(...)` 검출은 CSS escape나 문자 참조로 스킴을 숨긴 페이로드도 식별합니다. 처리하는 패턴은 다음과 같습니다.

| 패턴 | 예시 | 브라우저 해석 |
| --- | --- | --- |
| 단일 hex escape | `url(\68ttp://...)` | `url(http://...)` |
| 0 패딩 hex escape | `url(\000068ttp://...)` | `url(http://...)` |
| 문자별 분할 escape (공백 포함) | `url(\68 \74 \74 \70 ://...)` | `url(http://...)` |
| escape된 따옴표 | `url(\22 http://...)` | `url("http://...")` |
| 엔티티 따옴표 | `url(&quot;https://...&quot;)` | `url("https://...")` |
| escape/엔티티 함수명 | `u\72l(...)`, `\55\52\4c(...)`, `u&#x72;l(...)`, `u\00007&#x32;l(...)` | `url(...)`, `URL(...)` |
| image-set 내부 escape | `image-set(url(\68ttp://...))` | 외부 로딩 |
| data URL 콜론 escape | `url(data\3a image/png;base64,...)` | `url(data:...)` |
| 이중 백슬래시 | `url(\\68\\74...)` | `url(\h\t...)` — 외부 URL이 아님 |

이중 백슬래시는 CSS 파서가 `\h\t...`로 해석해 실제 외부 URL이 되지 않으므로 sanitizer 차단 대상이 아닙니다. 회귀 테스트는 `sub/web-image-util/tests/security/svg-css-escape-bypass.test.ts`에 있습니다.

## 보안 권장사항

- 사용자 업로드 또는 외부 시스템 SVG에는 `svgSanitizer: 'strict'`를 사용합니다.
- 서버가 있다면 업로드 단계에서도 파일 크기, MIME, 확장자, 내용 스니핑, 저장 정책을 별도로 검증합니다.
- SVG를 DOM에 inline 삽입할 때는 이 파이프라인의 결과를 보안 경계로 삼지 말고 별도 sanitizer와 CSP를 함께 적용합니다. 인터랙션이 필요 없다면 `<img>` 또는 Canvas 결과처럼 스크립트 실행 표면이 좁은 방식이 더 적합합니다.
- DoS 방어가 중요하다면 `strict`의 `maxBytes`, `maxNodeCount` 외에 중첩 깊이, 좌표 범위, 애니메이션, 순환 참조 검사를 별도로 추가합니다.
