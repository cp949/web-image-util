# @cp949/web-image-util

모던 웹 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리입니다. Sharp 라이브러리의 패턴을 참고하여 설계된 체이닝 API를 제공합니다.

## ✨ 주요 특징

- **🔗 체이닝 API**: Sharp와 유사한 직관적인 메서드 체이닝
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

### 간단한 이미지 처리 (권장 방법)

```typescript
import { processImage } from '@cp949/web-image-util';

// 최대 크기 제한 (가장 많이 사용)
const result = await processImage(source)
  .atMostWidth(800)  // 최대 너비 800px, 비율 유지
  .toBlob();

// 썸네일 생성 (정사각형)
const thumbnail = await processImage(source)
  .atMostRect(200, 200)  // 200x200 안에 맞춤
  .toBlob({ format: 'webp' });

// 배경 추가하여 정확한 크기 맞춤
const padded = await processImage(source)
  .resizePad(300, 200, '#ffffff')  // 300x200 크기에 흰 배경, 비율유지, 작은 이미지는 확대
  .toBlob();

// 비율 유지하며 영역 채움
const covered = await processImage(source)
  .resizeCover(300, 200)  // 300x200 영역을 가득 채움, 비율유지,이미지 일부 잘릴 수 있음
  .toBlob();
```

### 편의 함수들

```typescript
import { createThumbnail, createAvatar, createSocialImage } from '@cp949/web-image-util';

// 썸네일 생성
const thumbnail = await createThumbnail(source, {
  size: 150,
  format: 'webp'
});

// 아바타 생성
const avatar = await createAvatar(userPhoto, {
  size: 64
});

// 소셜 미디어용 이미지
const socialPost = await createSocialImage(photo, {
  platform: 'instagram'
});
```

## 🎯 지원하는 입력 타입

```typescript
type ImageSource =
  | HTMLImageElement     // DOM 이미지 엘리먼트
  | Blob               // 파일 객체
  | string             // URL, Data URL, SVG, 경로
  | ArrayBuffer        // 바이너리 데이터
  | Uint8Array;        // 바이트 배열

// 예시
const image1 = await processImage(imgElement).resize(300, 200).toBlob();
const image2 = await processImage(blob).resize(300, 200).toBlob();
const image3 = await processImage('https://example.com/image.jpg').resize(300, 200).toBlob();
const image4 = await processImage('<svg>...</svg>').resize(300, 200).toBlob();
```

## 📤 출력 형태

### Blob 출력 (권장)
```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format: 'webp', quality: 0.8 });

console.log(result.blob);         // Blob 객체
console.log(result.width);        // 300
console.log(result.height);       // 200
console.log(result.processingTime); // 처리 시간 (ms)
```

### Data URL 출력
```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toDataURL('png');

// img 태그에 직접 사용
imgElement.src = result.dataURL;
```

### File 출력
```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toFile('thumbnail.webp', 'webp');

// FormData로 업로드
const formData = new FormData();
formData.append('image', result.file);
```

### Canvas 출력
```typescript
const canvas = await processImage(source)
  .atMostWidth(800)
  .toCanvas();

// DOM에 추가
document.body.appendChild(canvas);
```

## 🎯 리사이징 메서드 (권장 사용법)

### 📐 크기 제한 메서드 (가장 많이 사용)
```typescript
// 최대 크기 제한 - 비율 유지, 축소만, 잘림 없음
processImage(source).atMostWidth(800);        // 최대 너비 800px (비율유지, 확대안함, 잘림없음)
processImage(source).atMostHeight(600);       // 최대 높이 600px (비율유지, 확대안함, 잘림없음)
processImage(source).atMostRect(800, 600);    // 800x600 안에 맞춤 (비율유지, 확대안함, 잘림없음)

// 최소 크기 보장 - 비율 유지, 확대만, 잘림 가능
processImage(source).atLeastWidth(300);       // 최소 너비 300px (비율유지, 축소안함, 잘림가능)
processImage(source).atLeastHeight(200);      // 최소 높이 200px (비율유지, 축소안함, 잘림가능)
processImage(source).atLeastRect(300, 200);   // 최소 300x200 보장 (비율유지, 축소안함, 잘림가능)
```

### 🎨 정확한 크기 맞춤 메서드
```typescript
// 배경 추가하여 정확한 크기 - 비율 유지, 확대/축소, 잘림 없음
processImage(source).resizePad(400, 300);           // 흰색 배경 (비율유지, 확대함, 축소함, 잘림없음)
processImage(source).resizePad(400, 300, '#f0f0f0'); // 회색 배경 (비율유지, 확대함, 축소함, 잘림없음)

// 영역을 가득 채우는 방식 - 비율 유지, 확대/축소, 잘림 가능
processImage(source).resizeCover(400, 300);         // (비율유지, 확대함, 축소함, 잘림가능)

// 비율 무시하고 강제 맞춤 - 비율 무시, 확대/축소, 잘림 없음
processImage(source).stretch(400, 300);             // (비율무시, 확대함, 축소함, 잘림없음)
```

### 🔧 단일 차원 강제 설정
```typescript
// 정확한 크기로 강제 설정 - 비율 유지, 확대/축소, 잘림 없음
processImage(source).forceWidth(500);         // 너비 500px, 높이 비율 유지 (비율유지, 확대함, 축소함, 잘림없음)
processImage(source).forceHeight(300);        // 높이 300px, 너비 비율 유지 (비율유지, 확대함, 축소함, 잘림없음)
```

### 📊 리사이징 메서드 비교

| 메서드             | 결과 크기  | 비율 유지 | 확대 | 축소 | 잘림 | 사용 목적                  |
| ------------------ | ---------- | --------- | ---- | ---- | ---- | -------------------------- |
| `atMostWidth(w)`   | 실제 크기  | ✅         | ❌    | ✅    | ❌    | **최대 너비 제한**         |
| `atMostHeight(h)`  | 실제 크기  | ✅         | ❌    | ✅    | ❌    | **최대 높이 제한**         |
| `atMostRect(w,h)`  | 실제 크기  | ✅         | ❌    | ✅    | ❌    | **최대 크기 제한**         |
| `atLeastWidth(w)`  | 실제 크기  | ✅         | ✅    | ❌    | ✅    | **최소 너비 보장**         |
| `atLeastHeight(h)` | 실제 크기  | ✅         | ✅    | ❌    | ✅    | **최소 높이 보장**         |
| `atLeastRect(w,h)` | 실제 크기  | ✅         | ✅    | ❌    | ✅    | **최소 크기 보장**         |
| `resizePad(w,h)`   | 정확히 w×h | ✅         | ✅    | ✅    | ❌    | **정확한 크기 (배경추가)** |
| `resizeCover(w,h)` | 정확히 w×h | ✅         | ✅    | ✅    | ✅    | **정확한 크기 (잘림허용)** |
| `stretch(w,h)`     | 정확히 w×h | ❌         | ✅    | ✅    | ❌    | **강제 맞춤 (비율무시)**   |
| `forceWidth(w)`    | w×auto     | ✅         | ✅    | ✅    | ❌    | **정확한 너비**            |
| `forceHeight(h)`   | auto×h     | ✅         | ✅    | ✅    | ❌    | **정확한 높이**            |

```typescript
// 예시: 100x100 이미지를 다양한 방식으로 처리
const source = ...; // 100x100 이미지

processImage(source).atMostRect(300, 200);    // → 100x100 결과 (비율유지, 확대안함, 축소가능 잘림없음)
processImage(source).atLeastRect(300, 200);   // → 300x300 결과 (비율유지, 확대가능, 축소안함, 잘림가능)
processImage(source).resizePad(300, 200);     // → 300x200 결과 (비율유지, 확대가능, 축소가능, 배경추가, 잘림없음)
processImage(source).resizeCover(300, 200);   // → 300x200 결과 (비율유지, 확대함, 축소가능, 잘림가능)
processImage(source).stretch(300, 200);       // → 300x200 결과 (비율무시, 확대함, 축소가능, 잘림없음)
processImage(source).forceWidth(300);         // → 300x300 결과 (비율유지, 확대함, 축소가능, 잘림없음)
```

## 🔧 로우레벨 리사이징 (고급 사용자용)

위의 편의 메서드로 충분하지 않을 때만 사용하세요:

```typescript
// 로우레벨 resize() 메서드 - 복잡한 옵션 제어
processImage(source).resize(300, 200, {
  fit: 'pad',                   // fit 모드별 특성:
                               // • 'cover': 비율유지, 확대함, 축소함, 잘림가능
                               // • 'pad': 비율유지, 확대함, 축소함, 잘림없음
                               // • 'stretch': 비율무시, 확대함, 축소함, 잘림없음
                               // • 'atMost': 비율유지, 확대안함, 축소함, 잘림없음
                               // • 'atLeast': 비율유지, 확대함, 축소안함, 잘림가능
  position: 'center',           // 'top' | 'bottom' | 'left' | 'right' | 'center'
  background: '#ffffff',        // 배경색 (pad 모드에서 사용)
  withoutEnlargement: false,    // 확대 방지 옵션
  withoutReduction: false       // 축소 방지 옵션
});
```

## 🎨 이미지 효과

### 블러 효과
```typescript
// 기본 블러 (반지름 2px)
processImage(source).blur();

// 커스텀 블러
processImage(source).blur(5);

// 고품질 블러
processImage(source).blur(3, { precision: 2 });
```

## 📦 서브 엔트리포인트

필요한 기능만 import하여 번들 크기를 최적화할 수 있습니다:

```typescript
// 메인 API
import { processImage } from '@cp949/web-image-util';

// 편의 함수들
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

// 고급 기능 (Phase 3)
import { AdvancedProcessor, filterManager } from '@cp949/web-image-util/advanced';

// 유틸리티
import { toBlob, toDataURL } from '@cp949/web-image-util/utils';

// 필터 플러그인들
import { BlurFilterPlugins, ColorFilterPlugins } from '@cp949/web-image-util/filters';
```

## ⚙️ 브라우저 지원 및 설정

### 기능 지원 확인
```typescript
import { features } from '@cp949/web-image-util';

if (features.webp) {
  // WebP 포맷 사용 가능
}
if (features.avif) {
  // AVIF 포맷 사용 가능
}
if (features.offscreenCanvas) {
  // OffscreenCanvas 사용 가능 (성능 향상)
}
```

### 기본 설정
```typescript
import { defaults } from '@cp949/web-image-util';

const myDefaults = {
  quality: defaults.quality,    // 0.8
  fit: defaults.fit,           // 'cover'
  format: defaults.format,     // 'png'
  blurRadius: defaults.blurRadius  // 2
};
```

### 라이브러리 정보
```typescript
import { version } from '@cp949/web-image-util';

console.log(version); // "2.0.0-alpha"
```

## 🚨 에러 처리

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source)
    .resize(300, 200)
    .toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error(`[${error.code}] ${error.message}`);

    // 에러 코드별 처리
    switch (error.code) {
      case 'INVALID_INPUT':
        // 잘못된 입력 처리
        break;
      case 'CANVAS_CREATION_FAILED':
        // Canvas 생성 실패 처리
        break;
      case 'OUTPUT_FAILED':
        // 출력 변환 실패 처리
        break;
    }
  }
}
```

## 📚 TypeScript 지원

완전한 타입 정의를 제공합니다:

```typescript
import type {
  // 입력 타입
  ImageSource,

  // 옵션 타입
  ResizeOptions,
  AtMostOptions,
  BlurOptions,
  OutputOptions,
  ProcessorOptions,

  // 결과 타입
  BlobResult,
  DataURLResult,
  FileResult,

  // 유틸리티 타입
  ResizeFit,
  ResizePosition,
  BackgroundColor,
  ImageFormat,
  ImageErrorCode
} from '@cp949/web-image-util';
```

## 🎯 성능 팁

### 대용량 이미지 처리
```typescript
// 고해상도 이미지는 단계적으로 처리
const result = await processImage(largeImage)
  .atMostWidth(1920)  // 먼저 적당한 크기로 축소
  .blur(2)
  .resize(800, 600)
  .toBlob('webp');
```

### 배치 처리
```typescript
// 여러 이미지를 순차 처리
const results = await Promise.all(
  images.map(img =>
    processImage(img)
      .resize(300, 300)
      .toBlob()
  )
);
```

## 🧪 테스트 환경

현재 테스트는 **Node.js 환경에서만** 실행됩니다:

```bash
npm test          # Node.js 환경에서 모든 테스트 실행
npm run test:node # Node.js 전용 테스트 실행
npm run test:contract # 계약 테스트 실행
```

**테스트 특징:**
- ✅ **Node.js 환경**: happy-dom을 사용한 DOM 모킹
- ✅ **계약 테스트**: 브라우저 API 호환성 검증
- ✅ **성능 테스트**: 메모리 사용량 및 처리 시간 테스트
- ⏳ **브라우저 테스트**: 향후 추가 예정

**GitHub Actions 호환성:**
- CI/CD 파이프라인에서 브라우저 없이 테스트 실행
- 배포 전 자동 품질 검증

## 🌐 브라우저 호환성

- **Chrome**: 88+ ✅
- **Firefox**: 90+ ✅
- **Safari**: 14+ ✅
- **Edge**: 88+ ✅

필수 브라우저 API:
- Canvas 2D Context
- FileReader API
- Blob API

## 📄 라이선스

MIT License

## 🔗 관련 링크

- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [타입 정의](https://github.com/cp949/web-image-util/blob/main/packages/web-image-util/src/types/index.ts)