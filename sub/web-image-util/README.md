# @cp949/web-image-util

> 웹 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리

Canvas 2D API 기반으로 다양한 이미지 처리 기능을 제공합니다. 체이닝 가능한 API로 직관적인 이미지 처리를 지원합니다.

**🎯 설계 철학**: 이 라이브러리는 리사이저(resizer)로서, [Sharp](https://github.com/lovell/sharp)의 API 설계를 웹 브라우저 환경에 맞게 적용하여 구현했습니다. Server-side 이미지 처리의 편의성을 클라이언트 사이드에서도 제공하는 것이 목표입니다.

## 📚 문서 가이드

**🎯 처음 사용한다면**
→ 이 문서에서 [기본 사용법](#-기본-사용법)과 [리사이징 가이드](#-리사이징-완전-가이드)를 읽어보세요

**🔥 고급 기능이 필요하다면**
→ [고급 기능 가이드](./README-ADVANCED.md) - 필터, 워터마크, 합성, 성능 최적화

**📖 완전한 API 문서가 필요하다면**
→ [API 레퍼런스](./README-API.md) - 모든 함수, 타입, 인터페이스

**💡 실제 동작을 보고 싶다면**
→ [예제 앱](../../apps/exam/) - 10가지 인터랙티브 데모

---

## 🎯 주요 기능

### 🔧 이미지 리사이징 (핵심 기능)
- **5가지 fit 모드**: cover, contain, fill, inside, outside
- **스마트 리사이징**: 확대/축소 제어, 비율 유지 옵션
- **다양한 케이스**: 너비/높이 개별 조정, 최대/최소 크기 제한

### 🧠 SVG 판정 로직 (핵심 기술)
- **정확한 소스 감지**: 프롤로그 처리 후 정확한 SVG 태그 매칭
- **이중 검증 시스템**: MIME 타입 + 내용 스니핑으로 안전한 판정
- **오판정 방지**: HTML 내 SVG, 일반 XML 등 비SVG 소스 정확히 구분
- **다양한 소스 지원**: 인라인, Data URL, Blob URL, HTTP URL, 파일 경로

### 📋 편의 함수 (Presets)
- **썸네일 생성**: `createThumbnail()` - 웹 최적화 (WebP 우선)
- **아바타 생성**: `createAvatar()` - 고품질 프로필 이미지 (투명도 지원)
- **소셜 이미지**: `createSocialImage()` - 플랫폼별 최적화

### ✨ 주요 특징
- **🔗 체이닝 API**: 직관적인 메서드 체이닝으로 편리한 사용
- **🎯 타입 안전**: 완전한 TypeScript 지원
- **🌐 브라우저 네이티브**: Canvas API 기반으로 의존성 없음
- **📦 트리쉐이킹**: ES 모듈로 번들 크기 최적화
- **🛡️ 보안성**: XSS 방지, 캔버스 오염 방지, 안전한 SVG 처리

### 🎨 SVG 품질 보장 (v2.0.19+)

**벡터 품질 완전 보존**: SVG를 어떤 크기로 리사이징해도 선명한 결과를 보장합니다.

```typescript
// 고품질 SVG 리사이징 - 1000x1000으로 확대해도 선명함
const result = await processImage(svgString)
  .resize(1000, 1000)
  .toBlob({ format: 'png' });
```

**개선 사항**:
- ✅ **벡터 품질 보존**: SVG 원본을 그대로 유지하고 Canvas에서 직접 타겟 크기로 렌더링
- ✅ **고품질 확대**: 작은 SVG를 큰 크기로 리사이징해도 선명한 경계와 텍스트 유지
- ✅ **최적화된 처리**: 불필요한 중간 래스터화 단계 제거로 성능 및 메모리 효율 향상

**기술 세부사항**:
- Canvas를 처음부터 목표 크기로 생성하여 품질 저하 방지
- SVG의 벡터 특성을 완전히 활용하는 렌더링 파이프라인
- 중복된 SVG 처리 코드 3,400줄 제거로 간결하고 안정적인 구현

---

## 🚀 설치

```bash
npm install @cp949/web-image-util
```

---

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
```

---

## 🔧 리사이징 완전 가이드

라이브러리의 핵심 기능인 리사이징의 모든 사용 케이스를 상세히 설명합니다.

### 1. 기본 리사이징

```typescript
// 정확한 크기로 리사이징 (기본: cover 모드)
await processImage(source).resize(300, 200).toBlob();

// fit 모드 명시적 지정
await processImage(source).resize(300, 200, { fit: 'cover' }).toBlob();
```

### 2. 비율 유지 vs 무시

```typescript
// ✅ 비율 유지하며 영역 가득 채움 (일부 잘림 가능)
await processImage(source).resize(300, 200, { fit: 'cover' }).toBlob();

// ✅ 비율 유지하며 전체 이미지 보임 (여백 생성)
await processImage(source).resize(300, 200, {
  fit: 'contain',
  background: '#ffffff'  // 여백 색상
}).toBlob();

// ❌ 비율 무시하고 강제 맞춤 (이미지 변형됨)
await processImage(source).resize(300, 200, { fit: 'fill' }).toBlob();
```

### 3. 한쪽 크기만 지정 (비율 자동 계산)

```typescript
// 너비만 지정, 높이는 비율에 따라 자동
await processImage(source).resize(800, null).toBlob();
await processImage(source).resize(800, undefined).toBlob();

// 높이만 지정, 너비는 비율에 따라 자동
await processImage(source).resize(null, 600).toBlob();
await processImage(source).resize(undefined, 600).toBlob();
```

### 4. 확대/축소 제어

```typescript
// 확대 방지 (축소만 허용) - 작은 이미지는 그대로 유지
await processImage(source).resize(800, 600, {
  fit: 'cover',
  withoutEnlargement: true
}).toBlob();

// 축소 방지 (확대만 허용) - 큰 이미지는 그대로 유지
await processImage(source).resize(800, 600, {
  fit: 'cover',
  withoutReduction: true
}).toBlob();
```

### 5. 최대 크기 제한 (축소만)

```typescript
// 최대 너비 800px (확대 안함, 축소만)
await processImage(source).resize(800, null, {
  withoutEnlargement: true
}).toBlob();

// 최대 사각형 800x600 (확대 안함, 축소만)
await processImage(source).resize(800, 600, {
  fit: 'contain',
  withoutEnlargement: true
}).toBlob();
```

### 6. 최소 크기 보장 (확대만)

```typescript
// 최소 너비 800px 보장 (축소 안함, 확대만)
await processImage(source).resize(800, null, {
  withoutReduction: true
}).toBlob();

// 최소 영역 800x600 보장 (축소 안함, 확대만)
await processImage(source).resize(800, 600, {
  fit: 'cover',
  withoutReduction: true
}).toBlob();
```

### 7. 잘림 위치 조정 (cover 모드)

```typescript
// 상단 중심으로 잘림
await processImage(source).resize(300, 200, {
  fit: 'cover',
  position: 'top'
}).toBlob();

// 왼쪽 중심으로 잘림
await processImage(source).resize(300, 200, {
  fit: 'cover',
  position: 'left'
}).toBlob();

// 우하단 중심으로 잘림
await processImage(source).resize(300, 200, {
  fit: 'cover',
  position: 'bottom-right'
}).toBlob();
```

### 📊 fit 모드 완전 비교표

| fit 모드  | 비율 유지 | 원본 완전 보임 | 여백 생성 | 이미지 잘림 | 확대/축소 | 주요 사용 사례      |
| --------- | --------- | -------------- | --------- | ----------- | --------- | ------------------- |
| `cover`   | ✅         | ❌              | ❌         | ✅           | 둘 다     | 썸네일, 배경 이미지 |
| `contain` | ✅         | ✅              | ✅         | ❌           | 둘 다     | 갤러리, 프리뷰      |
| `fill`    | ❌         | ✅              | ❌         | ❌           | 둘 다     | 정확한 크기 필요시  |
| `inside`  | ✅         | ✅              | ❌         | ❌           | 축소만    | 원본 보호           |
| `outside` | ✅         | ✅              | ❌         | ❌           | 확대만    | 최소 크기 보장      |

### 🎯 실무 사용 케이스

```typescript
// 🖼️ 썸네일 생성 (정사각형, 잘림 허용)
const thumbnail = await processImage(photo)
  .resize(200, 200, { fit: 'cover' })
  .toBlob({ format: 'webp', quality: 0.8 });

// 📱 모바일 최적화 (세로 비율 유지)
const mobile = await processImage(photo)
  .resize(400, null, { withoutEnlargement: true })
  .toBlob({ format: 'webp', quality: 0.7 });

// 🖥️ 데스크톱 배너 (가로 고정, 세로 자동)
const banner = await processImage(photo)
  .resize(1200, null, { fit: 'cover' })
  .toBlob({ format: 'jpeg', quality: 0.85 });

// 👤 프로필 아바타 (정사각형, 고품질)
const avatar = await processImage(userPhoto)
  .resize(150, 150, { fit: 'cover', position: 'top' })
  .toBlob({ format: 'png', quality: 0.9 });

// 📄 문서 첨부용 (파일 크기 최소화)
const document = await processImage(scan)
  .resize(800, null, {
    fit: 'contain',
    withoutEnlargement: true,
    background: '#ffffff'
  })
  .toBlob({ format: 'jpeg', quality: 0.6 });
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

// 📷 웹용 썸네일 (성능 최적화)
const thumbnail = await createThumbnail(source, {
  size: 300,                    // 300x300 정사각형
  format: 'webp',              // WebP 우선 (미지원시 JPEG)
  quality: 0.8                 // 적당한 품질
  // 자동 설정: cover fit, 흰색 배경
});

// 👤 프로필 아바타 (품질 우선)
const avatar = await createAvatar(userPhoto, {
  size: 64,                    // 64x64
  format: 'png',               // PNG (투명도 지원)
  quality: 0.9                 // 고품질
  // 자동 설정: cover fit, 투명 배경, 중앙 정렬
});

// 📱 소셜 미디어 (호환성 우선)
const instagramPost = await createSocialImage(photo, {
  platform: 'instagram',       // 1080x1080 자동 적용
  format: 'jpeg',              // JPEG (호환성 우선)
  quality: 0.85                // 균형잡힌 품질
  // 자동 설정: contain fit, 흰색 배경
});

// 지원되는 플랫폼: 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'pinterest'
```

**각 함수의 자동 최적화:**
- **createThumbnail**: 웹 성능 중심 (WebP 우선, cover fit)
- **createAvatar**: 품질 중심 (PNG, 고품질, 투명도)
- **createSocialImage**: 호환성 중심 (JPEG, contain fit, 플랫폼 크기)

---

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

### 🎨 SVG 판정 로직

#### 🧠 **고도화된 SVG 판정 로직**

라이브러리의 **핵심 기술**로, 다양한 형태의 SVG 입력을 정확하고 안전하게 감지합니다:

**📋 판정 우선순위:**
1. **인라인 SVG 마크업** - 프롤로그 처리 후 정확한 `<svg>` 태그 매칭
2. **Data URL** - `data:image/svg+xml` 접두사 + 내용 검증
3. **Blob URL** - MIME 타입 + 내용 스니핑 이중 확인
4. **HTTP(S) URL** - Content-Type 우선, 확장자는 보조 힌트
5. **파일 경로** - 확장자 기반 (`.svg`)

**🔍 프롤로그 정제 과정:**
```typescript
// ✅ 다음을 모두 제거한 후 <svg> 태그 확인
// - UTF-8 BOM (\uFEFF)
// - XML 선언 (<?xml ...?>)
// - HTML/SVG 주석 (<!-- ... -->)
// - DOCTYPE 선언 (<!DOCTYPE svg ...>)
// - 공백 문자들

// 예시: 복잡한 SVG도 정확히 판정
const complexSvg = `\uFEFF<?xml version="1.0" encoding="UTF-8"?>
<!-- Designer: John Doe -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Main content -->
<svg xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40"/>
</svg>`;

await processImage(complexSvg).resize(200, 200).toBlob(); // ✅ 정확히 SVG로 감지
```

**🛡️ 오판정 방지:**
```typescript
// ❌ 이제 SVG로 잘못 판정되지 않음
const htmlDoc = '<html><body><svg>...</svg></body></html>';     // → path 타입
const xmlDoc = '<?xml version="1.0"?><root>data</root>';        // → path 타입
const textWithSvg = 'This text contains <svg> tag';             // → path 타입

// ✅ 정확한 SVG만 SVG로 판정
const validSvg = '<svg xmlns="http://www.w3.org/2000/svg">...</svg>'; // → svg 타입
```

**🔄 이중 검증 시스템:**
- **1차**: MIME 타입 확인 (`image/svg+xml`)
- **2차**: 내용 스니핑으로 재확인 (첫 4KB 분석)
- **XML 계열**: `text/xml`, `application/xml`에서 실제 SVG 내용 확인
- **안전성**: 서버 MIME 오류나 Blob 타입 누락에도 정확한 판정

**SVG 자동 감지 및 고품질 처리:**
- **정확한 SVG 판정**: 오판정 없는 엄격한 검증 시스템
- **다양한 소스 지원**: XML 태그, Data URL, 파일 확장자, HTTP Content-Type
- **벡터 품질 보존**: 확대해도 화질 저하 없는 고해상도 렌더링
- **호환성 개선**: 누락된 네임스페이스, viewBox 자동 생성, 레거시 문법 현대화
- **표준 fit 모드 지원**: contain, cover, fill, inside, outside 모든 모드 완벽 지원
- **보안 고려**: XSS 방지, 캔버스 오염 방지, CORS 처리

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

**지원되는 SVG 소스 타입:**
```typescript
// 1. SVG XML 문자열
const svgXml = '<svg width="100" height="100">...</svg>';
await processImage(svgXml).resize(200, 200).toBlob();

// 2. Data URL SVG
const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz4uLi48L3N2Zz4=';
await processImage(svgDataUrl).resize(200, 200).toBlob();

// 3. HTTP/HTTPS URL (.svg 확장자 또는 Content-Type: image/svg+xml)
await processImage('https://example.com/icon.svg').resize(200, 200).toBlob();
await processImage('https://api.com/icon').resize(200, 200).toBlob(); // Content-Type으로 감지

// 4. 파일 경로
await processImage('./assets/logo.svg').resize(200, 200).toBlob();

// 5. File 객체 (type='image/svg+xml' 또는 .svg 확장자)
const svgFile = new File([svgXml], 'icon.svg', { type: 'image/svg+xml' });
await processImage(svgFile).resize(200, 200).toBlob();

// 6. Blob 객체 (type='image/svg+xml')
const svgBlob = new Blob([svgXml], { type: 'image/svg+xml' });
await processImage(svgBlob).resize(200, 200).toBlob();

// 7. Blob URL (Content-Type으로 감지)
const blobUrl = URL.createObjectURL(svgBlob);
await processImage(blobUrl).resize(200, 200).toBlob();
```

---

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

---

## 🚀 고급 기능 (v2.1+)

Phase 3에서 추가된 최첨단 성능 최적화 및 SVG 특화 기능들입니다.

### ⚡ 성능 최적화

브라우저 기능에 따라 자동으로 최적화되거나 수동으로 성능 모드를 제어할 수 있습니다:

```typescript
// 🎯 자동 성능 최적화 (권장)
const result = await processImage(svgSource)
  .resize(800, 600)
  .performanceMode('auto') // 브라우저 기능에 따라 자동 최적화
  .toBlob('png');

// 🏃 고성능 모드 (OffscreenCanvas + Web Worker 우선)
const highPerf = await processImage(svgSource)
  .performanceMode('high-performance') // OffscreenCanvas 우선 사용
  .toBlob('webp');

// 🎨 고품질 모드 (품질 우선)
const highQuality = await processImage(svgSource)
  .performanceMode('high-quality') // 최고 품질 우선
  .toBlob('png');

// ⚖️ 균형 모드 (성능과 품질의 균형)
const balanced = await processImage(svgSource)
  .performanceMode('balanced') // 균형잡힌 처리
  .toBlob('jpeg');
```

**성능 모드별 특징:**
- **auto** (기본값): 브라우저 기능 감지 후 자동 최적화
- **high-performance**: OffscreenCanvas + Web Worker 우선 (30% 성능 향상)
- **high-quality**: 최고 품질 우선 (2x-4x 고해상도 렌더링)
- **balanced**: 성능과 품질의 균형

### 🎨 SVG 특화 기능

SVG 품질 및 최적화를 세밀하게 제어할 수 있습니다:

```typescript
// 🔍 품질 레벨 제어
const ultraQuality = await processImage(svgSource)
  .quality('ultra') // 4x 고해상도 렌더링
  .toBlob('png');

const autoQuality = await processImage(svgSource)
  .quality('auto') // SVG 복잡도에 따라 자동 결정
  .toBlob('webp');

// ⚙️ SVG 최적화 활성화
const optimized = await processImage(svgSource)
  .optimization(true) // SVG 벡터 최적화 (파일 크기 30% 감소)
  .quality('high')
  .toBlob('png');

// 🛠️ SVG 세부 옵션 제어
const customized = await processImage(svgSource)
  .svgOptions({
    preserveTransparency: true,     // 투명도 보존
    backgroundColor: '#ffffff',     // 배경색 설정
    scaleFactor: 3                  // 수동 스케일 팩터
  })
  .quality('high')
  .toBlob('png');
```

**품질 레벨 설명:**
- **auto**: SVG 복잡도 분석 후 자동 선택 (권장)
- **low**: 1x 렌더링 (빠른 처리)
- **medium**: 2x 렌더링 (기본 품질)
- **high**: 3x 렌더링 (고품질)
- **ultra**: 4x 렌더링 (최고 품질)

### 🔧 브라우저 호환성 자동 감지

브라우저별 최적화가 자동으로 적용됩니다:

```typescript
// 브라우저 기능을 수동으로 확인하고 싶다면
import { BrowserCapabilityDetector } from '@cp949/web-image-util/utils';

const capabilities = await BrowserCapabilityDetector.detectCapabilities();
console.log('OffscreenCanvas 지원:', capabilities.offscreenCanvas);
console.log('WebP 지원:', capabilities.webp);
console.log('AVIF 지원:', capabilities.avif);
```

### 🎯 실무 활용 예시

```typescript
// 📸 대용량 SVG 아이콘 처리 (성능 우선)
const icon = await processImage(largeSvgIcon)
  .resize(64, 64)
  .performanceMode('high-performance')
  .optimization(true)
  .toBlob('webp');

// 🖼️ 고품질 SVG 로고 변환 (품질 우선)
const logo = await processImage(svgLogo)
  .resize(400, 200)
  .performanceMode('high-quality')
  .quality('ultra')
  .svgOptions({ preserveTransparency: true })
  .toBlob('png');

// 🚀 배치 처리 (자동 최적화)
const thumbnails = await Promise.all(
  svgFiles.map(svg =>
    processImage(svg)
      .resize(150, 150)
      .performanceMode('auto') // 각 파일마다 자동 최적화
      .quality('auto')
      .toBlob('webp')
  )
);
```

---

## 🚀 추가 고급 기능이 필요하다면?

더 강력한 기능들을 원한다면 고급 패키지를 사용하세요:

### 🎨 색상 조정 및 필터

```typescript
import { BrightnessFilterPlugin, BlurFilterPlugin } from '@cp949/web-image-util/filters';

// 밝기 조정 + 블러 효과
const filtered = await processImage(source)
  .resize(400, 300)
  .filter(BrightnessFilterPlugin, { value: 15 })
  .filter(BlurFilterPlugin, { radius: 2 })
  .toBlob();
```

### 🏷️ 워터마크 시스템

```typescript
import { addTextWatermark } from '@cp949/web-image-util/advanced';

// 텍스트 워터마크
const watermarked = await processImage(source)
  .addTextWatermark({
    text: '© 2024 Company',
    position: 'bottom-right',
    style: { fontSize: 16, color: '#ffffff', opacity: 0.8 }
  })
  .toBlob();
```

### 📦 서브 패키지

필요한 기능만 import하여 번들 크기를 최적화할 수 있습니다:

```typescript
// 메인 API
import { processImage } from '@cp949/web-image-util';

// 편의 함수들 (프리셋)
import { createThumbnail, createAvatar } from '@cp949/web-image-util/presets';

// 고급 기능 (자세한 내용은 고급 가이드 참조)
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

// 유틸리티 함수
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/utils';

// 필터 플러그인
import { BrightnessFilterPlugin } from '@cp949/web-image-util/filters';
```

**🔥 더 자세한 고급 기능은**: [고급 기능 가이드](./README-ADVANCED.md)

---

## ⚙️ 브라우저 지원

**브라우저 호환성:**
- Chrome 88+, Firefox 90+, Safari 14+, Edge 88+

**기능 확인:**
```typescript
import { features } from '@cp949/web-image-util';

console.log(features.webp);   // WebP 지원 여부
console.log(features.avif);   // AVIF 지원 여부
```

---

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

---

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

**📖 완전한 타입 정보는**: [API 레퍼런스](./README-API.md)

---

## 📄 라이선스

MIT License

---

## 🔗 관련 링크

- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [예제 앱](../../apps/exam/)

---

<div align="center">

**더 많은 정보가 필요하신가요?**

[🚀 고급 기능](./README-ADVANCED.md) • [📖 API 문서](./README-API.md) • [💡 예제 보기](../../apps/exam/)

</div>