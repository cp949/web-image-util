# @cp949/web-image-util

> High-performance image processing library for web browsers

Provides various image processing capabilities including resizing, SVG processing, and format conversion based on Canvas 2D API.

**Design Philosophy**: Implements the API design of the [Sharp](https://github.com/lovell/sharp) library adapted for web browser environments, bringing the convenience of server-side image processing to the client side.

[![npm version](https://img.shields.io/npm/v/@cp949/web-image-util)](https://www.npmjs.com/package/@cp949/web-image-util)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Key Features

- **🎯 Complete Type Safety**: TypeScript support with Discriminated Union type system
- **🎨 High-Quality SVG Processing**: Special pipeline that fully preserves vector quality
- **🔗 Chainable API**: Convenient usage with intuitive method chaining
- **⚡ High Performance**: Optimizations including Canvas Pool and smart format selection
- **🌐 Zero Dependencies**: Uses only browser native APIs
- **📦 Tree-Shakable**: Bundle size optimization with ES modules

## Installation

```bash
npm install @cp949/web-image-util
```

## 🚀 Quick Start

### ⚡ First Success in 5 Minutes

```typescript
import { processImage } from '@cp949/web-image-util';

// 🎯 Scenario 1: Social media profile image (square, high quality)
const profileImage = await processImage(userPhoto)
  .shortcut.coverBox(400, 400)  // Crop to square
  .toBlob({ format: 'webp', quality: 0.9 });

// 📱 Scenario 2: Responsive thumbnail (fast loading)
const thumbnail = await processImage(originalImage)
  .shortcut.scale(0.5)  // 50% reduction
  .toBlob({ format: 'webp', quality: 0.8 });

// 🎨 Scenario 3: Banner with watermark
const banner = await processImage(backgroundImage)
  .resize({ fit: 'cover', width: 1200, height: 400 })
  .blur(1)  // Slight blur effect
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

### 🎮 More Examples

```typescript
// ✨ Even simpler with convenience functions
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

const thumbnail = await createThumbnail(imageFile, { width: 300, height: 200 });
const avatar = await createAvatar(profilePhoto, { size: 128 });
```

### 📦 Direct Application to Your Project

```bash
# 1. Installation
npm install @cp949/web-image-util

# 2. Type definitions (TypeScript)
import { processImage } from '@cp949/web-image-util';

# 3. First image processing
const result = await processImage(file).shortcut.scale(0.8).toBlob();
```

## 📖 Table of Contents

- [Architecture](#-architecture)
- [Resizing Guide](#-resizing-guide)
- [🚀 Shortcut API](#-shortcut-api)
- [Convenience Functions (Presets)](#-convenience-functions-presets)
- [Input/Output Types](#-inputoutput-types)
- [SVG Processing](#-svg-processing)
- [API Reference](#-api-reference)
- [Browser Support](#-browser-support)

---

## 🏗️ Architecture

### Overall Flow Diagram

```
                                  ┌────────────────────┐
                                  │  processImage()    │
                                  │ (factory function) │
                                  └─────────┬──────────┘
                                            │
                    ┌───────────────────────┴─────────────────────┐
                    │                                             │
            ┌───────▼─────────┐                            ┌───────▼────────┐
            │ SourceConverter │                            │ ImageProcessor │
            │ (source convert)│                            │ (chaining API) │
            └───────┬─────────┘                            └───────┬────────┘
                    │                                              │
          ┌─────────▼──────────┐                          ┌───────▼────────┐
          │ SVG Detection      │                          │ LazyPipeline   │
          │ - isInlineSvg()    │                          │ - resize()     │
          │ - sniffSvgFromBlob │                          │ - blur()       │
          │ - MIME + Content   │                          └───────┬────────┘
          └─────────┬──────────┘                                  │
                    │                                             │
          ┌─────────▼──────────────┐                ┌─────────────▼─────────────┐
          │ convertSvgToElement    │                │ ResizeCalculator          │
          │ - SVG normalization    │                │ - calculateFinalLayout()  │
          │ - complexity analysis  │                │ - fit mode calculation    │
          │ - quality level select │                └─────────────┬─────────────┘
          │ - high quality render  │                              │
          └────────────────────────┘                ┌─────────────▼─────────────┐
                                                    │ OnehotRenderer            │
                                                    │ - single drawImage() call │
                                                    │ - quality setting         │
                                                    │ - background color        │
                                                    └───────────────────────────┘
```


### Core Flow

1. **Input Processing**: Convert various sources (File, URL, SVG, etc.) to HTMLImageElement
2. **Operation Accumulation**: Chained methods (.resize(), .blur(), etc.) are stored in LazyPipeline
3. **Batch Rendering**: Execute all processing with a single Canvas operation only at final output
4. **Format Conversion**: Convert Canvas to Blob, DataURL, File, etc.

### Key Features

- **Lazy Rendering**: Memory-efficient processing without creating intermediate Canvas
- **SVG Compatibility**: Automatic correction of browser-specific SVG rendering differences
- **Type Safety**: Prevent incorrect method chaining at compile time
- **Smart Format**: Automatic selection of optimal format based on browser support

---

## 🎯 Resizing Guide

### Fit Modes

Provides 5 different resizing methods:

| fit mode  | Maintain Ratio | Show Full | Add Padding | Crop | Scale | Use Case         |
| --------- | -------------- | --------- | ----------- | ---- | ----- | ---------------- |
| `cover`   | ✅              | ❌         | ❌           | ✅    | Both  | Thumbnails, backgrounds |
| `contain` | ✅              | ✅         | ✅           | ❌    | Both  | Gallery, preview |
| `fill`    | ❌              | ✅         | ❌           | ❌    | Both  | Exact size needed |
| `maxFit`  | ✅              | ✅         | ❌           | ❌    | Shrink only | Maximum size limit |
| `minFit`  | ✅              | ✅         | ❌           | ❌    | Enlarge only | Minimum size guarantee |

### Basic Usage

```typescript
// cover: Maintain ratio and fill entire area (default, cropping possible)
await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// contain: Maintain ratio and show full image (padding added)
await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    background: '#ffffff'  // Padding color
  })
  .toBlob();

// fill: Ignore ratio and fit exactly (image distorted)
await processImage(source)
  .resize({ fit: 'fill', width: 300, height: 200 })
  .toBlob();

// maxFit: Shrink only (no enlargement) - Protect original size
await processImage(source)
  .resize({ fit: 'maxFit', width: 800, height: 600 })
  .toBlob();

// minFit: Enlarge only (no shrinking) - Guarantee minimum size
await processImage(source)
  .resize({ fit: 'minFit', width: 800, height: 600 })
  .toBlob();
```

### Specifying Only One Dimension

```typescript
// Specify width only (height calculated automatically based on ratio)
await processImage(source)
  .resize({ fit: 'maxFit', width: 800 })
  .toBlob();

// Specify height only (width calculated automatically based on ratio)
await processImage(source)
  .resize({ fit: 'maxFit', height: 600 })
  .toBlob();
```

### Practical Examples

```typescript
// Thumbnail (square, cropping allowed)
const thumbnail = await processImage(photo)
  .resize({ fit: 'cover', width: 200, height: 200 })
  .toBlob({ format: 'webp', quality: 0.8 });

// Profile avatar (high quality)
const avatar = await processImage(userPhoto)
  .resize({ fit: 'cover', width: 150, height: 150 })
  .toBlob({ format: 'png', quality: 0.9 });

// Mobile optimization (protect original size)
const mobile = await processImage(photo)
  .resize({ fit: 'maxFit', width: 400 })
  .toBlob({ format: 'webp', quality: 0.7 });
```

### Important: resize() Constraints

**resize() can only be called once.** This is a design decision to ensure image quality (especially for SVG).

```typescript
// ❌ Error: Calling resize() twice
const wrong = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError

// ✅ Correct: Specify final size directly
const correct = await processImage(source)
  .resize({ fit: 'contain', width: 400, height: 300 })
  .toBlob();
```

---

## 🚀 Shortcut API

Provides intuitive shortcut API similar to Sharp.js. Commonly used resizing patterns can be expressed concisely.

### Usage

```typescript
import { processImage } from '@cp949/web-image-util';

// Easy usage with Shortcut API
const result = await processImage(source)
  .shortcut.coverBox(300, 200)
  .toBlob();

// Chaining is also possible
const blurred = await processImage(source)
  .shortcut.scale(1.5)
  .blur(2)
  .toBlob();
```

### Direct Mapping

Convenience methods that are immediately converted to ResizeConfig.

```typescript
// Fill box completely (some parts may be cropped)
await processImage(source).shortcut.coverBox(300, 200).toBlob();

// Fit entire image within box
await processImage(source).shortcut.containBox(300, 200).toBlob();

// Convert to exact size
await processImage(source).shortcut.exactSize(300, 200).toBlob();

// Size limits
await processImage(source).shortcut.maxWidth(500).toBlob();
await processImage(source).shortcut.maxHeight(400).toBlob();
await processImage(source).shortcut.maxSize({ width: 800, height: 600 }).toBlob();

// Minimum size guarantee
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
await processImage(source).shortcut.exactWidth(300).toBlob();   // 너비 300px로 조정
await processImage(source).shortcut.exactHeight(200).toBlob();  // 높이 200px로 조정

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

## 📋 Convenience Functions (Presets)

Functions that automatically apply optimized settings for each purpose.

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

## 📥📤 Input/Output Types

### Input (ImageSource)

Supports various types of image sources:

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

## 🎨 SVG Processing

### Automatic SVG Detection and High-Quality Rendering

The **core technology** of the library, accurately and safely detecting various forms of SVG input to fully preserve vector quality.

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

## 📚 API Reference

### processImage()

The main entry point function that starts image processing chaining.

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

## ⚙️ Browser Support

**Recommended Browser Versions**:
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
