# @cp949/web-image-util

> 웹 브라우저를 위한 이미지 처리 라이브러리

Canvas 2D API 위에서 리사이즈, crop/회전/반전, SVG 렌더링, 포맷 변환을 체이닝 API로 제공합니다. 서버 사이드 이미지 처리 라이브러리의 사용성을 참고하되, 브라우저 런타임에 맞춰 지연 렌더링과 Canvas Pool을 적용했습니다.

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
import { imageShortcut, processImage } from '@cp949/web-image-util';
import { createAvatar, createThumbnail } from '@cp949/web-image-util/presets';

// 박스 채우기 + WebP 변환
const profile = await imageShortcut(userPhoto)
  .coverBox(400, 400)
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

| fit 모드  | 비율 유지 | 전체 표시 | fit 내부 여백 | 크롭   | 확대/축소 | 사용 예시           |
| --------- | --------- | --------- | ------------- | ------ | --------- | ------------------- |
| `cover`   | 예        | 아니오    | 아니오        | 예     | 둘 다     | 썸네일, 배경 이미지 |
| `contain` | 예        | 예        | 예            | 아니오 | 둘 다     | 갤러리, 미리보기    |
| `fill`    | 아니오    | 예        | 아니오        | 아니오 | 둘 다     | 정확한 크기         |
| `maxFit`  | 예        | 예        | 아니오        | 아니오 | 축소만    | 최대 크기 제한      |
| `minFit`  | 예        | 예        | 아니오        | 아니오 | 확대만    | 최소 크기 보장      |
| `scale`   | 선택      | 예        | 아니오        | 아니오 | 둘 다     | 원본 크기 기준 배율 |

```typescript
// cover: 비율 유지, 전체 영역 채움
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: 비율 유지, 전체 표시, 여백. 여백 색은 box()로 지정합니다
await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .box({ background: '#ffffff' })
  .toBlob();

// maxFit: 지정 크기보다 클 때만 축소
await processImage(source).resize({ fit: 'maxFit', width: 800 }).toBlob();

// fill 단일 축: 생략한 축은 원본 비율로 계산
await processImage(source).resize({ fit: 'fill', width: 800 }).toBlob();

// scale: 원본 크기 기준 배율 (균일 또는 축별)
await processImage(source).resize({ fit: 'scale', scale: 0.5 }).toBlob();
await processImage(source).resize({ fit: 'scale', scale: { sx: 2, sy: 1.5 } }).toBlob();
```

리사이즈 결과에 여백·배경을 추가하려면 `box()`를 이어서 호출하세요(아래 "박스" 절 참고).

```typescript
// 300×200 리사이즈 결과 바깥에 20px 흰색 여백 추가 → 출력 340×240
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .box({ padding: 20, background: '#fff' })
  .toBlob('jpeg');
```

`contain`은 지정한 `width`/`height`의 출력 캔버스를 유지합니다. 출력 캔버스도 실제 이미지 크기로 받고 싶다면 `maxFit`을 사용하세요.

### 배치 (position)

`cover`/`contain`은 기본적으로 중앙 정렬입니다. `position`으로 9방향 gravity 또는(`cover`만) 0~1 정규화 focal-point를 지정해 바꿀 수 있습니다.

```typescript
// gravity: 9방향 문자열 (top-left, top-center, top-right, center-left, center,
// center-right, bottom-left, bottom-center, bottom-right)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 300, position: 'top-center' })
  .toBlob();

// focal-point: 소스 이미지 기준 0~1 정규화 좌표. cover 전용(contain은 gravity만 허용)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 300, position: { x: 0.3, y: 0.7 } })
  .toBlob();

// contain은 gravity만 허용 — 전체를 자르지 않는 fit이라 focal-point의 존재 이유가 없다
await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 300, position: 'bottom-right' })
  .box({ background: '#fff' })
  .toBlob();
```

`position`을 생략하면 기존과 동일하게 중앙 정렬입니다. 잘못된 gravity 문자열, `[0, 1]` 범위를 벗어난 focal-point(부동소수점 오차 `1e-6` 이내는 0/1로 보정), `contain`에 focal-point 객체를 지정하는 조합은 모두 `OPTION_INVALID`입니다.

## Shortcut API

자주 쓰이는 리사이즈 패턴은 `imageShortcut()`으로 짧게 표현할 수 있습니다. `processImage()`와 파라미터가 동일한 별도 진입점이며, 반환값은 그대로 체이닝할 수 있는 프로세서입니다.

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
await imageShortcut(source)
  .coverBox(300, 200)
  .box({ background: '#000' })
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.8 });

await imageShortcut(source).scale(0.5).toDataURL();
```

`coverBox`/`containBox` 옵션은 `withoutEnlargement`, `position`을 지원합니다. 여백·배경은 `box()`로 추가하세요.

## 변환 (crop / flip / rotate)

`transform()`은 crop, 반전, 회전을 한 번에 지정합니다. 한 체인에서 한 번만, `resize()` 앞에서만 호출할 수 있고 `resize()`는 생략해도 됩니다. 최종 출력은 여전히 한 번의 Canvas 렌더링입니다.

```typescript
// crop만
await processImage(source).transform({ crop: { x: 10, y: 20, width: 640, height: 480 } }).toBlob();

// 시계 방향 90° 회전 + 좌우 반전 + 리사이즈
await processImage(source)
  .transform({ rotate: 90, flip: { horizontal: true } })
  .resize({ fit: 'cover', width: 320, height: 240 })
  .toBlob();

// 임의각 회전. expand: true(기본)는 회전 결과를 모두 담고, false는 입력 프레임을 유지합니다.
// 빈 모서리는 투명이므로 JPEG면 box()로 색을 줍니다 (scale 1이면 크기 그대로)
await processImage(source)
  .transform({ rotate: { degrees: 15, expand: true } })
  .resize({ fit: 'scale', scale: 1 })
  .box({ background: '#fff' })
  .toBlob('jpeg');
```

| 옵션 | 설명 |
| --- | --- |
| `crop: { x, y, width, height }` | 원본 픽셀 좌표 기준. SVG는 `getImageDimensions()`가 보고하는 크기 기준입니다. 원본을 벗어나면 요청 크기를 유지하고 밖은 투명입니다. 원본과 겹치지 않으면 출력 시점에 `INVALID_DIMENSIONS`입니다(`toBlob()`/`toDataURL()`/`toFile()` 기준. `toCanvas()`/`toCanvasDetailed()`는 현재 `OUTPUT_FAILED`로 감싸 던집니다 — 원인은 `cause`에 보존됩니다) |
| `flip: { horizontal?, vertical? }` | 좌우 / 상하 반전 |
| `rotate: number \| { degrees, expand? }` | 도 단위, 양수 = 시계 방향. `expand`는 `true`(기본, 회전 결과를 모두 담음) 또는 `false`(입력 프레임 유지) |

적용 순서는 호출 순서와 무관하게 crop → flip → rotate → resize로 고정됩니다. crop 좌표는 항상 원본 기준이며, 리사이즈 결과 좌표로는 지정할 수 없습니다.

JPEG는 투명을 지원하지 않아 빈 영역(crop 이탈, 회전 모서리, letterbox)이 검정이 됩니다. JPEG로 출력할 때는 `box()`의 `background`를 지정하세요. 캔버스 전체 아래에 칠해지므로 모든 빈 영역이 같은 색이 됩니다.

`blur()`와 함께 쓸 때: blur 반경은 캔버스 좌표계 기준입니다. `transform()` 뒤에 비균일 배율의 `resize()`(예: `fit: 'fill'`로 가로세로 배율이 다른 경우)를 적용하면 실제 렌더링되는 blur 강도가 축별로 달라질 수 있습니다.

## 박스 (padding / background / radius / border)

`box()`는 CSS box model 의미로 여백·배경·모서리 둥글림·테두리를 한 번에 지정합니다. 한 체인에서 한 번만 호출할 수 있고, `resize()`와 달리 체인 위치와 무관합니다(앞뒤 어디서 불러도 항상 transform → resize → box 순서로 가장 바깥에 적용됩니다). 최종 출력은 여전히 한 번의 Canvas 렌더링입니다.

```typescript
// 둥근 avatar (PNG로 출력 — JPEG는 모서리 바깥이 검정이 됩니다)
await processImage(source)
  .resize({ fit: 'cover', width: 128, height: 128 })
  .box({ radius: '50%' })
  .toBlob('png');

// padding + 배경 + 테두리
await processImage(source)
  .box({ padding: 16, background: '#ffffff', border: { width: 2, color: '#e5e5e5' } })
  .toBlob();

// 안쪽 테두리(크기 변화 없음)
await processImage(source)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .box({ border: { width: 3, color: 'rgba(0,0,0,0.4)', inset: true } })
  .toBlob();
```

| 옵션 | 설명 |
| --- | --- |
| `padding` | content(transform·resize 결과) 바깥 간격. 숫자 또는 `{ top, right, bottom, left }` |
| `background` | border 안쪽 전체(content + padding) 아래에 칠하는 CSS 색. 기본 투명 |
| `radius` | CSS `border-radius`와 동일 의미. px 또는 `%`(가로는 상자 너비, 세로는 상자 높이 기준 — 비정사각형에 `50%`를 쓰면 타원 모서리가 됩니다). 배열은 `[TL, TR, BR, BL]` 순서 |
| `border` | `{ width, color, inset? }`. `color`는 반투명 허용. `inset: true`면 크기를 늘리지 않고 안쪽에 그립니다(기본 false) |

바깥 상자 크기 = content + padding 네 방향 + (`border.inset`이면 0, 아니면 `border.width * 2`)입니다.

JPEG는 투명을 지원하지 않아 radius 바깥과 배경 미지정 영역이 검정이 됩니다. 둥근 모서리가 필요하면 PNG나 WebP로 출력하세요.

`resize({ fit: 'cover' })`를 원본과 목표 비율이 다른 이미지에 쓰면 이미지가 padding/border 영역까지 확장될 수 있습니다. `radius`를 지정해도 이 현상은 막히지 않습니다(모서리만 둥글게 잘릴 뿐 padding 영역 침범은 그대로입니다) — 현재 이를 완화할 방법은 없으니, 비율이 다른 입력에서는 이 동작을 감안하세요.

## 프리셋

```typescript
import { createAvatar, createSocialImage, createThumbnail } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(source, { size: 300, format: 'webp', quality: 0.8 });
const avatar = await createAvatar(userPhoto, { size: 64, format: 'png' });
const post = await createSocialImage(photo, { platform: 'instagram', format: 'jpeg' });
```

`createSocialImage()`는 `twitter`, `facebook`, `instagram`, `linkedin`, `youtube`, `pinterest` 크기 프리셋을 제공합니다.

## 이미지 합성 (advanced)

`composeImages()`는 레이어/그리드/콜라주 합성을 spec 객체 하나로 받습니다. 반환 canvas는 호출자 소유이며 라이브러리가 재사용하지 않습니다.

```typescript
import { composeImages } from '@cp949/web-image-util/advanced';

// 레이어 — 배열 순서대로 그려지고 뒤 원소가 위를 덮습니다
const card = await composeImages({
  type: 'layers',
  width: 800,
  height: 600,
  layers: [
    { image: photo, x: 0, y: 0, width: 800, height: 600 },
    { image: logo, x: 20, y: 540, opacity: 0.8 },
  ],
});

// 그리드 — 행 수는 ceil(이미지 수 / columns)로 파생되어 이미지가 잘리지 않습니다
// columns 생략 시 ceil(sqrt(이미지 수))
const album = await composeImages({ type: 'grid', images: photos, columns: 3, fit: 'cover' });

// 콜라주 — random을 주입하면 같은 spec에서 같은 배치가 재현됩니다
const board = await composeImages({
  type: 'collage',
  images: photos,
  width: 1200,
  height: 800,
  scaleRange: [0.2, 0.35],
  maxRotation: 10,
  allowOverlap: false,
  random: seededRandom, // () => number, 생략 시 Math.random
});
```

- `grid`의 `cover` fit은 셀 밖으로 넘치는 부분을 셀 영역으로 클리핑합니다.
- `collage`의 `allowOverlap: false`는 최선 노력입니다 — `maxPlacementAttempts`(기본 50)까지 겹치지 않는 위치를 재시도하고, 초과하면 겹침을 허용합니다.
- 잘못된 spec(크기 0 이하, `columns` 0 등)은 canvas를 만들기 전에 `ImageProcessError`로 거부됩니다.

## 고해상도 리사이즈 (advanced)

메인 `processImage().resize()` 체인은 항상 단일 `drawImage()`로 렌더링합니다. 대용량 이미지에서 타일 분할·단계적 축소 같은 전략이 필요하면 `HighResolutionProcessor`를 명시적으로 쓰세요 — opt-in 표면이며 메인 체인은 이를 호출하지 않습니다.

```typescript
import { HighResolutionProcessor } from '@cp949/web-image-util/advanced';

const result = await HighResolutionProcessor.resize(img, 1920, 1080, {
  priority: 'quality', // 'fast' | 'balanced' | 'quality', 기본 'balanced'
  onProgress: (progress, message) => console.log(progress, message),
});
// result: { canvas, analysis, priority, strategy, processingTime, memoryPeakUsageMB, memoryOptimized, estimatedTimeSaved, userMessage? }
```

- `validate(img, width, height, options?)`는 실제로 리사이즈하지 않고 `{ canProcess, warnings, recommendations, estimatedTime, recommendedStrategy, analysis }`를 반환합니다. 예외를 던지지 않습니다.
- `batchResize(items, width, height, options?)`는 여러 이미지를 동시성 제어(`concurrency`, 기본 2)와 진행 콜백(`onProgress`/`onItemComplete`)으로 일괄 처리합니다. 항목은 `HTMLImageElement` 또는 `{ img, width?, height?, name? }`이며, 공용 목표 크기를 개별 항목이 오버라이드할 수 있습니다. 항목 하나가 실패하면 전체가 reject됩니다(부분 성공 없음).
- `forceStrategy`(`'direct' | 'stepped' | 'tiled'`)로 `priority` 기반 자동 선택을 무시하고 특정 전략을 강제할 수 있습니다.

## 서브패스 import 경로

라이브러리는 트리 셰이킹을 전제로 6개 서브패스 export를 노출합니다. 사용 목적에 맞는 서브패스에서 단일 함수만 가져오면 됩니다.

| npm 서브패스 | 주요 API | 책임 |
| --- | --- | --- |
| `@cp949/web-image-util` | `processImage`, `unsafe_processImage`, `imageShortcut`, `ImageProcessor`, `ImageProcessError`, `extractSvgDimensions`, `analyzeSvgComplexity`, 변환(`ensureBlob`/`ensureImageElement`/...), 포맷(`formatToMimeType`/...), 이미지 정보(`getImageInfo`/...), 소스 판정(`detectImageSourceType`/...), 브라우저 기능 감지 | 메인 진입점, 체이닝 API, 변환·포맷·정보 유틸 |
| `@cp949/web-image-util/utils` | SVG 진단(`inspectSvg`, `inspectSvgSource`), SVG 정규화(`prefixSvgIds`), SVG 최적화(`SvgOptimizer`) | SVG 전용 진단·변형 도구 |
| `@cp949/web-image-util/svg-sanitizer` | `sanitizeSvgStrict`, `sanitizeSvgStrictDetailed`, `inspectSvgSanitization` | DOMPurify 기반 strict sanitizer (동적 import) |
| `@cp949/web-image-util/presets` | `createThumbnail`, `createAvatar`, `createSocialImage` | 편의 preset 함수 |
| `@cp949/web-image-util/advanced` | `AdvancedImageProcessor`, `HighResolutionProcessor`, `SmartFormatSelector`, `BatchResizer`, `composeImages`, 필터 plugins 재노출 | 사용자가 명시적으로 선택하는 고급 API |
| `@cp949/web-image-util/filters` | `BlurFilterPlugin`, `BrightnessFilterPlugin`, `GrayscaleFilterPlugin` 등 필터 plugin 클래스 | 필터 시스템 (advanced에서 재노출) |

서브패스 책임 경계와 책임 분리는 [Architecture 문서의 공개 API 표면](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md#공개-api-표면) 표를, sanitizer 관련 옵션의 사용 가능/금지 시나리오는 [SVG sanitizer 보안 정책의 "금지 사용처"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#금지-사용처) 표를 참고하세요.

`.blur()`(메인 체이닝 API)와 `/filters`의 `BlurFilterPlugin`은 이름만 같고 무관한 별도 구현입니다 — 전자는 CSS `ctx.filter` 기반 네이티브 블러(단일 `drawImage()`에 녹아듦), 후자는 `/advanced`·`/filters` 전용 2-pass Gaussian 픽셀 컨볼루션입니다. 내부 구조는 [Architecture 문서의 핵심 모듈](https://github.com/cp949/web-image-util/blob/main/docs/architecture.md#핵심-모듈)을 참고하세요.

## 입력과 출력

`processImage()` 입력은 `HTMLImageElement`, `Blob`, `File`, `ArrayBuffer`, `Uint8Array`, `string`을 지원합니다. 문자열은 HTTP(S) URL, Blob URL, Data URL, SVG XML, 브라우저 경로를 자동 판별합니다.

```typescript
await processImage(file).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();
await processImage('https://example.com/photo.jpg').resize({ fit: 'fill', width: 300 }).toBlob();
await processImage(URL.createObjectURL(file)).resize({ fit: 'fill', width: 300 }).toBlob();
await processImage('data:image/jpeg;base64,/9j/4AAQ...').resize({ fit: 'fill', width: 300 }).toBlob();
await processImage('<svg width="100" height="100">...</svg>').resize({ fit: 'fill', width: 200 }).toBlob();
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

### 픽셀 예산 (maxInputPixels / maxOutputPixels)

압축 바이트 크기만으로는 디코드된 이미지의 실제 픽셀 수나 최종 출력 Canvas
크기를 막을 수 없습니다. `maxInputPixels`/`maxOutputPixels`를 지정하면 각각
초과 시 `PIXEL_BUDGET_EXCEEDED`로 거부합니다. 두 옵션 모두 기본값이 없어
(opt-in), 지정하지 않으면 기존 동작과 완전히 같습니다.

```typescript
await processImage(source, {
  maxInputPixels: 40_000_000, // 디코드된 입력이 4천만 픽셀을 넘으면 거부
  maxOutputPixels: 16_000_000, // 최종 출력 Canvas가 1천6백만 픽셀을 넘으면 거부
})
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob('webp');
```

PNG/GIF/BMP는 `maxInputPixels` 지정 시 디코드 전 헤더만으로 먼저 거부될 수
있습니다(`details.stage === 'header'`). 그 외 포맷은 디코드 후 검사됩니다
(`details.stage === 'decoded'`). 두 옵션 모두 `0` 이하 값은 `OPTION_INVALID`로
거부됩니다 — "무제한"은 옵션을 생략하는 것으로만 표현합니다.

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

`inspectSvgSanitization()`는 SVG 문자열에 sanitizer 정책을 적용했을 때 어떤 stage가 발동(또는 발동할)했는지 호출 전에 진단합니다. 보고서에는 SVG 원문, Data URL payload, 외부 URL이 담기지 않으며, `samples`는 tagName/attrName/MIME 같은 짧은 식별자만 노출합니다. 보안 경계가 아니며, 신뢰할 수 없는 SVG에는 그대로 `svgSanitizer: 'strict'`를 사용하세요. 보고되는 stage는 선택한 정책의 sanitizer가 실제로 바꾸는 것만 담습니다. 변환(`processImage()`)이 입력을 거부할지는 `inspectSvg()`로 확인하세요 — 두 API의 판정 기준 차이는 [SVG sanitizer 보안 정책의 "진단 API의 판정 기준 차이"](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md#진단-api의-판정-기준-차이) 섹션을 참고하세요.

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

SVG 진단·정규화·최적화 도구는 `@cp949/web-image-util/utils`에서, 그 밖의 변환·포맷·이미지 정보 유틸은 루트 `@cp949/web-image-util`에서 가져옵니다.

### SVG 진단

변환 전에 SVG 문자열을 미리 진단하려면 `inspectSvg()`를 사용합니다. sanitizer를 실행하지 않고 위험 요소를 검사해 findings와 sanitizer 권장 사항을 반환합니다. finding은 변환 경로가 거부하는 참조(외부 URL, 상대·절대 경로, 안전하지 않은 `data:`)를 기준으로 보고되며, sanitizer가 제거하는 항목과는 기준이 다릅니다.

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
} from '@cp949/web-image-util';

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
  await processImage(src).resize({ fit: 'cover', width: 200, height: 200 }).toBlob();
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

빌드 타깃은 Chrome 75 이상입니다(best-effort). jsdom 기반 단위 테스트를 매 CI에서 실행하고, 최신 Chromium 브라우저 스모크(`test:browser`)는 로컬/수동으로 실행합니다. Chrome 75~82는 Playwright 자동화 한계로 자동 실행 검증 수단이 없고, Chrome 83은 필요할 때 수동으로 추가 검증할 수 있습니다(기본 실행 안 됨). 자세한 내용은 [ADR-0001](https://github.com/cp949/web-image-util/blob/main/docs/decisions/ADR-0001-browser-floor-chrome75.md)을 참고하세요.

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
- [ADR-0001: Chrome 75 브라우저 하한선](https://github.com/cp949/web-image-util/blob/main/docs/decisions/ADR-0001-browser-floor-chrome75.md)

## 라이선스

MIT License
