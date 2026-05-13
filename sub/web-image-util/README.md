# @cp949/web-image-util

> 웹 브라우저를 위한 이미지 처리 라이브러리

Canvas 2D API 위에서 리사이즈, SVG 렌더링, 포맷 변환을 체이닝 API로 제공합니다. 서버 사이드 이미지 처리 라이브러리의 사용성을 참고하되, 브라우저 런타임에 맞춰 지연 렌더링과 Canvas Pool을 적용했습니다.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

- 브라우저 전용 ESM 패키지
- 체이닝 API + 최종 출력 시점의 1회 Canvas 렌더링
- SVG 자동 감지, 브라우저 호환성 보정, 선택형 strict sanitizer
- 트리 셰이킹 가능한 서브패스 export

자세한 내부 구조는 [Architecture](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md), 변경 내역은 [CHANGELOG](https://github.com/cp949/web-image-util/blob/main/sub/web-image-util/CHANGELOG.md)를 참고하세요.

## 설치

```bash
npm install @cp949/web-image-util
```

브라우저의 Canvas 2D API, DOM API, `Blob`, `File`, `URL.createObjectURL` 등을 사용합니다.

## 빠른 시작

```typescript
import { processImage } from '@cp949/web-image-util';
import { createAvatar, createThumbnail } from '@cp949/web-image-util/presets';

// 박스 채우기 + WebP 변환
const profile = await processImage(userPhoto)
  .shortcut.coverBox(400, 400)
  .toBlob({ format: 'webp', quality: 0.9 });

// 체이닝 + blur
const banner = await processImage(backgroundImage)
  .resize({ fit: 'cover', width: 1200, height: 400 })
  .blur(1)
  .toBlob({ format: 'jpeg', quality: 0.85 });

// 프리셋
const thumbnail = await createThumbnail(imageFile, { width: 300, height: 200 });
const avatar = await createAvatar(profilePhoto, { size: 128 });
```

## 리사이즈

`resize()`는 한 체인에서 한 번만 호출할 수 있습니다. 최종 크기를 한 번에 지정하면 SVG를 포함한 입력을 목표 크기로 직접 렌더링합니다.

| fit 모드  | 비율 유지 | 전체 표시 | 여백   | 크롭   | 확대/축소 | 사용 예시           |
| --------- | --------- | --------- | ------ | ------ | --------- | ------------------- |
| `cover`   | 예        | 아니오    | 아니오 | 예     | 둘 다     | 썸네일, 배경 이미지 |
| `contain` | 예        | 예        | 예     | 아니오 | 둘 다     | 갤러리, 미리보기    |
| `fill`    | 아니오    | 예        | 아니오 | 아니오 | 둘 다     | 정확한 크기         |
| `maxFit`  | 예        | 예        | 아니오 | 아니오 | 축소만    | 최대 크기 제한      |
| `minFit`  | 예        | 예        | 아니오 | 아니오 | 확대만    | 최소 크기 보장      |

```typescript
// cover: 비율 유지, 전체 영역 채움
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: 비율 유지, 전체 표시, 여백
await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200, background: '#ffffff' })
  .toBlob();

// maxFit: 지정 크기보다 클 때만 축소
await processImage(source).resize({ fit: 'maxFit', width: 800 }).toBlob();
```

`contain`은 지정한 `width`/`height`의 출력 캔버스를 유지합니다. 출력 캔버스도 실제 이미지 크기로 받고 싶다면 `maxFit`을 사용하세요.

## Shortcut API

자주 쓰이는 리사이즈 패턴은 `.shortcut`으로 짧게 표현할 수 있습니다.

| 메서드                                          | 설명                       |
| ----------------------------------------------- | -------------------------- |
| `coverBox(w, h, opts?)`                         | 박스를 가득 채움           |
| `containBox(w, h, opts?)`                       | 박스 안에 전체 이미지 맞춤 |
| `exactSize(w, h)`                               | 정확한 크기로 변환         |
| `maxWidth(n)` / `maxHeight(n)` / `maxSize(...)` | 최대 크기 제한             |
| `minWidth(n)` / `minHeight(n)` / `minSize(...)` | 최소 크기 보장             |
| `scale(n)` / `scale({ sx?, sy? })`              | 원본 크기 기준 스케일      |
| `exactWidth(n)` / `exactHeight(n)`              | 한쪽 치수만 지정           |

```typescript
await processImage(source)
  .shortcut.coverBox(300, 200, { background: '#000' })
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.8 });

await processImage(source).shortcut.scale(0.5).toDataURL();
```

`coverBox`/`containBox` 옵션은 `padding`, `background`, `withoutEnlargement`를 지원합니다.

## 프리셋

```typescript
import { createAvatar, createSocialImage, createThumbnail } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(source, { size: 300, format: 'webp', quality: 0.8 });
const avatar = await createAvatar(userPhoto, { size: 64, format: 'png' });
const post = await createSocialImage(photo, { platform: 'instagram', format: 'jpeg' });
```

`createSocialImage()`는 `twitter`, `facebook`, `instagram`, `linkedin`, `youtube`, `pinterest` 크기 프리셋을 제공합니다.

## 서브패스 import 경로

라이브러리는 트리 셰이킹을 전제로 6개 서브패스 export를 노출합니다. 사용 목적에 맞는 서브패스에서 단일 함수만 가져오면 됩니다.

| npm 서브패스 | 주요 API | 책임 |
| --- | --- | --- |
| `@cp949/web-image-util` | `processImage`, `unsafe_processImage`, `ImageProcessor`, `ShortcutBuilder`, `ImageProcessError`, `extractSvgDimensions`, `analyzeSvgComplexity` | 메인 진입점, 체이닝 API |
| `@cp949/web-image-util/utils` | 변환(`convertToBlob`/`ensureBlob`/...), 포맷(`formatToMimeType`/...), SVG 진단(`inspectSvg`, `inspectSvgSource`), SVG 정규화(`prefixSvgIds`), 브라우저 기능 감지 | 호출 시 단일 함수만 가져오는 가벼운 유틸 |
| `@cp949/web-image-util/svg-sanitizer` | `sanitizeSvgStrict`, `sanitizeSvgStrictDetailed`, `inspectSvgSanitization` | DOMPurify 기반 strict sanitizer (동적 import) |
| `@cp949/web-image-util/presets` | `createThumbnail`, `createAvatar`, `createSocialImage` | 편의 preset 함수 |
| `@cp949/web-image-util/advanced` | `AdvancedImageProcessor`, `SmartFormatSelector`, `BatchResizer`, 필터 plugins 재노출 | 사용자가 명시적으로 선택하는 고급 API |
| `@cp949/web-image-util/filters` | `BlurFilterPlugin`, `BrightnessFilterPlugin`, `GrayscaleFilterPlugin` 등 필터 plugin 클래스 | 필터 시스템 (advanced에서 재노출) |

서브패스 책임 경계와 책임 분리는 [Architecture 문서의 공개 API 표면](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md#공개-api-표면) 표를, sanitizer 관련 옵션의 사용 가능/금지 시나리오는 [SVG sanitizer 보안 정책의 "금지 사용처"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#금지-사용처) 표를 참고하세요.

## 입력과 출력

`processImage()` 입력은 `HTMLImageElement`, `Blob`, `File`, `ArrayBuffer`, `Uint8Array`, `string`을 지원합니다. 문자열은 HTTP(S) URL, Data URL, SVG XML, 브라우저 경로를 자동 판별합니다.

```typescript
await processImage(file).resize({ width: 300, height: 200 }).toBlob();
await processImage('https://example.com/photo.jpg').resize({ width: 300 }).toBlob();
await processImage('data:image/jpeg;base64,/9j/4AAQ...').resize({ width: 300 }).toBlob();
await processImage('<svg width="100" height="100">...</svg>').resize({ width: 200 }).toBlob();
```

| 출력 메서드                   | 반환                                                    | 용도                 |
| ----------------------------- | ------------------------------------------------------- | -------------------- |
| `.toBlob(options?)`           | `{ blob, width, height, format, size, processingTime }` | 업로드, FormData     |
| `.toDataURL(options?)`        | `{ dataURL, ... }`                                      | `<img>` src          |
| `.toFile(filename, options?)` | `{ file, ... }`                                         | 파일명이 필요한 출력 |
| `.toCanvas()`                 | `HTMLCanvasElement`                                     | 추가 Canvas 드로잉   |

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

const formData = new FormData();
formData.append('image', result.blob);
await fetch('/upload', { method: 'POST', body: formData });
```

출력 옵션은 `{ format?: 'jpeg' | 'png' | 'webp' | 'avif', quality?: number }`입니다. `.toCanvas()` 결과는 호출자 소유이며 Canvas Pool에 자동 반환되지 않습니다.

## SVG 처리

SVG XML 문자열, SVG Data URL, 원격 SVG URL, `image/svg+xml` Blob/File을 자동 감지해 목표 크기로 렌더링합니다.

```typescript
await processImage('<svg width="100" height="100">...</svg>')
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob();
```

SVG 입력에는 `svgSanitizer` 옵션이 적용됩니다.

| 옵션          | 용도                                        |
| ------------- | ------------------------------------------- |
| `lightweight` | 기본값. 렌더링 파이프라인 보호용 경량 정제  |
| `strict`      | 신뢰할 수 없는 SVG용 DOMPurify 기반 정제    |
| `skip`        | 호출처에서 이미 정제를 끝낸 SVG에 한해 사용 |

```typescript
await processImage(userProvidedSource, { svgSanitizer: 'strict' })
  .resize({ fit: 'cover', width: 300, height: 300 })
  .toBlob();
```

신뢰할 수 없는 SVG에는 `strict`를 사용하세요. `unsafe_processImage()`는 렌더링 문제를 재현하기 위한 개발/디버깅 전용 API이며, 사용자 입력이나 외부 SVG에는 사용하지 마세요. 어떤 옵션을 언제 사용 가능/금지하는지는 [SVG sanitizer 보안 정책의 "금지 사용처" 표](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#금지-사용처)를, 옵션별 책임 범위 전체는 [SVG sanitizer 보안 정책](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md)을 참고하세요.

Fabric.js, Illustrator, Figma export처럼 SVG 안에 `data:image/*`를 embedded image로 넣는 정상 SVG는 sanitizer가 raster 이미지 Data URL만 제한적으로 보존하고, `data:image/svg+xml`은 nested SVG를 재정제한 결과만 보존하며 비이미지 Data URL은 제거합니다. MIME별 처리 전체는 [SVG sanitizer 보안 정책의 "embedded image 정책"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#embedded-image-정책) 섹션을 참고하세요.

### sanitizer 정책 영향 진단

`inspectSvgSanitization()`는 SVG 문자열에 sanitizer 정책을 적용했을 때 어떤 stage가 발동(또는 발동할)했는지 호출 전에 진단합니다. 보고서에는 SVG 원문, Data URL payload, 외부 URL이 담기지 않으며, `samples`는 tagName/attrName/MIME 같은 짧은 식별자만 노출합니다. 보안 경계가 아니며, 신뢰할 수 없는 SVG에는 그대로 `svgSanitizer: 'strict'`를 사용하세요.

```typescript
import { inspectSvgSanitization } from '@cp949/web-image-util/svg-sanitizer';

try {
  const report = await inspectSvgSanitization(svgString, { policy: 'lightweight' });
  if (report.impact.kind === 'lightweight') {
    if (report.impact.stages.some((stage) => stage.code === 'external-href-removed')) {
      console.warn('lightweight 적용 시 외부 href가 제거됩니다.');
    }
  }
} catch (e) {
  // 비문자열 입력 시 ImageProcessError(SVG_INPUT_INVALID)
}
```

`policy`는 `'lightweight'`(기본, 실제 실행) / `'strict'`(동적 import 후 실제 실행) / `'skip'`(미실행 — lightweight 시뮬레이션 결과를 `potentialStages`로 노출) 중 하나입니다.

### Strict sanitizer 직접 사용

`processImage()`를 거치지 않고 SVG 문자열을 DOMPurify SVG 프로필 + 라이브러리 강제 정책으로 직접 정제하려면 `sanitizeSvgStrict()`를 사용합니다. `@cp949/web-image-util/svg-sanitizer` 서브패스에서 동적 import됩니다.

```typescript
import { sanitizeSvgStrict, sanitizeSvgStrictDetailed } from '@cp949/web-image-util/svg-sanitizer';

// 정제된 SVG 문자열만 필요한 경우
const clean = sanitizeSvgStrict(untrustedSvg);

// 사전/후처리 경고와 함께 반환 — strict 정책을 완화하려는 DOMPurify 설정 등이 warnings에 기록됩니다
const detailed = sanitizeSvgStrictDetailed(untrustedSvg, { removeMetadata: true });
console.warn(detailed.warnings);
```

사용자가 `domPurifyConfig`로 strict 정책을 완화하는 설정을 넘기더라도 핵심 보안 설정은 강제되며 무시된 설정은 `warnings`로 노출됩니다. 자세한 정책은 [SVG sanitizer 보안 정책의 "옵션별 책임 범위 → `strict`"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#strict) 섹션을 참고하세요.

## 유틸리티

자주 쓰는 유틸리티는 `@cp949/web-image-util/utils`에서 가져옵니다.

### SVG 진단

변환 전에 SVG 문자열을 미리 진단하려면 `inspectSvg()`를 사용합니다. sanitizer를 실행하지 않고 위험 요소를 검사해 findings와 sanitizer 권장 사항을 반환합니다.

```typescript
import { inspectSvg } from '@cp949/web-image-util/utils';
import { processImage } from '@cp949/web-image-util';

const report = inspectSvg(svgString);

if (report.recommendation.sanitizer === 'strict') {
  // 위험 토큰 감지 — strict sanitizer 적용
  await processImage(svgString, { svgSanitizer: 'strict' }).toBlob();
} else {
  // 위험 토큰 없음 — 기본 lightweight
  await processImage(svgString).toBlob();
}
```

보안 경계가 아닙니다. SVG parse 실패 시 `report.valid === false` + 사유 finding으로 반환하며, 복잡도 휴리스틱 결과는 `report.complexity.recommendedQuality`(`'low' | 'medium' | 'high' | 'ultra'`)와 `report.complexity.complexityScore`(`0.0 ~ 1.0`)로 노출됩니다(복잡도 분석 실패 시 `report.complexity === null`). 실행 환경별 DOM 파싱 차이는 `report.environment` 필드에 드러납니다.

### SVG 입력 source 진단

`processImage()` 호출 전 입력 routing을 사전에 확인합니다. 기본 동작에서 네트워크 fetch를 수행하지 않습니다.

```typescript
import { inspectSvgSource } from '@cp949/web-image-util/utils';

const report = await inspectSvgSource(input);

if (report.kind === 'svg') {
  // SVG로 확정 — processImage에 넘길 수 있다
  await processImage(input).toBlob();
} else if (report.kind === 'not-svg-source') {
  // SVG가 아님 — 다른 경로로 처리한다
} else {
  // 'unknown' — 추가 확인이 필요하다
}

// URL 입력의 fetch 동작 제어
const fetchReport = await inspectSvgSource(
  new URL('https://cdn.example/icon.svg'),
  { fetch: 'metadata' }   // HEAD 요청으로 MIME만 확인, 본문 미소비
);
```

보안 경계가 아닙니다. `options.fetch`는 `'never'`(기본, fetch 없음) / `'metadata'`(HEAD) / `'body'`(GET, 본문 1회 소비) 3단계이며, fetch가 발생한 경우 `report.fetch.performed`와 `report.source.consumed`로 소비 여부를 확인할 수 있습니다. URL의 query string과 fragment는 `report.source.url`에서 자동 마스킹됩니다. byte cap 초과/fetch 실패/abort/timeout 같은 상황은 throw 없이 finding으로 보고됩니다.

### SVG ID prefix

여러 SVG를 같은 DOM에 inline 삽입할 때 `id` 충돌을 방지하려면 `prefixSvgIds()`를 사용합니다. 신뢰할 수 없는 SVG는 먼저 `sanitizeSvgStrict()`로 정제한 뒤 `prefixSvgIds()`를 호출합니다.

```typescript
import { prefixSvgIds } from '@cp949/web-image-util/utils';
import { sanitizeSvgStrict } from '@cp949/web-image-util/svg-sanitizer';

// 신뢰할 수 없는 SVG는 먼저 정제한다
const cleanSvg = sanitizeSvgStrict(untrustedSvg);

const { svg, report } = prefixSvgIds(cleanSvg, 'icon-a');

if (report.deoptimized) {
  // <style> 또는 style 속성이 있는 입력은 rewrite를 전면 보류한다
  console.warn('id prefix 보류:', report.deoptReasons);
} else {
  // 변환된 SVG를 DOM에 삽입
  container.innerHTML = svg;
}
```

### 기타 유틸리티

```typescript
import {
  fetchImageSourceBlob,
  getImageFormat,
  getImageInfo,
  getOutputFilename,
  hasTransparency,
  resolveOutputFormat,
} from '@cp949/web-image-util/utils';

const info = await getImageInfo(file);
const format = await getImageFormat(file);
const transparent = await hasTransparency(file, { sampleStep: 4 });
const filename = getOutputFilename('photo.png', { format: 'webp' });
const outputFormat = resolveOutputFormat('avif', { supported: ['webp', 'png'] });
const fetched = await fetchImageSourceBlob(url, { maxBytes: 20 * 1024 * 1024 });
```

## 에러 처리

라이브러리 내부 에러는 `ImageProcessError`로 전달됩니다. `error.code`로 분기하고, 추가 컨텍스트는 `error.details`에서 읽습니다.

```typescript
import { ImageProcessError, processImage } from '@cp949/web-image-util';

try {
  await processImage(src).resize({ fit: 'cover', width: 200 }).toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);
    if (error.code === 'INVALID_SOURCE' && error.details?.reason === 'script-tag') {
      // SVG 안의 <script> 태그를 거부했습니다.
    }
    if (error.cause instanceof Error) {
      console.error('원인:', error.cause);
    }
  }
  throw error;
}
```

## 브라우저 지원

권장 버전은 Chrome 88+, Firefox 90+, Safari 14+, Edge 88+입니다.

```typescript
import { detectBrowserCapabilities } from '@cp949/web-image-util';

const caps = await detectBrowserCapabilities();
const format = caps.webp ? 'webp' : 'jpeg';
```

`features` export는 deprecated입니다. 새 코드는 `detectBrowserCapabilities()` 사용을 권장합니다.

## 성능 메모

`toBlob()`, `toDataURL()`, `toFile()`은 내부 Canvas Pool을 사용해 반복 처리 시 Canvas 생성 비용과 GC 압력을 줄입니다. 반면 `.toCanvas()`와 `.toCanvasDetailed()` 결과는 호출자 소유이므로 사용 후 참조를 직접 해제하세요.

포맷 선택은 보통 WebP를 우선하고, 미지원 브라우저에서는 JPEG 또는 PNG로 fallback하는 흐름을 권장합니다.

## 문서

- [Architecture](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md)
- [SVG sanitizer 보안 정책](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md)
- [Release checklist](https://github.com/cp949/web-image-util/blob/main/docs/release-checklist.md)
- [CHANGELOG](https://github.com/cp949/web-image-util/blob/main/sub/web-image-util/CHANGELOG.md)

## 라이선스

MIT License
