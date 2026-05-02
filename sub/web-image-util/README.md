# @cp949/web-image-util

> 웹 브라우저를 위한 이미지 처리 라이브러리

Canvas 2D API를 기반으로 리사이즈, SVG 처리, 포맷 변환 기능을 제공합니다.

**설계 방향**: 서버 사이드 이미지 처리 라이브러리의 사용성을 참고하되, 브라우저 환경에 맞는 방식으로 구성합니다.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 주요 특징

- **타입 안정성**: Discriminated Union 기반 TypeScript 타입 시스템 지원
- **SVG 처리**: 벡터 품질 보존을 고려한 렌더링 파이프라인 제공
- **체이닝 API**: 메서드 체이닝 방식으로 구성
- **성능 고려**: Canvas Pool, 포맷 선택 등의 최적화 적용
- **제로 의존성**: 브라우저 네이티브 API만 사용
- **트리 셰이킹 지원**: ES 모듈 기반 번들 크기 최적화

## 설치

```bash
npm install @cp949/web-image-util
```

## 🚀 빠른 시작

### 기본 예제

```typescript
import { processImage } from '@cp949/web-image-util';

// 프로필 이미지
const profileImage = await processImage(userPhoto)
  .shortcut.coverBox(400, 400)
  .toBlob({ format: 'webp', quality: 0.9 });

// 썸네일
const thumbnail = await processImage(originalImage)
  .shortcut.scale(0.5)
  .toBlob({ format: 'webp', quality: 0.8 });

// 배너 이미지
const banner = await processImage(backgroundImage)
  .resize({ fit: 'cover', width: 1200, height: 400 })
  .blur(1)
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

### 추가 예제

```typescript
// 프리셋 함수 사용
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(imageFile, { width: 300, height: 200 });
const avatar = await createAvatar(profilePhoto, { size: 128 });
```

### 설치 후 예제

```bash
# 1. 설치
npm install @cp949/web-image-util

# 2. TypeScript에서 import
import { processImage } from '@cp949/web-image-util';

# 3. 첫 이미지 처리
const result = await processImage(file).shortcut.scale(0.8).toBlob();
```

## 📖 목차

- [아키텍처](#-아키텍처)
- [리사이즈 가이드](#-리사이즈-가이드)
- [Shortcut API](#-shortcut-api)
- [편의 함수(프리셋)](#-편의-함수프리셋)
- [입력/출력 타입](#-입력출력-타입)
- [SVG 처리](#-svg-처리)
- [API 레퍼런스](#-api-레퍼런스)
- [브라우저 지원](#-브라우저-지원)

---

## 🏗️ 아키텍처

### 전체 흐름도

```
                         ┌────────────────────┐
                         │  processImage()    │
                         │    (팩토리 함수)   │
                         └─────────┬──────────┘
                                   │
           ┌───────────────────────┴─────────────────────┐
           │                                             │
   ┌───────▼─────────┐                           ┌───────▼────────┐
   │ SourceConverter │                           │ ImageProcessor │
   │   (소스 변환)   │                           │   (체이닝 API) │
   └───────┬─────────┘                           └───────┬────────┘
           │                                             │
 ┌─────────▼──────────┐                          ┌───────▼────────┐
 │ SVG 감지           │                          │ LazyPipeline   │
 │ - isInlineSvg()    │                          │ - resize()     │
 │ - sniffSvgFromBlob │                          │ - blur()       │
 │ - MIME + Content   │                          └───────┬────────┘
 └─────────┬──────────┘                                  │
           │                                             │
 ┌─────────▼──────────────┐                ┌─────────────▼─────────────┐
 │ convertSvgToElement    │                │ ResizeCalculator          │
 │ - SVG 정규화           │                │ - calculateFinalLayout()  │
 │ - 복잡도 분석          │                │ - fit 모드 계산           │
 │ - 품질 레벨 선택       │                └─────────────┬─────────────┘
 │ - 품질 보존 렌더링     │                              │
 └────────────────────────┘                ┌─────────────▼─────────────┐
                                           │ OnehotRenderer            │
                                           │ - drawImage() 1회 호출    │
                                           │ - 품질 설정               │
                                           │ - 배경색 처리             │
                                           └───────────────────────────┘
```

### 핵심 흐름

1. **입력 처리**: 파일, URL, SVG 등 여러 소스를 `HTMLImageElement`로 변환
2. **연산 누적**: `.resize()`, `.blur()` 같은 체이닝 메서드를 `LazyPipeline`에 저장
3. **배치 렌더링**: 최종 출력 시점에 단 한 번의 Canvas 처리로 전체 연산 실행
4. **포맷 변환**: Canvas 결과를 Blob, DataURL, File 등으로 변환

### 핵심 특성

- **지연 렌더링**: 중간 Canvas를 만들지 않아 메모리 효율이 높음
- **SVG 호환성 보정**: 브라우저별 SVG 렌더링 차이를 자동 보정
- **타입 안정성**: 잘못된 체이닝을 컴파일 타임에 방지
- **포맷 선택**: 브라우저 지원 여부를 바탕으로 적절한 포맷 선택 가능

---

## 🎯 리사이즈 가이드

### Fit 모드

다음 5가지 리사이즈 방식을 제공합니다.

| fit 모드  | 비율 유지 | 전체 표시 | 여백 추가 | 크롭 | 확대/축소 | 사용 예시           |
| --------- | --------- | --------- | --------- | ---- | --------- | ------------------- |
| `cover`   | ✅         | ❌         | ❌         | ✅    | 둘 다     | 썸네일, 배경 이미지 |
| `contain` | ✅         | ✅         | ✅         | ❌    | 둘 다     | 갤러리, 미리보기    |
| `fill`    | ❌         | ✅         | ❌         | ❌    | 둘 다     | 정확한 크기 필요    |
| `maxFit`  | ✅         | ✅         | ❌         | ❌    | 축소만    | 최대 크기 제한      |
| `minFit`  | ✅         | ✅         | ❌         | ❌    | 확대만    | 최소 크기 보장      |

`contain`은 지정한 `width`/`height` 크기의 출력 캔버스를 유지합니다. 원본 이미지를 최대 크기 안으로만 줄이고 출력 캔버스도 실제 이미지 크기로 받고 싶다면 `maxFit`을 사용하세요.

### 기본 사용법

```typescript
// cover: 비율을 유지하며 전체 영역을 채움(기본값, 일부 크롭 가능)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: 비율을 유지하며 전체 이미지를 표시(여백 추가)
await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    background: '#ffffff'  // 여백 색상
  })
  .toBlob();

// contain + withoutEnlargement: 출력 박스는 유지하고 작은 이미지만 확대하지 않음
await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    withoutEnlargement: true
  })
  .toBlob();

// fill: 비율을 무시하고 정확한 크기로 맞춤
await processImage(source)
  .resize({ fit: 'fill', width: 300, height: 200 })
  .toBlob();

// maxFit: 축소만 허용(확대 금지), 원본 크기 보호
await processImage(source)
  .resize({ fit: 'maxFit', width: 800, height: 600 })
  .toBlob();

// minFit: 확대만 허용(축소 금지), 최소 크기 보장
await processImage(source)
  .resize({ fit: 'minFit', width: 800, height: 600 })
  .toBlob();
```

### 한쪽 치수만 지정하기

```typescript
// 너비만 지정(높이는 비율에 맞춰 자동 계산)
await processImage(source)
  .resize({ fit: 'maxFit', width: 800 })
  .toBlob();

// 높이만 지정(너비는 비율에 맞춰 자동 계산)
await processImage(source)
  .resize({ fit: 'maxFit', height: 600 })
  .toBlob();
```

### 예제

```typescript
// 썸네일(정사각형, 크롭 허용)
const thumbnail = await processImage(photo)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// 프로필 아바타
const avatar = await processImage(userPhoto)
  .resize({ fit: 'cover', width: 150, height: 150 })
  .toBlob({ format: 'png', quality: 0.9 });

// 모바일용 축소 이미지
const mobile = await processImage(photo)
  .resize({ fit: 'maxFit', width: 400 })
  .toBlob({ format: 'webp', quality: 0.7 });
```

### 중요: `resize()` 제약

**`resize()`는 한 번만 호출할 수 있습니다.** 이는 특히 SVG를 포함한 이미지 품질을 보장하기 위한 설계 결정입니다.

```typescript
// ❌ 오류: resize()를 두 번 호출
const wrong = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError

// ✅ 올바른 사용: 최종 크기를 한 번에 지정
const correct = await processImage(source)
  .resize({ fit: 'contain', width: 400, height: 300 })
  .toBlob();
```

---

## 🚀 Shortcut API

Sharp.js와 비슷한 형태의 Shortcut API를 제공합니다. 자주 사용하는 리사이즈 패턴을 짧게 표현할 수 있습니다.

### 사용법

```typescript
import { processImage } from '@cp949/web-image-util';

// Shortcut API 사용
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .toBlob();

// 다른 메서드와 조합 가능
const blurred = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();
```

### 직접 매핑

편의 메서드가 곧바로 `ResizeConfig`로 변환됩니다.

```typescript
// 박스를 가득 채움(일부 영역은 잘릴 수 있음)
await processImage(source).shortcut.coverBox(300, 200).toBlob();

// 박스 안에 전체 이미지 맞춤
await processImage(source).shortcut.containBox(300, 200).toBlob();

// 정확한 크기로 변환
await processImage(source).shortcut.exactSize(300, 200).toBlob();

// 최대 크기 제한
await processImage(source).shortcut.maxWidth(500).toBlob();
await processImage(source).shortcut.maxHeight(400).toBlob();
await processImage(source).shortcut.maxSize({ width: 800, height: 600 }).toBlob();

// 최소 크기 보장
await processImage(source).shortcut.minWidth(300).toBlob();
await processImage(source).shortcut.minHeight(200).toBlob();
await processImage(source).shortcut.minSize({ width: 400, height: 300 }).toBlob();
```

### 지연 연산

원본 이미지 크기를 기준으로 계산되는 연산입니다. 실제 계산은 최종 출력 시점에 수행됩니다.

```typescript
// 균일 비율 확대/축소
await processImage(source).shortcut.scale(1.5).toBlob();        // 1.5배 확대
await processImage(source).shortcut.scale(0.5).toBlob();        // 0.5배 축소

// 한쪽 치수 지정
await processImage(source).shortcut.exactWidth(300).toBlob();   // 너비를 300px로 조정
await processImage(source).shortcut.exactHeight(200).toBlob();  // 높이를 200px로 조정

// 축별 개별 스케일
await processImage(source).shortcut.scaleX(2).toBlob();         // 가로만 2배
await processImage(source).shortcut.scaleY(0.5).toBlob();       // 세로만 0.5배
await processImage(source).shortcut.scaleXY(2, 1.5).toBlob();   // 가로 2배, 세로 1.5배

// 객체 형태도 지원
await processImage(source).shortcut.scale({ sx: 2, sy: 1.5 }).toBlob();
```

### `ScaleOperation` 타입

`scale` 메서드는 다양한 형태의 스케일 값을 받을 수 있습니다.

```typescript
// 균일 스케일
scale(2)                      // number

// 가로만
scale({ sx: 2 })              // { sx: number }

// 세로만
scale({ sy: 1.5 })            // { sy: number }

// 개별 설정
scale({ sx: 2, sy: 0.75 })    // { sx: number, sy: number }
```

### 체이닝

Shortcut API는 다른 메서드와 자유롭게 조합할 수 있습니다.

```typescript
// Shortcut + blur
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.8 });

// 지연 연산 + blur
const scaled = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toDataURL();

// 복합 체이닝
const complex = await processImage(source)
  .shortcut.exactWidth(300)
  .blur(2)
  .toBlob();
```

### 옵션 지원

일부 메서드는 추가 옵션을 지원합니다.

```typescript
// containBox 옵션
await processImage(source).shortcut.containBox(300, 200, {
  padding: { top: 10, bottom: 10, left: 10, right: 10 },
  background: '#ffffff',
  withoutEnlargement: true
}).toBlob();

// coverBox 옵션
await processImage(source).shortcut.coverBox(300, 200, {
  padding: { top: 5, bottom: 5, left: 5, right: 5 },
  background: '#000000'
}).toBlob();
```

---

## 📋 편의 함수(프리셋)

용도별 기본 설정을 적용하는 함수들입니다.

```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage
} from '@cp949/web-image-util/presets';

// 웹 썸네일
const thumbnail = await createThumbnail(source, {
  size: 300,           // 300x300 정사각형
  format: 'webp',      // WebP 우선(미지원 시 JPEG)
  quality: 0.8         // 중간 품질
});

// 프로필 아바타
const avatar = await createAvatar(userPhoto, {
  size: 64,            // 64x64
  format: 'png',       // PNG(투명도 지원)
  quality: 0.9
});

// 소셜 미디어 이미지
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',  // 1080x1080 자동 적용
  format: 'jpeg',         // JPEG 사용
  quality: 0.85
});

// 지원 플랫폼: 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'pinterest'
```

---

## 📥📤 입력/출력 타입

### 입력(`ImageSource`)

여러 형태의 이미지 소스를 지원합니다.

```typescript
// File/Blob 객체
const file = document.querySelector('input[type="file"]').files[0];
await processImage(file).resize({ width: 300, height: 200 }).toBlob();

// HTTP(S) URL
await processImage('https://example.com/photo.jpg')
  .resize({ width: 300, height: 200 })
  .toBlob();

// Data URL
await processImage('data:image/jpeg;base64,/9j/4AAQ...')
  .resize({ width: 300, height: 200 })
  .toBlob();

// HTMLImageElement
const img = document.querySelector('img');
await processImage(img).resize({ width: 300, height: 200 }).toBlob();

// ArrayBuffer / Uint8Array
await processImage(arrayBuffer).resize({ width: 300, height: 200 }).toBlob();

// SVG 문자열
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize({ width: 200, height: 200 }).toBlob();
```

### 출력 형식

#### `toBlob()` - 파일 업로드용

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// 메타데이터
console.log(result.blob);           // Blob 객체
console.log(result.width);          // 처리 후 너비
console.log(result.height);         // 처리 후 높이
console.log(result.processingTime); // 처리 시간(ms)

// FormData로 업로드
const formData = new FormData();
formData.append('image', result.blob);
await fetch('/upload', { method: 'POST', body: formData });
```

#### `toDataURL()` - 화면 표시용

```typescript
const result = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toDataURL({ format: 'png' });

// img 태그에 바로 사용
document.querySelector('img').src = result.dataURL;
```

#### `toFile()` - 파일명 포함

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toFile('thumbnail.webp', { quality: 0.8 });

console.log(result.file.name);  // 'thumbnail.webp'
console.log(result.file.size);  // 파일 크기(bytes)
```

#### `toCanvas()` - 추가 처리용

```typescript
const canvas = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toCanvas();

// canvas에 추가 드로잉 작업
const ctx = canvas.getContext('2d');
ctx.fillText('Watermark', 10, 20);
```

---

## 🎨 SVG 처리

### 자동 SVG 감지와 렌더링

이 라이브러리는 여러 SVG 입력 형태를 감지하고, 벡터 특성을 유지한 채 렌더링하는 것을 목표로 합니다.

#### 지원하는 SVG 소스 유형

```typescript
// 1. SVG XML 문자열
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize({ width: 200, height: 200 }).toBlob();

// 2. Data URL SVG
const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz4uLi48L3N2Zz4=';
await processImage(svgDataUrl).resize({ width: 200, height: 200 }).toBlob();

// 3. HTTP(S) URL(.svg 확장자 또는 Content-Type: image/svg+xml)
// 주의: 원격 SVG는 보안 검사(스크립트, 외부 참조 등)를 통과한 경우에만 처리됩니다
await processImage('https://example.com/icon.svg')
  .resize({ width: 200, height: 200 })
  .toBlob();

// 4. File/Blob 객체(type='image/svg+xml' 또는 .svg 확장자)
const svgFile = new File([svgXml], 'icon.svg', { type: 'image/svg+xml' });
await processImage(svgFile).resize({ width: 200, height: 200 }).toBlob();
```

#### SVG 렌더링 특성

리사이즈 크기와 무관하게 선명한 결과를 유지하도록 처리합니다.

```typescript
// 큰 크기로 출력하는 예제
const result = await processImage(svgString)
  .resize({ fit: 'cover', width: 1000, height: 1000 })
  .toBlob({ format: 'png' });
```

**특징**

- **벡터 품질 보존**: SVG 원본을 유지한 채 목표 크기로 직접 렌더링
- **정확한 감지**: BOM, XML 프롤로그, 주석, DOCTYPE 제거 후 `<svg>` 루트를 정밀 판정
- **오탐 방지**: HTML 안의 SVG 조각, 일반 XML 등 비-SVG 입력을 구분
- **이중 검증**: MIME 타입과 콘텐츠 스니핑을 함께 사용해 안전하게 감지

#### SVG 호환성 보정(선택)

표준에 덜 맞는 SVG도 자동으로 보정해 렌더링할 수 있습니다.

```typescript
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';

const { enhanced, report } = enhanceBrowserCompatibility(svgString, {
  fixDimensions: true,    // 크기 속성 보정
  addNamespaces: true,    // xmlns 속성 자동 추가
  modernizeSyntax: true   // 레거시 문법 현대화
});

console.log('처리 결과:', report.warnings);
await processImage(enhanced).resize({ width: 300, height: 200 }).toBlob();
```

### 보안 정책

라이브러리는 SVG 입력에 대해 **sanitize 우선 + 애매하면 fail-closed** 정책을 기본으로 적용합니다.

이 라이브러리의 목적은 범용 SVG 보안 필터가 아니라 **브라우저용 이미지 처리기**입니다. 따라서 SVG에 대해서는 명백히 위험한 패턴을 우선 차단하고, 안전성을 확신하기 어려운 입력은 거부하는 방향을 기본 정책으로 삼습니다.

복잡한 SVG를 최대한 보존하면서 세밀한 보안 처리가 필요한 요구사항은 이 라이브러리의 기본 책임 범위를 벗어납니다. 그런 경우에는 애플리케이션에서 전용 SVG sanitizer를 먼저 적용한 뒤, 처리된 결과를 `@cp949/web-image-util`에 전달하는 방식을 권장합니다.

#### 정제 후 허용되는 경우

다음과 같은 명백한 위험 요소는 가능한 범위에서 제거한 뒤 렌더링을 계속 시도합니다.

- `<script>` 태그
- `onload`, `onclick` 등 `on*` 이벤트 핸들러 속성
- `javascript:`, `data:`, `http://`, `https://`, `//...` 같은 외부 또는 실행형 `href`, `xlink:href`, `src`
- `style` 속성 또는 `<style>` 태그 안의 외부 `url(...)` 참조

> 문자 참조(`jav&#x61;script:` 등)로 우회하려는 값도 정규화 후 같은 정책으로 처리합니다.

#### 명시적으로 차단되는 경우

다음 조건을 만족하는 SVG는 `ImageProcessError(code: 'INVALID_SOURCE')`로 거부됩니다.

- sanitize 이후에도 로컬 경로(`./`, `../`, `/`) 참조가 남는 SVG
- sanitize 이후에도 정책상 안전성을 확신할 수 없는 SVG
- 원격 `.svg` URL을 `fetch`하는 과정에서 네트워크 오류가 발생한 경우
- `image/svg+xml`, `text/xml`, `application/xml` 응답 본문을 안전하게 읽거나 검증할 수 없는 경우
- `allowedProtocols`에서 `data:`를 제외했는데 SVG Data URL을 전달한 경우

#### 크기 제한

과도한 메모리 사용을 막기 위해 다음 입력에는 크기 제한이 적용됩니다.

| 입력 유형                     | 제한                                  |
| ----------------------------- | ------------------------------------- |
| 인라인 SVG 문자열             | 약 10MiB(UTF-8 바이트 기준)           |
| Data URL 디코딩 후 SVG 콘텐츠 | 약 10MiB(디코딩 후 UTF-8 바이트 기준) |
| 원격 SVG/XML 계열 응답 텍스트 | 약 10MiB(수신 바이트 기준)            |

초과 시 `ImageProcessError(code: 'INVALID_SOURCE')`가 발생합니다.

추가로 safe 경로의 SVG 크기 제한은 **sanitize 이후 결과가 아니라 원본 입력 기준**으로 적용됩니다. 즉, `<script>` 같은 제거 가능한 마크업이 많아서 sanitize 후에는 작아지더라도, 원본 SVG가 제한을 넘으면 차단됩니다.

이 규칙은 문자열 입력뿐 아니라 SVG 내용을 담은 `Blob`, `ArrayBuffer`, `Uint8Array` 입력에도 동일하게 적용됩니다. 버퍼 계열 입력도 가능한 경우 SVG로 판별해 같은 보안 검사와 크기 제한 경로를 사용합니다.

#### 허용되는 경우

- 순수 도형, 경로, 텍스트만 포함하는 자기완결형(self-contained) SVG
- `allowedProtocols`에 `data:`가 포함되어 있고 외부 리소스를 참조하지 않는 인라인 Data URI SVG
- `image/svg+xml`로 응답하고 안전성 검사를 통과한 원격 SVG URL

> **참고**: 비-SVG URL(`image.png` 등)은 `fetch`가 실패해도 직접 로드 방식으로 허용됩니다.

#### 개발/디버깅 전용 escape hatch

`processImage()`는 안전한 기본 경로입니다. SVG 입력에서 sanitize와 브라우저 호환성 보정을 건너뛰고 원본 SVG를 그대로 로딩해야 하는 경우(예: 렌더링 문제 디버깅)에만 `unsafe_processImage()`를 사용하세요.

```typescript
import { processImage, unsafe_processImage } from '@cp949/web-image-util';

// 기본 권장 경로 — sanitize와 호환성 보정이 자동으로 적용된다.
const safe = await processImage(svgXml)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob();

// 개발/디버깅 전용 — sanitize와 호환성 보정을 건너뛴다.
const debugOnly = await unsafe_processImage(svgXml)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob();
```

> `unsafe_processImage()`는 개발/디버깅 전용이다.
> SVG 보안 필터링과 브라우저 호환성 보정을 건너뛴다.
> 다만 SVG 크기 제한과 브라우저의 기본 보안 제약(CORS, tainted canvas)은 그대로 적용된다.
> 신뢰할 수 없는 입력에는 사용하지 않는다.
> 브라우저의 CORS 및 canvas 보안 제약은 그대로 적용된다.

---

## 📚 API 레퍼런스

### `processImage()`

이미지 처리 체이닝을 시작하는 메인 진입 함수입니다.

```typescript
function processImage(source: ImageSource): ImageProcessor
```

### `ImageProcessor` 클래스

#### `.resize(config: ResizeConfig)`

이미지를 리사이즈합니다. **한 번만 호출할 수 있습니다.**

```typescript
interface ResizeConfig {
  fit: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit';
  width?: number;
  height?: number;
  background?: string;  // 여백 또는 패딩 배경 색상
  padding?: number | { top?, right?, bottom?, left? };
  withoutEnlargement?: boolean;  // contain 모드에서 내부 이미지 확대 금지
}
```

#### `.blur(radius: number)`

블러 효과를 적용합니다. 반경은 1~10 범위를 권장합니다.

```typescript
await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(3)
  .toBlob();
```

#### 출력 메서드

```typescript
// Blob 반환
await processor.toBlob(options?: {
  format?: 'jpeg' | 'png' | 'webp' | 'avif',
  quality?: number  // 0-1
}): Promise<ResultBlob>

// Data URL 반환
await processor.toDataURL(options?): Promise<ResultDataURL>

// File 객체 반환
await processor.toFile(filename: string, options?): Promise<ResultFile>

// Canvas 요소 반환
await processor.toCanvas(): Promise<HTMLCanvasElement>
```

### 타입 정의

```typescript
// 입력 소스 타입
type ImageSource =
  | HTMLImageElement
  | Blob
  | File
  | ArrayBuffer
  | Uint8Array
  | string; // URL, Data URL, SVG XML, file path

// 결과 타입
interface ResultBlob {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;           // bytes
  processingTime: number; // ms
}

// 에러 클래스
class ImageProcessError extends Error {
  code: string;  // 'INVALID_INPUT', 'PROCESSING_FAILED', 'OUTPUT_FAILED' 등
  details?: any;
}
```

### 유틸리티 함수

```typescript
// 이미지 치수/포맷 조회
import { getImageDimensions, getImageInfo } from '@cp949/web-image-util/utils';

const dimensions = await getImageDimensions(file);
console.log(dimensions.width, dimensions.height);

const info = await getImageInfo(file);
console.log(info.width, info.height, info.format);

// SVG 호환성 보정
import { enhanceBrowserCompatibility, enhanceSvgForBrowser } from '@cp949/web-image-util/utils';

// SVG 복잡도 분석
import { analyzeSvgComplexity } from '@cp949/web-image-util';

// SVG 크기 추출
import { extractSvgDimensions } from '@cp949/web-image-util';

// 포맷 변환
import { toBlob, toDataURL, toFile } from '@cp949/web-image-util/utils';
```

---

## ⚙️ 브라우저 지원

**권장 브라우저 버전**

- Chrome 88+
- Firefox 90+
- Safari 14+
- Edge 88+

**기능 감지 (권장)**:

```typescript
import { detectBrowserCapabilities, detectSyncCapabilities } from '@cp949/web-image-util';

// 비동기 — 정확한 포맷 감지 (캐시 포함, 권장)
const caps = await detectBrowserCapabilities();
console.log(caps.webp);            // WebP 지원 여부
console.log(caps.avif);            // AVIF 지원 여부
console.log(caps.offscreenCanvas); // OffscreenCanvas 지원 여부
console.log(caps.imageBitmap);     // ImageBitmap 지원 여부

// 동기 — webp/avif 제외한 즉시 감지
const sync = detectSyncCapabilities();
console.log(sync.offscreenCanvas); // OffscreenCanvas 지원 여부
console.log(sync.webWorkers);      // Web Workers 지원 여부
```

**`features` (deprecated)**:

> `features`는 하위 호환을 위해 유지되지만 `detectBrowserCapabilities()`로 이전을 권장합니다.
> `webp`/`avif`는 별도 추측을 하지 않고, capability 감지 API가 채운 최신 캐시를 그대로 반영합니다.

```typescript
import { features } from '@cp949/web-image-util';

console.log(features.webp);           // WebP 지원 여부
console.log(features.avif);           // AVIF 지원 여부
console.log(features.offscreenCanvas); // OffscreenCanvas 지원 여부
console.log(features.imageBitmap);    // ImageBitmap 지원 여부
```

---

## 🚨 에러 처리

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 300, height: 200 })
    .toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);
    // 에러 코드 예시: 'INVALID_INPUT', 'INVALID_DIMENSIONS', 'PROCESSING_FAILED',
    //                'OUTPUT_FAILED', 'MULTIPLE_RESIZE_NOT_ALLOWED' 등

    if (error.details) {
      console.log('상세 정보:', error.details);
    }
  }
}
```

---

## 📦 서브패키지

필요한 기능만 가져와 사용할 수 있습니다.

```typescript
// 메인 API
import { processImage } from '@cp949/web-image-util';

// 편의 함수
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

// 유틸리티 함수
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';
```

### 필터 시스템

필터 시스템은 명시적 초기화가 필요합니다. import만으로는 전역 상태가 변경되지 않습니다.

```typescript
import { initializeFilterSystem } from '@cp949/web-image-util/filters';

// 필터 사용 전 명시적 초기화 필요
initializeFilterSystem();

// 이후 필터 사용 가능
```

---

## ⚡ 성능

### Canvas Pool

라이브러리는 내부적으로 **Canvas Pool**을 사용하여 Canvas 객체를 재사용합니다. 매 처리마다 새 Canvas를 생성·파괴하는 대신, 완료된 Canvas를 풀에 반환하여 다음 처리에 재사용합니다. 이로 인해:

- **GC 압력 감소**: 반복 처리 시 Canvas 생성·소멸로 인한 Garbage Collection 빈도를 줄입니다.
- **처리 비용 감소**: 반복 처리에서 Canvas 생성 오버헤드를 줄입니다.
- **자동 관리**: 별도 설정 없이 `toBlob()`, `toDataURL()`, `toFile()` 사용 시 자동으로 작동합니다.

```typescript
// Canvas Pool이 자동으로 활성화됨 — 별도 설정 불필요
const blob = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format: 'webp', quality: 0.85 }); // Canvas가 처리 후 자동 반환됨
```

### Canvas 소유권 주의사항

`.toCanvas()` 또는 `.toCanvasDetailed()`를 사용하면 Canvas 객체를 직접 받습니다. 이 경우 **Canvas는 풀에 자동 반환되지 않으므로** 사용이 끝나면 참조를 해제하면 됩니다. 대용량 반복 작업에서는 `toBlob()`을 사용하여 Canvas 수명 주기를 자동으로 관리하는 것을 권장합니다.

```typescript
// toBlob() 사용 권장 — Canvas 수명 주기가 자동 관리됨
const blob = await processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toBlob();

// toCanvas() 사용 시 — Canvas 소유권이 호출자에게 이전됨
// 대용량 처리나 반복 작업에서는 메모리 누수 가능성에 주의하세요.
const canvas = await processImage(source).resize({ fit: 'cover', width: 300, height: 200 }).toCanvas();
// canvas를 사용한 뒤 참조를 해제한다.
```

### 포맷별 처리 시간과 파일 크기

포맷 선택은 처리 시간과 출력 파일 크기 모두에 영향을 미칩니다.

| 포맷 | 처리 속도 | 파일 크기                    | 추천 상황                               |
| ---- | --------- | ---------------------------- | --------------------------------------- |
| WebP | 빠름      | 작음 (JPEG 대비 25~35% 감소) | WebP 지원 브라우저 대상, 일반 사진      |
| JPEG | 빠름      | 중간                         | 범용, 투명도 불필요                     |
| PNG  | 느림      | 큼 (무손실)                  | 투명도 필요, 아이콘, 텍스트 포함 이미지 |

```typescript
// 브라우저 지원 여부를 확인하고 포맷을 선택한다.
import { detectBrowserCapabilities } from '@cp949/web-image-util';

const caps = await detectBrowserCapabilities();
const format = caps.webp ? 'webp' : 'jpeg';

const blob = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format, quality: 0.85 });
```

---

## 📄 라이선스

MIT License

---

## 🔗 관련 링크

- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [예제 앱](../../apps/exam/) - 인터랙티브 데모

---

<div align="center">

웹 브라우저 환경을 위한 이미지 처리 라이브러리

</div>
