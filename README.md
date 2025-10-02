# @cp949/web-image-util

> 🎨 모던 웹 브라우저에서 이미지 처리를 위한 고성능 TypeScript 라이브러리

Canvas 2D API 기반으로 구축된 브라우저 네이티브 이미지 처리 라이브러리입니다. Sharp.js의 직관적인 체이닝 API 패턴을 웹 브라우저 환경에 맞게 설계했습니다.

## 🌟 주요 특징

- **🔗 체이닝 API**: Sharp와 유사한 직관적인 메서드 체이닝
- **🎯 완전한 타입 안전성**: TypeScript로 작성된 풀 스택 타입 지원
- **🌐 브라우저 네이티브**: Canvas API 기반, 외부 의존성 없음
- **📦 트리쉐이킹 지원**: ES 모듈로 번들 크기 최적화
- **⚡ 고성능**: Canvas 풀링과 메모리 최적화
- **🎨 모던 포맷**: WebP, JPEG, PNG 지원 (AVIF는 브라우저 지원에 따라)
- **📱 반응형**: 다양한 화면 크기와 기기에 최적화

## 🚀 빠른 시작

```bash
npm install @cp949/web-image-util
```

```typescript
import { processImage } from '@cp949/web-image-util';

// 🆕 권장: 새로운 ResizeConfig API
const thumbnail = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// 고급 이미지 처리
const result = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600, background: '#ffffff' })
  .blur(2)
  .toBlob({ format: 'webp', quality: 0.8 });

// 소셜 미디어용 이미지
const instagramPost = await processImage(source)
  .resize({ fit: 'cover', width: 1080, height: 1080 })
  .toFile('instagram-post.jpg');
```


---

## 📦 sub/web-image-util

### 🎯 핵심 라이브러리 기능

메인 라이브러리는 다음과 같은 포괄적인 이미지 처리 기능을 제공합니다:

#### 📐 **리사이징 엔진**
```typescript
// 정확한 크기 제어
processImage(source).resize({ fit: 'cover', width: 300, height: 200 })   // 잘라서 맞춤 (비율 유지, 전체 영역 채움)
processImage(source).resize({ fit: 'contain', width: 300, height: 200 }) // 비율 유지하며 맞춤 (전체 이미지 표시)
processImage(source).resize({ fit: 'fill', width: 300, height: 200 })    // 늘려서 정확히 맞춤 (비율 변경됨)

// 스마트 크기 제한 (축소만, 확대 안함)
processImage(source).resize({ fit: 'maxFit', width: 800, height: 600 })  // 최대 800x600 내에서 맞춤
processImage(source).resize({ fit: 'maxFit', width: 800 })               // 최대 너비 800px
processImage(source).resize({ fit: 'maxFit', height: 600 })              // 최대 높이 600px

// 크기 보장 (확대만, 축소 안함)
processImage(source).resize({ fit: 'minFit', width: 400, height: 300 })  // 최소 400x300 보장
processImage(source).resize({ fit: 'minFit', width: 300 })               // 최소 너비 300px 보장
```

#### 🎨 **이미지 효과 & 필터**
```typescript
// 기본 블러 효과
const blurred = await processImage(source)
  .resize({ fit: 'cover', width: 400, height: 300 })
  .blur(2)  // 블러 반지름 2px
  .toBlob();

// 고급 기능 (advanced 서브패키지) - 워터마크
import { SimpleWatermark } from '@cp949/web-image-util/advanced';

// 텍스트 워터마크
const canvas = await processImage(source).resize({ fit: 'cover', width: 400, height: 300 }).toCanvas();
const watermarked = SimpleWatermark.addText(canvas, {
  text: '© 2024 회사명',
  position: 'bottom-right',
  style: 'white-shadow'
});
```

#### 📤 **출력 포맷 & 최적화**
```typescript
// 다양한 출력 형태 (확장됨)
const blob = await processImage(source).toBlob({ format: 'webp', quality: 0.8 });
const dataURL = await processImage(source).toDataURL({ format: 'jpeg', quality: 0.9 });
const file = await processImage(source).toFile('image.png');
const canvas = await processImage(source).toCanvas();
const element = await processImage(source).toElement();     // HTMLImageElement
const arrayBuffer = await processImage(source).toArrayBuffer(); // ArrayBuffer
const uint8Array = await processImage(source).toUint8Array();   // Uint8Array

// 포맷별 최적화된 설정
const webpResult = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format: 'webp', quality: 0.8 });  // WebP는 높은 압축률

const jpegResult = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .toBlob({ format: 'jpeg', quality: 0.85 }); // JPEG는 사진에 적합
```

#### 🎛️ **편의 함수 (Presets)**
```typescript
import { createThumbnail, createAvatar, createSocialImage } from '@cp949/web-image-util/presets';

// 빠른 썸네일 생성
const thumbnail = await createThumbnail(source, {
  size: 150,
  format: 'webp',
  quality: 0.8
});

// 아바타 이미지 (정사각형 + 라운드)
const avatar = await createAvatar(source, {
  size: 120,
  background: '#f0f0f0'
});

// 소셜 미디어 규격
const igPost = await createSocialImage(source, { platform: 'instagram' });
const fbCover = await createSocialImage(source, { platform: 'facebook' });
```

#### ⚡ **배치 처리**
```typescript
// 여러 이미지 동시 처리 (Promise.all 사용)
const sources = [image1, image2, image3];

const results = await Promise.all(
  sources.map(source =>
    processImage(source)
      .resize({ fit: 'cover', width: 300, height: 200 })
      .toBlob({ format: 'webp', quality: 0.8 })
  )
);

// 순차 처리 (메모리 절약)
const batchResults = [];
for (const source of sources) {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 400, height: 300 })
    .toBlob();
  batchResults.push(result);
}
```

#### 🛠️ **유틸리티 & 변환**
```typescript
import {
  convertToBlob,
  convertToDataURL,
  convertToFile,
  convertToElement,
  enhanceBrowserCompatibility,
  features
} from '@cp949/web-image-util';

// SVG 호환성 개선
const { enhanced, report } = enhanceBrowserCompatibility(svgString, {
  fixDimensions: true,
  addNamespaces: true
});

// 이미지 소스를 HTMLImageElement로 변환
const imageElement = await convertToElement(blob);

// 직접 변환 (체이닝 없이)
const blob = await convertToBlob(canvas, { format: 'webp', quality: 0.8 });

// 브라우저 기능 지원 확인
console.log('WebP 지원:', features.webp);
console.log('AVIF 지원:', features.avif);
console.log('OffscreenCanvas 지원:', features.offscreenCanvas);
```

---

## 🖥️ apps/exam

### 📱 **인터랙티브 데모 애플리케이션**

React + Material-UI 기반의 종합적인 예제 애플리케이션으로, 라이브러리의 모든 기능을 실제 웹 환경에서 체험할 수 있습니다.

#### 🎨 **주요 예제 페이지**

1. **🏠 홈페이지**
   - 라이브러리 소개 및 주요 기능 개요
   - 빠른 시작 가이드
   - 실시간 코드 예제

2. **📐 기본 처리 (Basic Processing)**
   - 리사이징 fit 모드 비교 (cover, contain, fill, maxFit, minFit)
   - 실시간 미리보기와 Before/After 비교
   - 인터랙티브 크기 조절 슬라이더

3. **🎨 고급 기능 (Advanced Features)**
   - 워터마크 추가 (텍스트/이미지)
   - 이미지 합성 및 레이어 관리
   - 블러 효과 및 기본 필터

4. **📱 프리셋 (Presets)**
   - 소셜 미디어 규격 자동 변환
   - 썸네일 생성기
   - 아바타 생성기

5. **🔄 변환기 (Converters)**
   - 포맷 변환 (JPEG ↔ PNG ↔ WebP)
   - 품질 조절 및 압축 비교
   - 파일 크기 최적화

6. **📦 배치 처리 (Batch Processing)**
   - 다중 파일 업로드
   - 일괄 변환 및 ZIP 다운로드
   - 진행률 표시 및 성능 통계

7. **⚡ 성능 테스트 (Performance)**
   - 처리 시간 벤치마크
   - 메모리 사용량 분석
   - 대용량 이미지 처리 테스트

8. **🛠️ 개발자 도구 (Dev Tools)**
   - 이미지 메타데이터 표시
   - 디버깅 정보 및 로그
   - API 호출 모니터링

9. **🎯 필터 시스템 (Filters)**
   - 플러그인 기반 필터 아키텍처
   - 커스텀 필터 생성
   - 필터 체인 및 프리셋

10. **🖼️ SVG 호환성 (SVG Compatibility)**
    - SVG 래스터화
    - 호환성 개선 옵션
    - 브라우저별 렌더링 차이 비교

#### 🎛️ **인터랙티브 UI 특징**

```typescript
// 실시간 설정 패널
- 드래그앤드롭 파일 업로드
- 슬라이더를 통한 실시간 파라미터 조절
- Before/After 이미지 비교 뷰
- 코드 생성기 (현재 설정을 코드로 표시)
- 결과 다운로드 (다양한 포맷)

// 반응형 디자인
- 데스크톱/태블릿/모바일 최적화
- Material-UI 7.3 기반 모던 UI
- 다크/라이트 테마 지원
- 접근성 (WCAG 2.1) 준수
```

#### 🚀 **예제 앱 실행하기**

```bash
# 루트에서 모든 의존성 설치
pnpm install

# 개발 서버 시작 (권장)
pnpm dev

# 또는 개별 실행
cd apps/exam
pnpm dev
```

**URL**: `http://localhost:3000`

#### 📱 **기술 스택 (2025 최신)**

```json
{
  "React": "19.1.1",          // 최신 Concurrent Features
  "Material-UI": "7.3.x",     // 모던 컴포넌트 라이브러리
  "TypeScript": "5.9.x",      // 최신 타입 시스템
  "Vite": "7.1.x",            // 초고속 개발 서버
  "React Router": "7.9.x",    // 클라이언트 라우팅
  "Emotion": "11.14.x",       // CSS-in-JS
}
```

#### 🎯 **예제로 배우는 패턴**

```typescript
// 1. 기본 사용 패턴
const handleImageProcess = async (file: File) => {
  const result = await processImage(file)
    .resize({ fit: 'cover', width: 800, height: 600 })
    .toBlob({ format: 'webp', quality: 0.8 });

  setProcessedImage(URL.createObjectURL(result.blob));
};

// 2. 고급 필터 체인
const applyArtisticEffect = async (source: File) => {
  const processor = processImage(source);

  // 여러 효과 조합
  const result = await processor
    .resize({ fit: 'cover', width: 1024, height: 1024 })
    .blur(1)
    .toBlob({ format: 'jpeg', quality: 0.9 });

  return result;
};

// 3. 배치 처리 패턴
const processBatch = async (files: File[]) => {
  const results = await Promise.all(
    files.map(file =>
      processImage(file)
        .resize({ fit: 'cover', width: 300, height: 300 })
        .toBlob({ format: 'webp' })
    )
  );

  return results;
};
```

---

## 🏗️ 모노레포 구조

```
web-image-util/
├── 📦 sub/
│   ├── web-image-util/          # 🎯 메인 라이브러리
│   │   ├── src/
│   │   │   ├── index.ts         # 기본 API
│   │   │   ├── advanced-index.ts # 고급 기능
│   │   │   ├── presets/         # 편의 함수
│   │   │   ├── utils/           # 유틸리티
│   │   │   ├── filters/         # 필터 시스템
│   │   │   └── composition/     # 이미지 합성
│   │   ├── tests/               # 106개 테스트
│   │   └── README.md            # 📚 완전한 API 문서
│   ├── eslint-config/           # ESLint 공유 설정
│   └── typescript-config/       # TypeScript 공유 설정
├── 🖥️ apps/
│   └── exam/                    # 📱 Next.js 예제 앱
│       ├── src/
│       │   ├── app/             # Next.js 15 App Router 페이지
│       │   ├── components/      # 공통 UI 컴포넌트
│       │   └── hooks/           # 커스텀 훅
│       ├── package.json
│       └── README.md            # 🎨 UI 개발 가이드
├── README.md                    # 📖 이 파일 (프로젝트 개요)
├── package.json                 # 워크스페이스 설정
└── turbo.json                   # 빌드 파이프라인
```

## 🛠️ 개발자 가이드

### 📋 **개발 명령어**

```bash
# 🏗️ 빌드
pnpm build              # 모든 패키지 빌드
pnpm build:watch        # 감시 모드로 빌드

# 🧪 테스트
pnpm test               # 모든 테스트 실행
pnpm test:coverage      # 커버리지 포함
pnpm test:ui            # UI 모드

# 🔍 품질 검사
pnpm typecheck          # TypeScript 타입 체크
pnpm lint               # ESLint 린팅
pnpm lint:fix           # 린팅 오류 자동 수정
pnpm format             # Prettier 포맷팅

# 🚀 개발 서버
pnpm dev                # 예제 앱 개발 서버

# 📦 배포
pnpm version:patch      # 패치 버전 업데이트
pnpm version:minor      # 마이너 버전 업데이트
pnpm publish            # npm 배포
```

### 🎯 **성능 목표**

- **📊 테스트 커버리지**: 90% 이상
- **⚡ 번들 크기**: 메인 모듈 < 50KB (gzipped)
- **🏃 처리 속도**: 1080p 이미지 < 500ms
- **💾 메모리 효율**: Canvas 풀링으로 메모리 재사용

### 🌐 **브라우저 지원**

| 브라우저 | 최소 버전 | 주요 기능             |
| -------- | --------- | --------------------- |
| Chrome   | 88+       | WebP, OffscreenCanvas |
| Firefox  | 90+       | WebP 지원             |
| Safari   | 14+       | WebP 지원             |
| Edge     | 88+       | 완전 지원             |

**필수 API**:
- Canvas 2D Context ✅
- FileReader API ✅
- Blob/File API ✅
- Web Workers (성능 향상) 🔧

## 📚 상세 문서

- **📖 [라이브러리 API 문서](sub/web-image-util/README.md)** - 완전한 API 레퍼런스
- **🎨 [예제 앱 가이드](apps/exam/README.md)** - UI 개발 및 통합 가이드

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔗 링크

- 📦 [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- 💻 [GitHub 저장소](https://github.com/cp949/web-image-util)
- 🐛 [이슈 리포트](https://github.com/cp949/web-image-util/issues)
- 📊 [릴리스 노트](https://github.com/cp949/web-image-util/releases)

