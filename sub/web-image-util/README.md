# @cp949/web-image-util

> 웹 브라우저를 위한 고성능 이미지 처리 라이브러리

Canvas 2D API 기반으로 리사이징, SVG 처리, 포맷 변환 등 다양한 이미지 처리 기능을 제공합니다.

**설계 철학**: [Sharp](https://github.com/lovell/sharp) 라이브러리의 API 설계를 웹 브라우저 환경에 맞게 구현하여, server-side 이미지 처리의 편의성을 클라이언트 사이드에서도 제공합니다.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## 주요 특징

- **🎯 완전한 타입 안전성**: TypeScript 지원과 Discriminated Union 타입 시스템
- **🎨 SVG 고품질 처리**: 벡터 품질을 완전히 보존하는 특별 파이프라인
- **🔗 체이닝 API**: 직관적인 메서드 체이닝으로 편리한 사용
- **⚡ 고성능**: Canvas Pool, 스마트 포맷 선택 등 최적화
- **🌐 의존성 없음**: 브라우저 네이티브 API만 사용
- **📦 트리쉐이킹**: ES 모듈로 번들 크기 최적화

## 설치

```bash
npm install @cp949/web-image-util
```

## 🚀 빠른 시작

### ⚡ 5분 내 첫 성공 경험

```typescript
import { processImage } from '@cp949/web-image-util';

// 🎯 시나리오 1: SNS 프로필 이미지 (정사각형, 고품질)
const profileImage = await processImage(userPhoto)
  .shortcut.coverBox(400, 400)  // 정사각형으로 크롭
  .toBlob({ format: 'webp', quality: 0.9 });

// 📱 시나리오 2: 반응형 썸네일 (빠른 로딩)
const thumbnail = await processImage(originalImage)
  .shortcut.scale(0.5)  // 50% 축소
  .toBlob({ format: 'webp', quality: 0.8 });

// 🎨 시나리오 3: 워터마크가 있는 배너
const banner = await processImage(backgroundImage)
  .resize({ fit: 'cover', width: 1200, height: 400 })
  .blur(1)  // 살짝 블러 처리
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

### 🎮 더 많은 예제

```typescript
// ✨ 편의 함수로 더 간단하게
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(imageFile, { width: 300, height: 200 });
const avatar = await createAvatar(profilePhoto, { size: 128 });
```

### 📦 프로젝트에 바로 적용

```bash
# 1. 설치
npm install @cp949/web-image-util

# 2. 타입 정의 (TypeScript)
import { processImage } from '@cp949/web-image-util';

# 3. 첫 번째 이미지 처리
const result = await processImage(file).shortcut.scale(0.8).toBlob();
```

## 📖 목차

- [아키텍처](#-아키텍처)
- [리사이징 가이드](#-리사이징-가이드)
- [🚀 Shortcut API](#-shortcut-api)
- [편의 함수 (Presets)](#-편의-함수-presets)
- [입력/출력 타입](#-입력출력-타입)
- [SVG 처리](#-svg-처리)
- [API 레퍼런스](#-api-레퍼런스)
- [브라우저 지원](#-브라우저-지원)

---

## 🏗️ 아키텍처

### 전체 흐름도

```
                                  ┌─────────────────┐
                                  │  processImage() │
                                  │   (팩토리 함수)  │
                                  └────────┬────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                              │
            ┌───────▼────────┐                            ┌───────▼────────┐
            │ SourceConverter│                            │ ImageProcessor │
            │  (소스 변환)    │                            │  (체이닝 API)   │
            └───────┬────────┘                            └───────┬────────┘
                    │                                              │
          ┌─────────▼──────────┐                          ┌───────▼────────┐
          │ SVG Detection      │                          │ LazyPipeline   │
          │ - isInlineSvg()    │                          │ - resize()     │
          │ - sniffSvgFromBlob │                          │ - blur()       │
          │ - MIME + Content   │                          └───────┬────────┘
          └─────────┬──────────┘                                  │
                    │                                              │
          ┌─────────▼──────────┐                    ┌─────────────▼─────────────┐
          │ convertSvgToElement│                    │ ResizeCalculator          │
          │ - SVG 정규화        │                    │ - calculateFinalLayout()  │
          │ - 복잡도 분석       │                    │ - fit 모드별 계산          │
          │ - 품질 레벨 선택    │                    └─────────────┬─────────────┘
          │ - 고품질 렌더링     │                                  │
          └────────────────────┘                    ┌─────────────▼─────────────┐
                                                    │ OnehotRenderer            │
                                                    │ - 단일 drawImage() 호출    │
                                                    │ - 품질 설정               │
                                                    │ - 배경색 처리             │
                                                    └───────────────────────────┘
```

### 핵심 플로우

1. **입력 처리**: 다양한 소스(File, URL, SVG 등)를 HTMLImageElement로 변환
2. **연산 누적**: 체이닝된 메서드들(.resize(), .blur() 등)이 LazyPipeline에 저장
3. **일괄 렌더링**: 최종 출력 시에만 단일 Canvas 연산으로 모든 처리 실행
4. **포맷 변환**: Canvas를 Blob, DataURL, File 등으로 변환

### 주요 특징

- **지연 렌더링**: 중간 Canvas 생성 없이 메모리 효율적 처리
- **SVG 호환성**: 브라우저별 SVG 렌더링 차이를 자동 보정
- **타입 안전성**: 컴파일 타임에 잘못된 메서드 체이닝 방지
- **스마트 포맷**: 브라우저 지원에 따른 최적 포맷 자동 선택

---

## 🎯 리사이징 가이드

### Fit 모드

5가지 리사이징 방식을 제공합니다:

| fit 모드  | 비율 유지 | 전체 보임 | 여백 생성 | 잘림 | 확대/축소 | 사용 사례        |
| --------- | --------- | --------- | --------- | ---- | --------- | ---------------- |
| `cover`   | ✅         | ❌         | ❌         | ✅    | 둘 다     | 썸네일, 배경     |
| `contain` | ✅         | ✅         | ✅         | ❌    | 둘 다     | 갤러리, 프리뷰   |
| `fill`    | ❌         | ✅         | ❌         | ❌    | 둘 다     | 정확한 크기 필요 |
| `maxFit`  | ✅         | ✅         | ❌         | ❌    | 축소만    | 최대 크기 제한   |
| `minFit`  | ✅         | ✅         | ❌         | ❌    | 확대만    | 최소 크기 보장   |

### 기본 사용법

```typescript
// cover: 비율 유지하며 전체 영역 채움 (기본값, 잘림 가능)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: 비율 유지하며 전체 이미지 보임 (여백 생성)
await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    background: '#ffffff'  // 여백 색상
  })
  .toBlob();

// fill: 비율 무시하고 정확히 맞춤 (이미지 변형됨)
await processImage(source)
  .resize({ fit: 'fill', width: 300, height: 200 })
  .toBlob();

// maxFit: 축소만 (확대 안함) - 원본 크기 보호
await processImage(source)
  .resize({ fit: 'maxFit', width: 800, height: 600 })
  .toBlob();

// minFit: 확대만 (축소 안함) - 최소 크기 보장
await processImage(source)
  .resize({ fit: 'minFit', width: 800, height: 600 })
  .toBlob();
```

### 한쪽 크기만 지정

```typescript
// 너비만 지정 (높이는 비율에 따라 자동 계산)
await processImage(source)
  .resize({ fit: 'maxFit', width: 800 })
  .toBlob();

// 높이만 지정 (너비는 비율에 따라 자동 계산)
await processImage(source)
  .resize({ fit: 'maxFit', height: 600 })
  .toBlob();
```

### 실무 예제

```typescript
// 썸네일 (정사각형, 잘림 허용)
const thumbnail = await processImage(photo)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// 프로필 아바타 (고품질)
const avatar = await processImage(userPhoto)
  .resize({ fit: 'cover', width: 150, height: 150 })
  .toBlob({ format: 'png', quality: 0.9 });

// 모바일 최적화 (원본 크기 보호)
const mobile = await processImage(photo)
  .resize({ fit: 'maxFit', width: 400 })
  .toBlob({ format: 'webp', quality: 0.7 });
```

### 중요: resize() 제약사항

**resize()는 한 번만 호출 가능합니다.** 이는 이미지 품질(특히 SVG)을 보장하기 위한 설계 결정입니다.

```typescript
// ❌ 에러: resize() 두 번 호출
const wrong = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError

// ✅ 올바름: 최종 크기를 직접 지정
const correct = await processImage(source)
  .resize({ fit: 'contain', width: 400, height: 300 })
  .toBlob();
```

---

## 🚀 Shortcut API

Sharp.js와 유사한 직관적인 shortcut API를 제공합니다. 자주 사용하는 리사이징 패턴을 간결하게 표현할 수 있습니다.

### 사용법

```typescript
import { processImage } from '@cp949/web-image-util';

// Shortcut API를 통해 간편하게 사용
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .toBlob();

// 체이닝도 가능
const blurred = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();
```

### 직접 매핑 (Direct Mapping)

ResizeConfig로 즉시 변환되는 편의 메서드들입니다.

```typescript
// 박스에 꽉 채우기 (일부 잘릴 수 있음)
await processImage(source).shortcut.coverBox(300, 200).toBlob();

// 박스 안에 전체 이미지 맞추기
await processImage(source).shortcut.containBox(300, 200).toBlob();

// 정확한 크기로 변환
await processImage(source).shortcut.exactSize(300, 200).toBlob();

// 크기 제한
await processImage(source).shortcut.maxWidth(500).toBlob();
await processImage(source).shortcut.maxHeight(400).toBlob();
await processImage(source).shortcut.maxSize({ width: 800, height: 600 }).toBlob();

// 최소 크기 보장
await processImage(source).shortcut.minWidth(300).toBlob();
await processImage(source).shortcut.minHeight(200).toBlob();
await processImage(source).shortcut.minSize({ width: 400, height: 300 }).toBlob();
```

### 지연 연산 (Lazy Operations)

원본 이미지 크기를 기반으로 계산되는 연산들입니다. 실제 계산은 최종 출력 시점에 수행됩니다.

```typescript
// 균등 스케일링
await processImage(source).shortcut.scale(1.5).toBlob();        // 1.5배 확대
await processImage(source).shortcut.scale(0.5).toBlob();        // 0.5배 축소

// 한쪽 크기 지정
await processImage(source).shortcut.exactWidth(300).toBlob();        // 너비 300px로 조정
await processImage(source).shortcut.exactHeight(200).toBlob();       // 높이 200px로 조정

// 개별 축 스케일링
await processImage(source).shortcut.scaleX(2).toBlob();         // 가로만 2배
await processImage(source).shortcut.scaleY(0.5).toBlob();       // 세로만 0.5배
await processImage(source).shortcut.scaleXY(2, 1.5).toBlob();   // 가로 2배, 세로 1.5배

// 객체 형태로도 사용 가능
await processImage(source).shortcut.scale({ sx: 2, sy: 1.5 }).toBlob();
```

### ScaleOperation 타입

`scale` 메서드는 다양한 형태의 스케일 값을 받을 수 있습니다:

```typescript
// 균등 스케일
scale(2)                      // number

// 가로만
scale({ sx: 2 })              // { sx: number }

// 세로만
scale({ sy: 1.5 })            // { sy: number }

// 개별 설정
scale({ sx: 2, sy: 0.75 })    // { sx: number, sy: number }
```

### 체이닝

Shortcut API는 다른 메서드들과 자유롭게 조합할 수 있습니다:

```typescript
// Shortcut + blur
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.8 });

// Lazy 연산 + blur
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

일부 메서드는 추가 옵션을 지원합니다:

```typescript
// containBox 옵션
await processImage(source).shortcut.containBox(300, 200, {
  padding: { top: 10, bottom: 10, left: 10, right: 10 },
  background: '#ffffff',
  trimEmpty: true,
  withoutEnlargement: true
}).toBlob();

// coverBox 옵션
await processImage(source).shortcut.coverBox(300, 200, {
  padding: { top: 5, bottom: 5, left: 5, right: 5 },
  background: '#000000'
}).toBlob();
```

---

## 📋 편의 함수 (Presets)

각 용도에 최적화된 설정을 자동으로 적용하는 함수들입니다.

```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage
} from '@cp949/web-image-util/presets';

// 웹용 썸네일 (성능 최적화)
const thumbnail = await createThumbnail(source, {
  size: 300,           // 300x300 정사각형
  format: 'webp',      // WebP 우선 (미지원시 JPEG)
  quality: 0.8         // 적당한 품질
});

// 프로필 아바타 (품질 우선)
const avatar = await createAvatar(userPhoto, {
  size: 64,            // 64x64
  format: 'png',       // PNG (투명도 지원)
  quality: 0.9         // 고품질
});

// 소셜 미디어 이미지 (호환성 우선)
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',  // 1080x1080 자동 적용
  format: 'jpeg',         // JPEG (호환성 우선)
  quality: 0.85           // 균형잡힌 품질
});

// 지원 플랫폼: 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'pinterest'
```

---

## 📥📤 입력/출력 타입

### 입력 (ImageSource)

다양한 형태의 이미지 소스를 지원합니다:

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

#### toBlob() - 파일 업로드용

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// 메타데이터
console.log(result.blob);           // Blob 객체
console.log(result.width);          // 처리 후 너비
console.log(result.height);         // 처리 후 높이
console.log(result.processingTime); // 처리 시간 (ms)

// FormData로 업로드
const formData = new FormData();
formData.append('image', result.blob);
await fetch('/upload', { method: 'POST', body: formData });
```

#### toDataURL() - 즉시 표시용

```typescript
const result = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toDataURL({ format: 'png' });

// img 태그에 직접 사용
document.querySelector('img').src = result.dataURL;
```

#### toFile() - 파일명 지정

```typescript
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toFile('thumbnail.webp', { quality: 0.8 });

console.log(result.file.name);  // 'thumbnail.webp'
console.log(result.file.size);  // 파일 크기 (bytes)
```

#### toCanvas() - 추가 처리용

```typescript
const canvas = await processImage(source)
  .resize({ fit: 'contain', width: 300, height: 200 })
  .toCanvas();

// Canvas에 추가 그리기 작업
const ctx = canvas.getContext('2d');
ctx.fillText('워터마크', 10, 20);
```

---

## 🎨 SVG 처리

### SVG 자동 감지 및 고품질 렌더링

라이브러리의 **핵심 기술**로, 다양한 형태의 SVG 입력을 정확하고 안전하게 감지하여 벡터 품질을 완전히 보존합니다.

#### 지원하는 SVG 소스 타입

```typescript
// 1. SVG XML 문자열
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize({ width: 200, height: 200 }).toBlob();

// 2. Data URL SVG
const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz4uLi48L3N2Zz4=';
await processImage(svgDataUrl).resize({ width: 200, height: 200 }).toBlob();

// 3. HTTP(S) URL (.svg 확장자 또는 Content-Type: image/svg+xml)
await processImage('https://example.com/icon.svg')
  .resize({ width: 200, height: 200 })
  .toBlob();

// 4. File/Blob 객체 (type='image/svg+xml' 또는 .svg 확장자)
const svgFile = new File([svgXml], 'icon.svg', { type: 'image/svg+xml' });
await processImage(svgFile).resize({ width: 200, height: 200 }).toBlob();
```

#### SVG 품질 보장

SVG를 어떤 크기로 리사이징해도 선명한 결과를 보장합니다:

```typescript
// 고품질 SVG 리사이징 - 1000x1000으로 확대해도 선명함
const result = await processImage(svgString)
  .resize({ fit: 'cover', width: 1000, height: 1000 })
  .toBlob({ format: 'png' });
```

**기술 특징**:
- ✅ **벡터 품질 보존**: SVG 원본을 그대로 유지하고 Canvas에서 직접 타겟 크기로 렌더링
- ✅ **정확한 판정**: BOM, XML 프롤로그, 주석, DOCTYPE 제거 후 정확한 `<svg>` 태그 매칭
- ✅ **오판정 방지**: HTML 내 SVG, 일반 XML 등 비SVG 소스 정확히 구분
- ✅ **이중 검증**: MIME 타입 + 내용 스니핑으로 안전한 판정

#### SVG 호환성 개선 (선택사항)

표준을 따르지 않는 SVG도 자동으로 수정하여 렌더링할 수 있습니다:

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

---

## 📚 API 레퍼런스

### processImage()

메인 진입점 함수로, 이미지 처리 체이닝을 시작합니다.

```typescript
function processImage(source: ImageSource): ImageProcessor
```

### ImageProcessor 클래스

#### .resize(config: ResizeConfig)

이미지 크기를 조정합니다. **한 번만 호출 가능합니다.**

```typescript
interface ResizeConfig {
  fit: 'cover' | 'contain' | 'fill' | 'maxFit' | 'minFit';
  width?: number;
  height?: number;
  background?: string;  // contain 모드에서 여백 색상
  padding?: number | { top?, right?, bottom?, left? };
  trimEmpty?: boolean;  // contain 모드에서 여백 제거
}
```

#### .blur(radius: number)

블러 효과를 적용합니다 (반지름 1-10).

```typescript
await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(3)
  .toBlob();
```

#### 출력 메서드

```typescript
// Blob 형태로 반환
await processor.toBlob(options?: {
  format?: 'jpeg' | 'png' | 'webp' | 'avif',
  quality?: number  // 0-1
}): Promise<ResultBlob>

// Data URL 형태로 반환
await processor.toDataURL(options?): Promise<ResultDataURL>

// File 객체로 반환
await processor.toFile(filename: string, options?): Promise<ResultFile>

// Canvas 엘리먼트로 반환
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
  | string; // URL, Data URL, SVG XML, 파일 경로

// 결과 타입
interface ResultBlob {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;          // bytes
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
// SVG 호환성 개선
import { enhanceBrowserCompatibility, normalizeSvgBasics } from '@cp949/web-image-util/utils';

// SVG 복잡도 분석
import { analyzeSvgComplexity } from '@cp949/web-image-util';

// SVG 크기 정보 추출
import { extractSvgDimensions } from '@cp949/web-image-util';

// 포맷 변환
import { toBlob, toDataURL, toFile } from '@cp949/web-image-util/utils';
```

---

## ⚙️ 브라우저 지원

**권장 브라우저 버전**:
- Chrome 88+
- Firefox 90+
- Safari 14+
- Edge 88+

**기능 확인**:

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
    // 에러 코드: 'INVALID_INPUT', 'INVALID_DIMENSIONS', 'PROCESSING_FAILED',
    //          'OUTPUT_FAILED', 'MULTIPLE_RESIZE_NOT_ALLOWED' 등

    if (error.details) {
      console.log('상세 정보:', error.details);
    }
  }
}
```

---

## 📦 서브 패키지

필요한 기능만 import하여 번들 크기를 최적화할 수 있습니다:

```typescript
// 메인 API
import { processImage } from '@cp949/web-image-util';

// 편의 함수들
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

// 유틸리티 함수
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';
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

Made with ❤️ for the web

</div>
