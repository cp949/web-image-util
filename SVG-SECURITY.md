# SVG sanitizer 보안 정책

이 문서는 `@cp949/web-image-util`의 `svgSanitizer` 옵션이 SVG 입력에 대해 무엇을 처리하고, 무엇을 처리하지 않는지 정리합니다.

`svgSanitizer`는 `processImage(source, options)`가 입력을 SVG로 판정한 경우에만 적용됩니다. PNG, JPEG, WebP 등 비-SVG 입력에는 영향을 주지 않습니다.

## 빠른 선택 기준

| 상황 | 권장 옵션 |
| --- | --- |
| 앱 내부에서 만든 신뢰 가능한 SVG를 빠르게 이미지로 변환 | `lightweight` |
| 사용자 업로드, 외부 URL, 외부 시스템에서 받은 SVG처럼 신뢰 경계 밖의 입력 | `strict` |
| 호출처에서 이미 별도 보안 정제를 끝냈고 이 라이브러리의 호환성 보정은 유지하고 싶은 SVG | `skip` |

```ts
import { processImage } from '@cp949/web-image-util';

await processImage(userProvidedSource, {
  svgSanitizer: 'strict',
}).toBlob();
```

## 왜 항상 `strict`가 기본값이 아닌가?

보안만 보면 신뢰할 수 없는 SVG에는 `strict`가 맞습니다. 다만 이 라이브러리의 기본값은 모든 SVG를 보안상 가장 강하게 정제하는 것이 아니라, 브라우저 이미지 처리 파이프라인에서 기존 SVG 렌더링을 가능한 한 깨지지 않게 다루는 것입니다.

`strict`를 항상 사용하지 않는 이유:

- **렌더링 보존성**: `strict`는 외부 참조뿐 아니라 내부 프래그먼트가 아닌 `href`/`src`를 보수적으로 제거합니다. 아이콘, 필터, 패턴, 이미지 참조를 활용하는 정상 SVG도 결과가 달라질 수 있습니다.
- **성능 비용**: `strict`는 DOMPurify, DOMParser, XMLSerializer 기반 정제와 노드 수 검사를 수행합니다. 대량 변환이나 신뢰 가능한 내부 에셋 처리에서는 불필요한 비용이 될 수 있습니다.
- **번들/의존성 경계**: 기본 `lightweight` 경로는 DOMPurify 기반 서브패스를 top-level로 끌어오지 않습니다. `strict`는 필요할 때만 동적으로 사용합니다.
- **역할 분리**: 이 패키지는 브라우저 이미지 처리 라이브러리입니다. 보안 요구가 있는 호출처가 신뢰 경계를 판단해 `strict`를 명시적으로 선택하도록 설계했습니다.

따라서 운영 기준은 단순합니다. **신뢰할 수 없는 SVG에는 항상 `strict`를 사용**하고, 신뢰 가능한 내부 에셋에는 기본 `lightweight`를 사용할 수 있습니다.

## 옵션별 책임 범위

### `lightweight`

기본값입니다. 렌더링 파이프라인을 보호하기 위한 경량 방어층입니다. 빠르게 동작하도록 정규식 기반으로 명백히 위험한 패턴을 제거하고, 제거 이후에도 위험 참조가 남으면 `INVALID_SOURCE`로 차단합니다.

하는 것:

- `<script>` 요소 제거
- `<foreignObject>` 요소 제거
- `onload`, `onclick` 등 `on*` 이벤트 핸들러 속성 제거
- `href`, `xlink:href`, `src`의 `http:`, `https:`, `//`, 비이미지 `data:`, `javascript:` 참조 제거
- `data:image/png`, `data:image/jpeg`, `data:image/webp` 등 raster embedded image는 크기 제한 안에서 보존
- `data:image/svg+xml` embedded image는 nested SVG를 같은 sanitizer 정책으로 재정제한 뒤 보존
- `style` 속성과 `<style>` 본문 안의 외부 `url(...)` 참조 제거
- 정제 후에도 상대 경로(`./`, `../`, `/`)나 외부 참조가 남으면 차단
- 원본 및 정제 후 SVG 크기 제한 적용
- 브라우저 호환성 보정 유지

하지 않는 것:

- DOM 기반의 완전한 SVG sanitizer 역할
- 모든 우회 기법, 문자 참조, CSS escape, 브라우저별 파서 차이까지 포괄하는 보안 보장
- DOCTYPE/ENTITY를 보안 정제 결과로 명시적으로 반환하거나 경고 제공
- 정제 후 노드 개수 제한
- 중첩 깊이, 거대한 `viewBox`/좌표값, 순환 참조, 무한 애니메이션 분석
- 메타데이터 제거
- 접근성, 다크모드, RTL, Retina 같은 표시 품질 자동 보정

### `strict`

신뢰할 수 없는 SVG를 위한 opt-in 경로입니다. DOMPurify 기반 sanitizer를 동적으로 불러와 SVG 프로필로 정제하고, 라이브러리 강제 정책을 후처리로 한 번 더 적용합니다.

하는 것:

- DOMPurify SVG 프로필(`svg`, `svgFilters`) 기반 정제
- `<script>`, `<foreignObject>` 강제 제거
- `on*` 이벤트 핸들러 속성 강제 제거
- `href`, `xlink:href`, `src`는 `#id` 형태의 내부 프래그먼트와 크기 제한을 통과한 `data:image/*` 참조만 보존
- `data:image/svg+xml`은 원문을 그대로 신뢰하지 않고 nested SVG sanitizer를 재귀 적용
- CSS 속성값과 `<style>` 본문의 외부 `url(...)`, `image-set(...)`, `@import`, `expression(...)`, `-moz-binding` 제거
- BOM, XML 선언, HTML 주석 제거
- DOCTYPE/ENTITY 제거로 XXE, XML bomb 계열 위험 완화
- 입력 바이트 크기 제한
- 정제 후 자손 Element 노드 개수 제한
- `@cp949/web-image-util/svg-sanitizer` 서브패스 API에서 `removeMetadata: true` 사용 시 `<metadata>` 제거
- `@cp949/web-image-util/svg-sanitizer`의 `sanitizeSvgStrictDetailed()` 사용 시 라이브러리가 적용한 사전/후처리 경고 반환
- 사용자가 strict 정책을 완화하는 DOMPurify 설정을 넘겨도 핵심 보안 설정은 강제

##### strict 정책을 완화하는 DOMPurify 설정은 무시됩니다

`domPurifyConfig`로 전달하더라도 라이브러리가 강제하는 strict 정책을 우회할 수 없습니다. 다음과 같은 설정은 무시되고 `warnings`에 기록됩니다.

- `ALLOWED_TAGS`, `ALLOWED_ATTR`
- `ADD_TAGS`, `ADD_ATTR`, `ADD_DATA_URI_TAGS`, `ADD_URI_SAFE_ATTR`
- `ALLOW_UNKNOWN_PROTOCOLS`, `ALLOWED_URI_REGEXP`, `CUSTOM_ELEMENT_HANDLING`
- `USE_PROFILES`, `SAFE_FOR_TEMPLATES`, `SAFE_FOR_XML`, `WHOLE_DOCUMENT`
- `RETURN_DOM`, `RETURN_DOM_FRAGMENT`, `RETURN_TRUSTED_TYPE`, `IN_PLACE`, `KEEP_CONTENT`

`FORBID_TAGS`와 `FORBID_ATTR`는 사용자 값과 라이브러리 강제 값(`script`, `foreignObject`, `on*`)이 union 머지됩니다.

하지 않는 것:

- SVG 보안을 완전히 보장하는 만능 필터
- 중첩 깊이 제한
- 비정상적으로 큰 `viewBox` 또는 좌표값 제한
- SMIL 무한 애니메이션 정밀 분석
- `<use>`, `<filter>`, `<pattern>` 순환 참조 감지
- 접근성 자동 보정
- SVGO 수준 최적화
- 다크모드, RTL, Retina 같은 표시 품질 자동 보정
- DOMPurify 내부 `removed` 배열 노출

### `skip`

호출처가 이미 자체 정제를 끝낸 SVG를 처리할 때만 사용하는 escape hatch입니다.

하는 것:

- sanitizer/assert 단계를 건너뜀
- 브라우저 호환성 보정은 유지
- 정제 없이도 최종 SVG 크기 제한은 적용

하지 않는 것:

- 위험 태그, 이벤트 핸들러, 외부 URI, CSS URL 제거
- 정제 후 안전성 검사
- 신뢰할 수 없는 SVG 보호

신뢰할 수 없는 SVG에는 `skip`을 사용하지 마세요.

## `unsafe_processImage()`와의 차이

`unsafe_processImage()`는 `svgSanitizer: 'skip'`과 다릅니다. `skip`은 sanitizer/assert만 건너뛰고 브라우저 호환성 보정은 유지하지만, `unsafe_processImage()`는 경량 방어층과 브라우저 호환성 보정을 모두 건너뛰고 원본 SVG를 최대한 그대로 로딩합니다.

이 API는 개발 및 디버깅 전용입니다. 렌더링 문제를 재현하거나, compatibility enhancement가 결과에 미치는 영향을 확인해야 하는 경우처럼 신뢰 가능한 SVG에만 사용하세요.

하는 것:

- `processImage()`와 같은 체이닝 API 제공
- SVG sanitizer/assert 단계 우회
- SVG 브라우저 호환성 보정 우회
- SVG 크기 제한 유지
- 브라우저의 CORS 및 tainted canvas 보안 모델 유지

하지 않는 것:

- `<script>`, `on*`, 외부 `href`/`src`, 외부 CSS URL 제거
- 위험 참조 잔여 검사
- `svgSanitizer: 'strict'` 옵션 존중. `unsafe_processImage(source, { svgSanitizer: 'strict' })`처럼 호출해도 unsafe passthrough가 우선합니다.
- 신뢰할 수 없는 SVG 보호

신뢰할 수 없는 입력은 `unsafe_processImage()` 대신 `processImage(source, { svgSanitizer: 'strict' })`를 사용하세요. 이미 자체 정제를 끝냈고 호환성 보정은 유지하고 싶다면 `processImage(source, { svgSanitizer: 'skip' })`를 사용하세요.

## 입력 형태별 적용 범위

`strict`와 `lightweight` 정책은 SVG로 확인된 다음 입력에 적용됩니다.

| 입력 형태 | 적용 방식 |
| --- | --- |
| 인라인 SVG 문자열 | 문자열이 실제 SVG 루트인지 판정 후 적용 |
| SVG Data URL | 디코딩 후 SVG로 확인되면 적용 |
| 원격 `.svg` URL | 응답 본문을 읽어 SVG로 확인되면 적용 |
| `image/svg+xml`, `text/xml`, `application/xml` 응답 | 본문이 실제 SVG이면 적용 |
| Blob/File | MIME, 파일명, 내용 스니핑으로 SVG 확인 후 적용 |
| Blob URL | fetch로 본문을 읽어 SVG 확인 후 적용 |
| ArrayBuffer/Uint8Array | 텍스트로 해석 가능한 SVG이면 적용 |

비-SVG URL은 SVG sanitizer 경로를 타지 않습니다.

## 일반 SVG 보안 요구사항과 현재 상태

아래 항목은 SVG를 외부 입력으로 받을 때 일반적으로 검토해야 하는 기능입니다. 현재 라이브러리가 제공하는 범위와 별도로, 서비스 보안 정책에 따라 서버 측 검증, CSP, 업로드 제한, 별도 보안 리뷰를 추가해야 할 수 있습니다.

| 요구사항 | 현재 상태 |
| --- | --- |
| SVG 여부를 확장자만으로 판단하지 않고 내용 확인 | 제공 |
| `<script>` 제거 | `lightweight`, `strict` 제공 |
| `on*` 이벤트 속성 제거 | `lightweight`, `strict` 제공 |
| `<foreignObject>` 제거 | `lightweight`, `strict` 제공 |
| 외부 `href`/`src` 참조 차단 | `lightweight`는 알려진 외부/실행형 참조 제거 후 잔여 위험 참조 차단, `strict`는 내부 프래그먼트만 보존 |
| CSS 외부 URL 차단 | `lightweight`는 `url(...)` 중심, `strict`는 `url(...)`, `image-set(...)`, `@import` 등 추가 처리 |
| `javascript:` 등 위험 스킴 차단, 비이미지 `data:` 제거, 이미지 `data:image/*`는 크기 제한 안에서 보존 | `lightweight`, `strict` 제공 |
| DOCTYPE/ENTITY 제거 | `strict` 제공 |
| 입력 파일 크기 제한 | 제공 |
| 정제 후 노드 개수 제한 | `strict` 제공 |
| 메타데이터 제거 | `@cp949/web-image-util/svg-sanitizer` 서브패스 API의 `removeMetadata: true`에서 제공 |
| 중첩 깊이 제한 | 향후 제공 후보 |
| 거대한 `viewBox`/좌표값 제한 | 향후 제공 후보 |
| SMIL 무한 애니메이션 분석 | 미제공 |
| `<use>`/`filter`/`pattern` 순환 참조 감지 | 미제공 |
| ID 충돌 방지 prefix | 향후 제공 후보 |
| 접근성 속성 자동 보정 | 미제공 |
| SVGO 최적화 | 미제공 |
| CSP 헤더 제공 | 라이브러리 범위 밖 |
| `<img>`/Shadow DOM/iframe sandbox 같은 표시 격리 정책 | 라이브러리 범위 밖 |
| 정제와 호환성 보정을 모두 건너뛰는 디버깅 경로 | `unsafe_processImage()` 제공. 신뢰할 수 없는 SVG에는 사용 금지 |

## 향후 제공 후보

다음 항목은 라이브러리 책임 범위 안에서 제공할 수 있는 후보입니다. 기본 동작을 갑자기 강하게 바꾸기보다는 `strict` 서브패스 옵션 또는 별도 유틸리티로 추가하는 방향이 적합합니다.

| 후보 | 예상 제공 방식 |
| --- | --- |
| 중첩 깊이 제한 | `sanitizeSvgStrict()` 옵션으로 최대 DOM 깊이 검사 |
| 거대한 `viewBox`/좌표값 제한 | `sanitizeSvgStrict()` 옵션으로 `viewBox`, `width`, `height`, 주요 좌표 속성의 상한 검사 |
| ID 충돌 방지 prefix | `prefixSvgIds(svg, prefix)` 같은 별도 유틸리티 |
| 에디터 메타데이터 확장 제거 | `removeMetadata` 확장 옵션으로 `sodipodi:*`, `inkscape:*`, `dc:*` 계열 제거 |

## CSS escape 우회 후보 검증 결과

`stripExternalCssUrls()`의 CSS `url(...)` 정규식이 CSS 숫자 escape(`\68ttp://` → `http://`)로 스킴을 숨긴 페이로드를 차단하지 못하는 회귀를 발견하고 보강했다.

### 발견된 우회 패턴

| 패턴 | 예시 | 브라우저 해석 |
| --- | --- | --- |
| 단일 hex escape | `url(\68ttp://evil.example.com/)` | `url(http://...)` |
| 0 패딩 hex escape | `url(\000068ttp://...)` | `url(http://...)` |
| 문자별 분할 escape (공백 포함) | `url(\68 \74 \74 \70 ://...)` | `url(http://...)` |
| escape된 따옴표 | `url(\22 http://...)` | `url("http://...")` |
| 엔티티 따옴표 | `url(&quot;https://...&quot;)` | `url("https://...")` |
| escape/엔티티 함수명 | `u\72l(...)`, `\55\52\4c(...)`, `u&#x72;l(...)`, `u\00007&#x32;l(...)` | `url(...)`, `URL(...)` |
| image-set 내부 escape | `image-set(url(\68ttp://...))` | 외부 로딩 |
| data URL 콜론 escape | `url(data\3a image/png;base64,...)` | `url(data:...)` |
| 이중 백슬래시 | `url(\\68\\74...)` | `url(\h\t...)` — 외부 URL 아님 |

### 적용된 보강 (2026-05-04)

1. **`decodeCssEscapes()` 추가**: CSS 숫자 escape 시퀀스(`\68`, `\000068` 등)를 실제 문자로 복원하는 함수를 추가했다.
2. **`isExternalCssUrl()` 보강**: 원본 값과 CSS escape 디코딩 값을 모두 검사하고, 엔티티/escape 디코딩 뒤 경계에 남은 따옴표를 제거하도록 수정했다.
3. **escaped/entity `url` 함수명 인식**: `u\72l(...)`, `u&#x72;l(...)`, `u\00007&#x32;l(...)`처럼 함수명 일부를 CSS escape나 numeric entity 또는 두 방식의 조합으로 숨긴 호출도 `url(...)`로 인식해 동일하게 정제한다.
4. **unquoted URL 정규식 확장 (Option B)**: 기존 `([^"')[^\s)]*)`에서 `([^"')]*)`로 변경해 공백을 포함하는 분할 escape 패턴도 캡처하되, 닫는 괄호 `)` 는 탐욕적 소비를 막기 위해 제외한다.

이중 백슬래시 케이스(`\\68\\74...`)는 CSS 파서가 `\h\t...`로 해석하므로 실제 외부 URL이 되지 않는다. sanitizer가 이 케이스를 차단하지 않아도 보안상 정상이며, 회귀 테스트에서 호스트 포함 여부 검사를 제외했다.

**회귀 테스트**: `sub/web-image-util/tests/security/svg-css-escape-bypass.test.ts`

## 보안 권장사항

- 사용자 업로드 또는 외부 시스템 SVG에는 `svgSanitizer: 'strict'`를 사용하세요.
- `unsafe_processImage()`는 개발/디버깅 전용으로만 사용하고, 사용자 입력이나 외부 SVG에는 사용하지 마세요.
- 서버가 있다면 업로드 단계에서도 파일 크기, MIME, 확장자, 내용 스니핑, 저장 정책을 별도로 검증하세요.
- SVG를 DOM에 inline 삽입하는 용도에는 이 이미지 처리 파이프라인의 결과를 보안 경계로 삼지 말고, 별도 sanitizer와 CSP를 함께 적용하세요.
- 인터랙션이 필요 없는 표시 용도는 `<img>` 또는 Canvas 결과처럼 스크립트 실행 표면이 좁은 방식이 더 적합합니다.
- 서비스 요구사항에 DoS 방어가 중요하다면 `strict`의 `maxBytes`, `maxNodeCount` 외에도 중첩 깊이, 좌표 범위, 애니메이션, 순환 참조 검사를 별도로 추가하세요.
