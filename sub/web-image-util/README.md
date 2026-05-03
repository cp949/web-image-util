# @cp949/web-image-util

> 웹 브라우저를 위한 이미지 처리 라이브러리

Canvas 2D API 위에서 리사이즈, SVG 렌더링, 포맷 변환을 체이닝 API로 제공합니다. 서버 사이드 이미지 처리 라이브러리의 사용성을 참고하되, 브라우저 런타임에 맞춰 지연 렌더링과 Canvas Pool을 적용했습니다.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

- 브라우저 전용 ESM 패키지
- 체이닝 API + 최종 출력 시점의 1회 Canvas 렌더링
- TypeScript discriminated union 기반 리사이즈 설정
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

| fit 모드 | 비율 유지 | 전체 표시 | 여백 | 크롭 | 확대/축소 | 사용 예시 |
| --- | --- | --- | --- | --- | --- | --- |
| `cover` | 예 | 아니오 | 아니오 | 예 | 둘 다 | 썸네일, 배경 이미지 |
| `contain` | 예 | 예 | 예 | 아니오 | 둘 다 | 갤러리, 미리보기 |
| `fill` | 아니오 | 예 | 아니오 | 아니오 | 둘 다 | 정확한 크기 |
| `maxFit` | 예 | 예 | 아니오 | 아니오 | 축소만 | 최대 크기 제한 |
| `minFit` | 예 | 예 | 아니오 | 아니오 | 확대만 | 최소 크기 보장 |

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

| 메서드 | 설명 |
| --- | --- |
| `coverBox(w, h, opts?)` | 박스를 가득 채움 |
| `containBox(w, h, opts?)` | 박스 안에 전체 이미지 맞춤 |
| `exactSize(w, h)` | 정확한 크기로 변환 |
| `maxWidth(n)` / `maxHeight(n)` / `maxSize(...)` | 최대 크기 제한 |
| `minWidth(n)` / `minHeight(n)` / `minSize(...)` | 최소 크기 보장 |
| `scale(n)` / `scale({ sx?, sy? })` | 원본 크기 기준 스케일 |
| `exactWidth(n)` / `exactHeight(n)` | 한쪽 치수만 지정 |

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

## 입력과 출력

`processImage()` 입력은 `HTMLImageElement`, `Blob`, `File`, `ArrayBuffer`, `Uint8Array`, `string`을 지원합니다. 문자열은 HTTP(S) URL, Data URL, SVG XML, 브라우저 경로를 자동 판별합니다.

```typescript
await processImage(file).resize({ width: 300, height: 200 }).toBlob();
await processImage('https://example.com/photo.jpg').resize({ width: 300 }).toBlob();
await processImage('data:image/jpeg;base64,/9j/4AAQ...').resize({ width: 300 }).toBlob();
await processImage('<svg width="100" height="100">...</svg>').resize({ width: 200 }).toBlob();
```

| 출력 메서드 | 반환 | 용도 |
| --- | --- | --- |
| `.toBlob(options?)` | `{ blob, width, height, format, size, processingTime }` | 업로드, FormData |
| `.toDataURL(options?)` | `{ dataURL, ... }` | `<img>` src |
| `.toFile(filename, options?)` | `{ file, ... }` | 파일명이 필요한 출력 |
| `.toCanvas()` | `HTMLCanvasElement` | 추가 Canvas 드로잉 |

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

| 옵션 | 용도 |
| --- | --- |
| `lightweight` | 기본값. 렌더링 파이프라인 보호용 경량 정제 |
| `strict` | 신뢰할 수 없는 SVG용 DOMPurify 기반 정제 |
| `skip` | 호출처에서 이미 정제를 끝낸 SVG에 한해 사용 |

```typescript
await processImage(userProvidedSource, { svgSanitizer: 'strict' })
  .resize({ fit: 'cover', width: 300, height: 300 })
  .toBlob();
```

신뢰할 수 없는 SVG에는 `strict`를 사용하세요. `unsafe_processImage()`는 렌더링 문제를 재현하기 위한 개발/디버깅 전용 API이며, 사용자 입력이나 외부 SVG에는 사용하지 마세요. 상세 정책은 [SVG sanitizer 보안 정책](https://github.com/cp949/web-image-util/blob/main/SVG-SECURITY.md)을 참고하세요.

## 유틸리티

자주 쓰는 유틸리티는 `@cp949/web-image-util/utils`에서 가져옵니다.

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

라이브러리 내부 에러는 `ImageProcessError` 또는 그 하위 타입으로 전달됩니다.

```typescript
import { ImageProcessError, processImage } from '@cp949/web-image-util';

try {
  await processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);
    console.log(error.suggestions);
  }
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
