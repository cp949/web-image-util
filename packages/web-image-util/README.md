# @cp949/web-image-util

> 웹 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리

Canvas 2D API 기반으로 다양한 이미지 처리 기능을 제공합니다. 체이닝 가능한 API로 직관적인 이미지 처리를 지원합니다.

## 🎯 주요 기능

### 🔧 이미지 처리 (현재 구현됨)
- **리사이징**: 5가지 fit 모드 (cover, contain, fill, inside, outside)
- **블러 효과**: 가우시안 블러
- **체이닝 API**: `processImage(source).resize(300, 200).blur(2).toBlob()`
- **다양한 입력**: HTMLImageElement, Blob, URL, Data URL, SVG XML, ArrayBuffer
- **다양한 출력**: Blob, Data URL, File, Canvas
- **SVG 호환성**: 문제가 있는 SVG 자동 수정 및 최적화

### 📋 편의 함수 (Presets)
- **썸네일 생성**: `createThumbnail()` - 웹 최적화 (WebP 우선, 적당한 품질)
- **아바타 생성**: `createAvatar()` - 고품질 프로필 이미지 (PNG, 투명도 지원)
- **소셜 이미지**: `createSocialImage()` - 플랫폼 호환성 (JPEG, contain fit)

### 🚀 고급 기능 (Advanced)
- **필터 시스템**: 플러그인 기반 색상/효과 필터
- **워터마크**: 텍스트/이미지 워터마크 합성
- **배치 처리**: 여러 이미지 동시 처리
- **성능 최적화**: 고해상도 이미지 처리

## ✨ 주요 특징

- **🔗 체이닝 API**: 직관적인 메서드 체이닝으로 편리한 사용
- **🎯 타입 안전**: 완전한 TypeScript 지원
- **🌐 브라우저 네이티브**: Canvas API 기반으로 의존성 없음
- **📦 트리쉐이킹**: ES 모듈로 번들 크기 최적화
- **⚡ 성능 최적화**: 고해상도 이미지 처리 지원
- **🎨 다양한 포맷**: WebP, AVIF, JPEG, PNG 지원

## 🚀 설치

```bash
npm install @cp949/web-image-util
```

## 📖 기본 사용법

### 체이닝 API (메인 기능)

```typescript
import { processImage } from '@cp949/web-image-util';

// 기본 리사이징
const result = await processImage(source)
  .resize(300, 200)  // 300x200 크기로 리사이징
  .toBlob({ format: 'webp', quality: 0.8 });

// 리사이징 + 블러 효과
const blurred = await processImage(source)
  .resize(400, 300, { fit: 'cover' })  // cover 모드로 리사이징
  .blur(2)  // 블러 반지름 2px
  .toBlob();

// 다양한 입력 소스 지원
const fromUrl = await processImage('https://example.com/image.jpg')
  .resize(200, 200)
  .toBlob();

// SVG 문자열 (문제가 있는 SVG도 자동 수정)
const fromSvg = await processImage(`<svg width="50" height="50">
  <circle cx="25" cy="25" r="20" fill="blue"/>
</svg>`).resize(100, 100).toDataURL();

// SVG 파일 경로도 지원
const fromSvgFile = await processImage('./logo.svg')
  .resize(200, 200)
  .toBlob();
```

## 🎯 리사이징 케이스별 가이드

라이브러리의 핵심 기능인 리사이징의 다양한 사용 케이스:

### 1. 비율 무시하고 강제 맞춤 (stretch)

```typescript
// 이미지를 정확히 300x200으로 늘리거나 압축 (비율 변경됨)
await processImage(source).resize(300, 200, { fit: 'stretch' }).toBlob();
```

### 2. 최대 영역 내에서 비율 유지 축소 (여백 없음)

```typescript
// 300x200 영역을 가득 채우되 비율 유지 (일부 잘림 가능)
await processImage(source).resize(300, 200, { fit: 'cover' }).toBlob();

// 또는 atMost 모드 (확대 없이 축소만)
await processImage(source).resize(300, 200, {
  fit: 'cover',
  withoutEnlargement: true
}).toBlob();
```

### 3. 최대 영역에 맞춤 (여백 생성)

```typescript
// 300x200 영역에 전체 이미지가 들어가도록 (여백 생김)
await processImage(source).resize(300, 200, {
  fit: 'contain',
  background: '#ffffff'  // 여백 색상 지정
}).toBlob();
```

### 4. 특정 너비로 축소/확대 (높이 자동)

```typescript
// 너비를 800px로, 높이는 비율에 따라 자동 계산
await processImage(source).resize(800, null).toBlob();

// 또는 height만 undefined로
await processImage(source).resize(800, undefined).toBlob();
```

### 5. 특정 높이로 축소/확대 (너비 자동)

```typescript
// 높이를 600px로, 너비는 비율에 따라 자동 계산
await processImage(source).resize(null, 600).toBlob();

// 또는 width만 undefined로
await processImage(source).resize(undefined, 600).toBlob();
```

### 6. 최소 너비 보장

```typescript
// 너비가 최소 800px 이상이 되도록 (필요시 확대, 잘림 가능)
await processImage(source).resize(800, null, {
  fit: 'cover',
  withoutReduction: true  // 축소 방지
}).toBlob();
```

### 7. 최소 높이 보장

```typescript
// 높이가 최소 600px 이상이 되도록 (필요시 확대, 잘림 가능)
await processImage(source).resize(null, 600, {
  fit: 'cover',
  withoutReduction: true  // 축소 방지
}).toBlob();
```

### 8. 최소 사각형 영역 보장

```typescript
// 최소 800x600 영역을 보장 (필요시 확대, 잘림 가능)
await processImage(source).resize(800, 600, {
  fit: 'cover',
  withoutReduction: true  // 축소 방지
}).toBlob();
```

### 📊 fit 모드 요약표

| fit 모드 | 비율 유지 | 원본 이미지<br/>완전히 보임 | 여백 생성 | 이미지 잘림 | 사용 사례 |
|----------|-----------|-------------|-----------|------------|-----------|
| `stretch` | ❌ | ✅ | ❌ | ❌ | 정확한 크기 필요시 |
| `cover` | ✅ | ❌ | ❌ | ✅ | 영역을 가득 채우고 싶을 때 |
| `contain` | ✅ | ✅ | ✅ | ❌ | 전체 이미지를 보여야 할 때 |

### 🔧 추가 옵션들

```typescript
// 확대 방지 (축소만 허용)
{ withoutEnlargement: true }

// 축소 방지 (확대만 허용)
{ withoutReduction: true }

// 배경색 지정 (contain 모드의 여백)
{ background: '#ffffff' }

// 위치 조정 (cover 모드에서 잘리는 부분 조정)
{ position: 'top' | 'bottom' | 'left' | 'right' | 'center' }
```

### 편의 함수들 (Presets)

각 용도에 최적화된 설정을 자동으로 적용하는 함수들:

```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage
} from '@cp949/web-image-util/presets';

// 📷 웹용 썸네일 (성능 최적화)
const thumbnail = await createThumbnail(source, {
  size: 300,                    // 300x300 정사각형
  // 자동 최적화: WebP 지원시 WebP, 아니면 JPEG
  // 품질 0.8, cover fit, 흰색 배경
});

// 👤 프로필 아바타 (품질 우선)
const avatar = await createAvatar(userPhoto, {
  size: 64,                    // 64x64
  // 자동 최적화: PNG 포맷, 품질 0.9, 투명 배경
  // cover fit, 중앙 정렬
});

// 📱 소셜 미디어 (호환성 우선)
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',       // 1080x1080 자동 적용
  // 자동 최적화: JPEG 포맷, contain fit
  // 품질 0.85, 흰색 배경
});

// 지원되는 플랫폼: 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'pinterest'
```

**각 함수의 자동 최적화:**
- **createThumbnail**: 웹 성능 중심 (WebP 우선, cover fit)
- **createAvatar**: 품질 중심 (PNG, 고품질, 투명도)
- **createSocialImage**: 호환성 중심 (JPEG, contain fit, 플랫폼 크기)

### 실제 사용 사례

```typescript
// 파일 업로드 처리
const handleFileUpload = async (file: File) => {
  // 원본 이미지 최적화 (최대 1920px 너비)
  const optimized = await processImage(file)
    .resize(1920, null, { withoutEnlargement: true })  // 너비만 제한, 비율 유지
    .toBlob({ format: 'webp', quality: 0.85 });

  // 썸네일 생성
  const thumbnail = await createThumbnail(file, {
    size: 200,
    format: 'webp',
    quality: 0.7
  });

  return { optimized, thumbnail };
};

// 프로필 이미지 처리
const processProfileImage = async (imageFile: File) => {
  // 여러 크기의 아바타 생성
  const [large, medium, small] = await Promise.all([
    createAvatar(imageFile, { size: 200 }),  // 프로필 페이지용
    createAvatar(imageFile, { size: 64 }),   // 댓글용
    createAvatar(imageFile, { size: 32 })    // 목록용
  ]);

  return { large, medium, small };
};
```

## 📥 입력 타입

다양한 형태의 이미지 소스를 지원합니다:

```typescript
// File 객체 (가장 일반적)
const file = document.querySelector('input[type="file"]').files[0];
await processImage(file).resize(300, 200).toBlob();

// 이미지 URL
await processImage('https://example.com/photo.jpg').resize(300, 200).toBlob();

// Data URL
await processImage('data:image/jpeg;base64,/9j/4AAQ...').resize(300, 200).toBlob();

// DOM 이미지 엘리먼트
const img = document.querySelector('img');
await processImage(img).resize(300, 200).toBlob();

// ArrayBuffer / Uint8Array
await processImage(arrayBuffer).resize(300, 200).toBlob();
```

### 🎨 SVG 문자열 지원 (특별 기능)

**문제가 있는 SVG라도 렌더링 가능**하도록 자동 호환성 처리를 제공합니다:

```typescript
// 기본 SVG 처리
await processImage('<svg>...</svg>').resize(300, 200).toBlob();

// 파일 경로 (상대/절대 경로)
await processImage('./assets/logo.svg').resize(200, 200).toBlob();
await processImage('/images/icon.svg').resize(100, 100).toBlob();

// 표준을 따르지 않는 SVG도 처리 가능
const brokenSvg = `<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>`; // 네임스페이스 누락, viewBox 없음 등

await processImage(brokenSvg).resize(200, 200).toBlob();
```

**SVG 호환성 개선 기능:**
- 누락된 네임스페이스 자동 추가
- viewBox 자동 생성
- 레거시 문법 현대화 (xlink:href → href)
- 크기 속성 자동 보정
- 렌더링 오류 방지

```typescript
// 수동으로 SVG 호환성 처리 (선택사항)
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';

const { enhanced, report } = enhanceBrowserCompatibility(svgString, {
  fixDimensions: true,
  addNamespaces: true,
  modernizeSyntax: true
});

console.log('처리 결과:', report.warnings); // 발견된 문제들
await processImage(enhanced).resize(300, 200).toBlob();
```

## 📤 출력 타입

다양한 형태로 결과를 받을 수 있습니다:

### toBlob() - 파일 업로드용

```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format: 'webp', quality: 0.8 });

// 메타데이터와 함께 반환
console.log(result.blob);           // Blob 객체
console.log(result.width);          // 처리 후 너비
console.log(result.height);         // 처리 후 높이
console.log(result.processingTime); // 처리 시간 (ms)

// FormData로 업로드
const formData = new FormData();
formData.append('image', result.blob);
await fetch('/upload', { method: 'POST', body: formData });
```

### toDataURL() - 즉시 표시용

```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toDataURL({ format: 'png' });

// 즉시 img 태그에 사용
document.querySelector('img').src = result.dataURL;
```

### toFile() - 파일명 지정

```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toFile('thumbnail.webp', { quality: 0.8 });

// 파일 정보
console.log(result.file.name);  // 'thumbnail.webp'
console.log(result.file.size);  // 파일 크기 (bytes)
```

### toCanvas() - 추가 처리용

```typescript
const canvas = await processImage(source)
  .resize(300, 200)
  .toCanvas();

// Canvas에 추가 그리기 작업 가능
const ctx = canvas.getContext('2d');
ctx.fillText('워터마크', 10, 20);
```

## 🚀 고급 기능

더 많은 기능이 필요한 경우 고급 패키지를 사용하세요:

### 색상 조정 및 필터

```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

// 고급 처리 예제
const result = await AdvancedImageProcessor.processImage(image, {
  resize: { width: 800, height: 600, priority: 'quality' },
  filters: {
    filters: [
      { name: 'brightness', params: { value: 10 } },
      { name: 'contrast', params: { value: 15 } }
    ]
  },
  watermark: {
    text: { text: '© 2024 Company', position: 'bottom-right' }
  }
});
```

### 워터마크 시스템

```typescript
import { addTextWatermark, addImageWatermark } from '@cp949/web-image-util/advanced';

// 간단한 텍스트 워터마크
const withText = await addTextWatermark(image, '© 2024', {
  position: 'bottom-right',
  style: 'subtle'
});

// 이미지 워터마크
const withLogo = await addImageWatermark(image, logoImage, {
  position: 'top-left',
  opacity: 0.7
});
```

## 📦 서브 패키지

필요한 기능만 import하여 번들 크기를 최적화할 수 있습니다:

```typescript
// 메인 API
import { processImage } from '@cp949/web-image-util';

// 편의 함수들 (프리셋)
import { createThumbnail, createAvatar, createSocialImage } from '@cp949/web-image-util/presets';

// 고급 기능
import { AdvancedImageProcessor, addTextWatermark } from '@cp949/web-image-util/advanced';

// 유틸리티 함수
import { toBlob, toDataURL, toFile } from '@cp949/web-image-util/utils';

// SVG 호환성 함수 (문제가 있는 SVG 수정)
import {
  enhanceBrowserCompatibility,  // 종합적 SVG 호환성 개선
  normalizeSvgBasics           // 기본적인 SVG 정규화
} from '@cp949/web-image-util/utils';
```

### 📝 문자열 입력 타입 정리

`processImage(string)` 에서 지원하는 모든 문자열 형태:

```typescript
// 1. SVG XML 문자열
processImage('<svg width="100" height="100">...</svg>')

// 2. 파일 경로 (상대/절대)
processImage('./assets/logo.svg')
processImage('/images/photo.jpg')

// 3. HTTP/HTTPS URL
processImage('https://example.com/image.jpg')

// 4. Data URL (base64)
processImage('data:image/jpeg;base64,/9j/4AAQ...')
processImage('data:image/svg+xml;base64,PHN2Zy...')
```

## ⚙️ 브라우저 지원

**브라우저 호환성:**
- Chrome 88+, Firefox 90+, Safari 14+, Edge 88+

**기능 확인:**
```typescript
import { features } from '@cp949/web-image-util';

console.log(features.webp);   // WebP 지원 여부
console.log(features.avif);   // AVIF 지원 여부
```

## 🚨 에러 처리

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source).resize(300, 200).toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);
    // 에러 코드: 'INVALID_INPUT', 'CANVAS_CREATION_FAILED', 'OUTPUT_FAILED'
  }
}
```

## 📚 TypeScript 지원

완전한 타입 정의 제공:

```typescript
import type {
  ImageSource,      // 입력 타입
  ResizeOptions,    // 리사이징 옵션
  BlobResult,       // Blob 결과 타입
  ResizeFit,        // fit 모드
  ImageFormat       // 지원 포맷
} from '@cp949/web-image-util';
```

## 📄 라이선스

MIT License

## 🔗 관련 링크

- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [예제 앱](../../apps/examples/)