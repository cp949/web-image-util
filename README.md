# @cp949/web-image-util

모던 웹 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리입니다. Sharp 라이브러리의 패턴을 참고하여 설계된 체이닝 API를 제공합니다.

## 🎯 제공하는 기능

### 📐 리사이징 기능
- **크기 제한**: `atMostWidth()`, `atMostHeight()`, `atMostRect()` - 최대 크기 제한
- **크기 보장**: `atLeastWidth()`, `atLeastHeight()`, `atLeastRect()` - 최소 크기 보장
- **정확한 크기**: `resizePad()`, `resizeCover()`, `stretch()` - 정확한 크기로 맞춤
- **강제 설정**: `forceWidth()`, `forceHeight()` - 한 축 고정하여 비율 유지
- **로우레벨**: `resize()` - 세밀한 옵션 제어 가능

### 🎨 이미지 효과
- **블러**: `blur()` - 가우시안 블러 효과
- **필터**: 색상 조정, 특수 효과 (고급 기능)
- **워터마크**: 텍스트/이미지 워터마크 합성 (고급 기능)

### 📤 출력 형태
- **Blob**: `toBlob()` - 파일 업로드, 다운로드용
- **Data URL**: `toDataURL()` - `<img>` 태그 직접 사용
- **File**: `toFile()` - FormData 업로드용
- **Canvas**: `toCanvas()` - DOM 조작용

### 🔧 유틸리티
- **편의 함수**: `createThumbnail()`, `createAvatar()`, `createSocialImage()`
- **포맷 변환**: 다양한 이미지 포맷 간 변환
- **스마트 기본값**: 브라우저 지원에 따른 최적 포맷 자동 선택

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
  .atMostWidth(800)  // 최대 너비 800px, 비율 유지, 확대 없음, 축소 가능
  .toBlob({ format: 'png', quality: 0.9 });

// 썸네일 생성 (정사각형)
const thumbnail = await processImage(source)
  .atMostRect(200, 200)  // 200x200 안에 맞춤, 비율 유지, 확대 없음, 축소 가능
  .toBlob({ format: 'webp', quality: 0.8 });

// 배경 추가하여 정확한 크기 맞춤
const padded = await processImage(source)
  .resizePad(300, 200, '#ffffff')  // 300x200 크기에 흰 배경, 비율유지, 작은 이미지는 확대, 큰 이미지는 축소, 잘림 없음
  .toBlob({ format: 'jpeg', quality: 0.85 });

// 비율 유지하며 영역 채움
const covered = await processImage(source)
  .resizeCover(300, 200)  // 300x200 영역을 가득 채움, 비율유지, 작은 이미지는 확대, 큰 이미지는 축소, 잘림 가능
  .toBlob({ format: 'webp', quality: 0.8 });
```

### 편의 함수들

이미지 처리의 일반적인 사용 사례를 위한 편의 함수들:

```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage,
  createIcon,
  createBanner
} from '@cp949/web-image-util/presets';

// 📷 썸네일 생성 (정사각형)
const thumbnail = await createThumbnail(source, {
  size: 150,                    // 150x150
  format: 'webp',              // 포맷 선택
  quality: 0.8,                // 품질 설정
  background: '#ffffff'        // 배경색 (필요시)
});

// 👤 아바타 생성 (원형 또는 정사각형)
const avatar = await createAvatar(userPhoto, {
  size: 64,                    // 64x64
  shape: 'circle',             // 'circle' | 'square'
  borderWidth: 2,              // 테두리 두께
  borderColor: '#ffffff',      // 테두리 색상
  format: 'png'                // 투명도 지원을 위해 PNG
});

// 📱 소셜 미디어용 이미지
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',       // 1080x1080
  overlay: {
    text: '새로운 포스트!',
    position: 'bottom-center',
    font: '32px Arial',
    color: '#ffffff'
  }
});

const facebookCover = await createSocialImage(photo, {
  platform: 'facebook-cover',  // 820x312
  fit: 'cover',                // 전체 영역 채움
  format: 'jpeg',
  quality: 0.9
});

// 🎨 아이콘 생성 (다양한 크기)
const appIcon = await createIcon(logoSvg, {
  sizes: [16, 32, 48, 64, 128, 256],  // 여러 크기 동시 생성
  format: 'png',
  padding: 8,                          // 내부 여백
  background: 'transparent'
});
// 반환값: { '16': Blob, '32': Blob, '48': Blob, ... }

// 🖼️ 배너/헤더 이미지 생성
const websiteBanner = await createBanner(photo, {
  width: 1200,
  height: 400,
  overlay: {
    gradient: {
      direction: 'to bottom',
      colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']
    },
    text: {
      content: '웹사이트 제목',
      position: 'center',
      font: 'bold 48px Arial',
      color: '#ffffff'
    }
  },
  format: 'jpeg',
  quality: 0.85
});
```

### 📋 프리셋별 상세 옵션

```typescript
// 소셜 미디어 플랫폼별 최적화 프리셋
import {
  instagramPost,      // 1080x1080, fit: cover, format: jpeg
  instagramStory,     // 1080x1920, fit: cover, format: jpeg
  facebookPost,       // 1200x630, fit: cover, format: jpeg
  facebookCover,      // 820x312, fit: cover, format: jpeg
  twitterPost,        // 1024x512, fit: cover, format: jpeg
  twitterHeader,      // 1500x500, fit: cover, format: jpeg
  linkedinPost,       // 1200x627, fit: cover, format: jpeg
  youtubeThumbnail    // 1280x720, fit: cover, format: jpeg
} from '@cp949/web-image-util/presets';

// 직접 프리셋 사용
const instaResult = await instagramPost(photo, {
  overlay: '새로운 포스트!',
  quality: 0.9
});

// 체인 API와 결합
const customInstagram = await processImage(photo)
  .blur(1)                           // 배경 블러 효과
  .applyPreset(instagramPost, {      // 프리셋 적용
    overlay: {
      text: 'Instagram Ready!',
      position: 'center',
      style: { color: 'white', fontSize: '24px' }
    }
  })
  .toBlob();
```

### 🚀 실제 사용 시나리오

```typescript
// 📷 사용자 프로필 사진 처리 플로우
const processUserPhoto = async (file: File) => {
  // 1. 큰 아바타 (프로필 페이지용)
  const largeAvatar = await createAvatar(file, {
    size: 200,
    shape: 'circle',
    borderWidth: 4,
    borderColor: '#4285f4'
  });

  // 2. 작은 아바타 (댓글, 채팅용)
  const smallAvatar = await createAvatar(file, {
    size: 32,
    shape: 'circle',
    format: 'webp',
    quality: 0.8
  });

  // 3. 썸네일 (목록용)
  const thumbnail = await createThumbnail(file, {
    size: 100,
    format: 'webp'
  });

  return { largeAvatar, smallAvatar, thumbnail };
};

// 🖼️ 갤러리 이미지 최적화
const optimizeGalleryImage = async (image: File) => {
  const processed = await processImage(image)
    .atMostWidth(1920)               // 최대 너비 제한
    .blur(0.5)                       // 약간의 선명도 개선
    .toBlob({
      format: 'webp',                // 최신 포맷 사용
      quality: 0.85                  // 품질과 용량 균형
    });

  // 썸네일도 함께 생성
  const thumbnail = await createThumbnail(image, {
    size: 200,
    format: 'webp',
    quality: 0.7
  });

  return { optimized: processed.blob, thumbnail };
};
```

## 🎯 지원하는 입력 타입

다양한 형태의 이미지 소스를 입력으로 받을 수 있습니다:

```typescript
type ImageSource =
  | HTMLImageElement     // DOM 이미지 엘리먼트
  | Blob               // 파일 객체 (File 포함)
  | string             // ⚠️ 중요: 다양한 문자열 형태 지원!
  | ArrayBuffer        // 바이너리 데이터
  | Uint8Array;        // 바이트 배열
```

### 📝 **string 타입 상세 설명** (가장 유연한 입력 방식)

string 타입으로 다양한 이미지 소스를 지정할 수 있습니다:

```typescript
// 🌐 HTTP/HTTPS URL - 이미지 URL 로드
const result1 = await processImage('https://example.com/photo.jpg')
  .resize(300, 200)
  .toBlob({ format: 'webp' });

// 📊 Data URL - base64 인코딩된 이미지
const result2 = await processImage('data:image/jpeg;base64,/9j/4AAQSkZJRgABA...')
  .atMostWidth(400)
  .toBlob();

// 🎨 SVG XML - 벡터 그래픽을 비트맵으로 렌더링
const result3 = await processImage(`
  <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="40" fill="red"/>
  </svg>
`).resize(200, 200).toBlob({ format: 'png' });

// 파일 경로 - 상대/절대 경로 모두 지원
const result4 = await processImage('./assets/logo.png')
  .atMostRect(150, 150)
  .toBlob({ format: 'webp' });

const result5 = await processImage('/images/banner.jpg')
  .resizeCover(800, 400)
  .toBlob({ format: 'jpeg', quality: 0.8 });
```

### 📦 **기타 입력 타입 예시**

```typescript
// DOM 이미지 엘리먼트
const imgElement = document.querySelector('img');
const result1 = await processImage(imgElement).resize(300, 200).toBlob();

// File 객체 (사용자 업로드)
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const result2 = await processImage(file).atMostWidth(800).toBlob();

// Blob 객체
const blob = new Blob([imageData], { type: 'image/jpeg' });
const result3 = await processImage(blob).blur(3).toBlob();
```

## 📤 출력 형태 상세 가이드

### Blob 출력 (권장 방법)

파일 업로드, 다운로드, FormData 전송에 적합:

```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format: 'webp', quality: 0.8 });

// 반환되는 메타데이터
console.log(result.blob);           // Blob 객체
console.log(result.width);          // 300 (처리 후 너비)
console.log(result.height);         // 200 (처리 후 높이)
console.log(result.processingTime); // 15 (처리 시간, ms)
console.log(result.originalSize);   // { width: 1200, height: 800 } (원본 크기)

// FormData로 업로드
const formData = new FormData();
formData.append('image', result.blob, 'processed.webp');
fetch('/upload', { method: 'POST', body: formData });

// 다운로드 링크 생성
const downloadUrl = URL.createObjectURL(result.blob);
const link = document.createElement('a');
link.href = downloadUrl;
link.download = 'image.webp';
link.click();
```

### Data URL 출력

`<img>` 태그, CSS background-image에 직접 사용 가능:

```typescript
const result = await processImage(source)
  .resize(300, 200)
  .toDataURL({ format: 'png', quality: 0.9 });

// 반환되는 데이터
console.log(result.dataURL);        // 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
console.log(result.width);          // 300
console.log(result.height);         // 200
console.log(result.processingTime); // 15 (ms)

// 즉시 DOM에 표시
const imgElement = document.querySelector('#preview');
imgElement.src = result.dataURL;

// CSS background로 사용
document.body.style.backgroundImage = `url(${result.dataURL})`;

// Canvas에 그리기
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();
img.onload = () => ctx.drawImage(img, 0, 0);
img.src = result.dataURL;

// 간단한 형태 (기본값 사용)
const simple = await processImage(source)
  .resize(300, 200)
  .toDataURL('png'); // PNG, 최적 품질 자동 선택
```

### File 출력

FormData 업로드용 File 객체 생성:

```typescript
// 명시적 옵션 지정
const result = await processImage(source)
  .resize(300, 200)
  .toFile('thumbnail.webp', { format: 'webp', quality: 0.8 });

console.log(result.file.name);      // 'thumbnail.webp'
console.log(result.file.type);      // 'image/webp'
console.log(result.file.size);      // 15420 (bytes)
console.log(result.width);          // 300
console.log(result.height);         // 200

// 파일명 확장자로 포맷 자동 감지
const result2 = await processImage(source)
  .resize(300, 200)
  .toFile('avatar.jpg');        // JPEG 포맷, 최적 품질 자동 선택

const result3 = await processImage(source)
  .atMostWidth(800)
  .toFile('banner.png');        // PNG 포맷

// FormData로 서버 업로드
const formData = new FormData();
formData.append('thumbnail', result.file);
formData.append('userId', '12345');

fetch('/api/upload', {
  method: 'POST',
  body: formData
}).then(response => response.json())
  .then(data => console.log('업로드 성공:', data));
```

### Canvas 출력

고성능 Canvas 조작을 위한 직접 접근:

```typescript
const canvas = await processImage(source)
  .atMostWidth(800)
  .blur(2)
  .toCanvas();

// DOM에 직접 추가
document.body.appendChild(canvas);

// Canvas 2D Context로 추가 작업
const ctx = canvas.getContext('2d');

// 추가 그리기 작업
ctx.fillStyle = 'red';
ctx.fillRect(10, 10, 50, 50);     // 빨간 사각형 추가

ctx.font = '20px Arial';
ctx.fillStyle = 'white';
ctx.fillText('워터마크', 20, 40); // 텍스트 추가

// Canvas를 Blob으로 변환
canvas.toBlob(blob => {
  const url = URL.createObjectURL(blob);
  console.log('최종 이미지 URL:', url);
}, 'image/png');

// 또는 기존 Canvas에 그리기
const existingCanvas = document.querySelector('#myCanvas');
const existingCtx = existingCanvas.getContext('2d');
existingCtx.drawImage(canvas, 0, 0); // 처리된 이미지를 기존 Canvas에 그리기
```

## 🎯 리사이징 메서드

### 📐 크기 제한 메서드
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

### 🔥 고급 기능 (Advanced Features)

고급 이미지 처리 기능을 사용하려면 별도 서브패키지를 import하세요:

#### 색상 조정 및 필터
```typescript
import { AdvancedProcessor, filterManager } from '@cp949/web-image-util/advanced';

// 색상 조정
const result = await AdvancedProcessor.from(source)
  .brightness(0.2)        // 밝기 20% 증가
  .contrast(0.3)          // 대비 30% 증가
  .saturation(-0.1)       // 채도 10% 감소
  .hue(15)               // 색조 15도 회전
  .gamma(1.2)            // 감마 보정
  .toBlob();

// 특수 효과
const filtered = await AdvancedProcessor.from(source)
  .grayscale()           // 그레이스케일 변환
  .sepia()              // 세피아 효과
  .invert()             // 색상 반전
  .threshold(128)        // 이진화 (임계값 128)
  .toBlob();

// 커스텀 필터 적용
const custom = await AdvancedProcessor.from(source)
  .applyFilter(filterManager.vintage)    // 빈티지 필터
  .applyFilter(filterManager.dramatic)   // 드라마틱 필터
  .toBlob();
```

#### 워터마크 및 합성
```typescript
import { AdvancedProcessor } from '@cp949/web-image-util/advanced';

// 텍스트 워터마크
const watermarked = await AdvancedProcessor.from(source)
  .addTextWatermark('© 2024 My Company', {
    position: 'bottom-right',
    font: '24px Arial',
    color: 'rgba(255, 255, 255, 0.8)',
    margin: { x: 20, y: 20 }
  })
  .toBlob();

// 이미지 워터마크
const logoWatermark = await AdvancedProcessor.from(source)
  .addImageWatermark('./logo.png', {
    position: 'top-left',
    opacity: 0.6,
    scale: 0.3,
    margin: { x: 10, y: 10 }
  })
  .toBlob();

// 다중 레이어 합성
const composite = await AdvancedProcessor.from(background)
  .addLayer(overlay1, { blend: 'multiply', opacity: 0.7 })
  .addLayer(overlay2, { blend: 'screen', opacity: 0.5 })
  .addTextLayer('합성 이미지', {
    position: 'center',
    font: '32px bold Arial',
    color: '#ffffff',
    stroke: { color: '#000000', width: 2 }
  })
  .toBlob();
```

#### 그리드 레이아웃 및 콜라주
```typescript
import { AdvancedProcessor } from '@cp949/web-image-util/advanced';

// 2x2 그리드 생성
const grid = await AdvancedProcessor.createGrid([image1, image2, image3, image4], {
  columns: 2,
  rows: 2,
  cellSize: { width: 300, height: 300 },
  spacing: 10,
  background: '#ffffff'
});

// 콜라주 스타일 배치
const collage = await AdvancedProcessor.createCollage([
  { image: photo1, x: 0, y: 0, width: 400, height: 300 },
  { image: photo2, x: 410, y: 0, width: 300, height: 200 },
  { image: photo3, x: 410, y: 210, width: 300, height: 90 }
], {
  canvasSize: { width: 720, height: 300 },
  background: '#f5f5f5'
});
```

### 📱 다운로드 기능

브라우저에서 처리된 이미지를 자동으로 다운로드할 수 있습니다:

```typescript
import { processImage } from '@cp949/web-image-util';

// 기본 다운로드 (파일명 자동 생성)
const result = await processImage(source)
  .resize(800, 600)
  .download();  // 'image.webp' 또는 'image.png'로 자동 다운로드

// 커스텀 파일명으로 다운로드
const result2 = await processImage(source)
  .atMostWidth(1200)
  .download('my-photo.jpg');  // 'my-photo.jpg'로 다운로드

// 포맷과 품질 지정하여 다운로드
const result3 = await processImage(source)
  .resizeCover(1920, 1080)
  .download('wallpaper.png', {
    format: 'png',
    quality: 1.0
  });

// 모바일 친화적 다운로드 (파일명 확장자 자동 수정)
const result4 = await processImage(source)
  .createThumbnail(300)
  .download('thumbnail.old');  // 실제로는 'thumbnail.webp'로 다운로드됨
```

## 📦 서브 엔트리포인트

필요한 기능만 import하여 번들 크기를 최적화할 수 있습니다:

### 메인 패키지
```typescript
// 기본 이미지 처리 API (권장)
import { processImage } from '@cp949/web-image-util';

// 타입 정의들
import type {
  ImageSource,
  ResizeOptions,
  BlobResult,
  DataURLResult,
  FileResult
} from '@cp949/web-image-util';
```

### 📋 presets 패키지 - 편의 함수들
```typescript
import {
  createThumbnail,
  createAvatar,
  createSocialImage,
  createIcon,
  createBanner
} from '@cp949/web-image-util/presets';

// 소셜 미디어별 프리셋
import {
  instagramPost,    // 1080x1080
  facebookCover,    // 820x312
  twitterHeader,    // 1500x500
  youtubeThumbnail  // 1280x720
} from '@cp949/web-image-util/presets';
```

### 🔧 utils 패키지 - 변환 유틸리티
```typescript
import {
  // 포맷 변환
  toBlob,
  toDataURL,
  toFile,
  toCanvas,

  // 소스 변환
  fromElement,
  fromBlob,
  fromDataURL,
  fromSVG,

  // 메타데이터
  getImageInfo,
  getDimensions,
  getFormat,

  // 브라우저 지원 확인
  features,
  isWebPSupported,
  isAVIFSupported
} from '@cp949/web-image-util/utils';
```

### 🎨 advanced 패키지 - 고급 이미지 처리
```typescript
import {
  AdvancedProcessor,
  filterManager,
  LayerBlendMode,
  CompositeProcessor
} from '@cp949/web-image-util/advanced';

// 색상 조정 도구
import {
  ColorAdjuster,
  HSLAdjuster,
  CurveAdjuster
} from '@cp949/web-image-util/advanced';

// 레이어 합성
import {
  LayerCompositor,
  BlendModes
} from '@cp949/web-image-util/advanced';
```

### 🌈 filters 패키지 - 필터 플러그인
```typescript
// 기본 필터들
import {
  BlurFilter,
  SharpenFilter,
  EmbossFilter,
  EdgeDetectFilter
} from '@cp949/web-image-util/filters';

// 색상 필터들
import {
  GrayscaleFilter,
  SepiaFilter,
  VintageFilter,
  DramaticFilter,
  InvertFilter
} from '@cp949/web-image-util/filters';

// 특수 효과 필터들
import {
  VignetteFilter,
  NoiseFilter,
  PixelateFilter,
  OilPaintingFilter
} from '@cp949/web-image-util/filters';
```

### 📱 mobile 패키지 - 모바일 최적화 (향후 계획)
```typescript
// 터치 제스처 지원
import {
  TouchCropProcessor,
  PinchZoomProcessor,
  SwipeFilterProcessor
} from '@cp949/web-image-util/mobile';

// 모바일 카메라 통합
import {
  CameraCapture,
  PhotoLibraryAccess,
  FilePickerOptimized
} from '@cp949/web-image-util/mobile';
```

### 번들 크기 최적화 예제
```typescript
// ❌ 전체 라이브러리 import (큰 번들 크기)
import * as WebImageUtil from '@cp949/web-image-util';

// ✅ 필요한 기능만 import (최적화된 번들)
import { processImage } from '@cp949/web-image-util';
import { createThumbnail } from '@cp949/web-image-util/presets';
import { toBlob } from '@cp949/web-image-util/utils';
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

console.log(version); // "2.x.x"
```

## 🚨 에러 처리

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source)
    .resize(300, 200)
    .toBlob(); // WebP 지원 시 WebP/0.8, 미지원 시 PNG/1.0
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
  .toBlob({ format: 'webp', quality: 0.8 });
```

### 배치 처리
```typescript
// 여러 이미지를 순차 처리 (기본: WebP/PNG 자동 선택)
const results = await Promise.all(
  images.map(img =>
    processImage(img)
      .resize(300, 300)
      .toBlob() // WebP 지원 시 WebP/0.8, 미지원 시 PNG/1.0
  )
);

// 또는 명시적 포맷 지정
const results2 = await Promise.all(
  images.map(img =>
    processImage(img)
      .resize(300, 300)
      .toBlob({ format: 'jpeg', quality: 0.85 })
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