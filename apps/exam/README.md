# @cp949/web-image-util Example App

A Next.js 15 App Router-based web application for demonstrating and testing the features of the `@cp949/web-image-util` library.

## 🚀 Quick Start

### Install Dependencies

```bash
# From root directory
pnpm install
```

### Run Development Server

```bash
# Navigate to example app directory
cd apps/exam

# Run development server
pnpm dev
```

Open `http://localhost:3000` in your browser to view the example application.

### Production Build

```bash
pnpm build
pnpm start
```

---

## 📱 Key Features

### ✨ Core Features (v2.0 API)

#### 1. **Basic Image Processing** (`/basic`)
- Resizing: Width/height settings, Fit modes (cover, contain, fill, inside, outside)
- Format conversion: JPEG, PNG, WebP
- Quality adjustment: 10-100% slider
- Advanced options: Prevent enlargement/reduction, background color settings
- Real-time preview and Before/After comparison
- Metadata display: Processing time, file size, compression ratio

**Core Features**:
- v2.0 API demo based on `processImage()` function
- Utilization of `ResultBlob`, `ResultDataURL` type system
- `ImageProcessError` error handling
- Integrated sample image selector

---

#### 2. **Preset Functions** (`/presets`)
- **Thumbnail Generation**: 50px, 100px, 150px, 200px (WebP optimized)
- **Avatar Creation**: Square, high-quality PNG (Future: circular masking, borders)
- **Social Media Images**: Optimal sizes for Instagram, Twitter, Facebook, LinkedIn, YouTube platforms

**Features**:
- `createThumbnail`, `createAvatar`, `createSocialImage` preset functions
- Automatic application of platform-specific recommended sizes
- Performance-optimized default settings

---

#### 3. **Advanced Features** (`/advanced`)
- **Watermark**: Text/image watermark composition (9 positions, opacity adjustment)
- **Filters**: Grayscale, Sepia, Brightness, Contrast, Blur (real-time preview)
- **Batch Processing**: Multiple image processing, progress indicators, ZIP download

**Features**:
- Utilization of `AdvancedImageProcessor` class
- Plugin-based filter system
- Parallel processing and performance optimization

---

### 🆕 v2.0 New Features

#### 4. **SVG Quality Comparison** (`/svg-quality-comparison`)
- Quality level comparison when converting SVG to raster images
- 4 quality levels: 1x (low), 2x (standard), 3x (high), 4x (ultra)
- Processing time and file size analysis
- Detailed comparison table and recommendations

**Core Technology**:
- Automatic quality selection based on SVG complexity (`quality: 'auto'`)
- Vector graphics quality preservation system
- Performance and quality balance optimization

---

#### 5. **Smart Format Selection** (`/smart-format`)
- JPEG, PNG, WebP format comparison
- Automatic browser support detection (WebP, AVIF, OffscreenCanvas)
- File size and compression ratio calculation
- Optimal format automatic recommendation logic

**Recommendation Algorithm**:
1. WebP support + compression ratio > 20% → **WebP**
2. Transparency required → **PNG**
3. Default → **JPEG**

---

#### 6. **Performance Benchmark** (`/performance-benchmark`)
- Small/medium/large image processing time measurement
- Memory usage monitoring (`usePerformanceMonitor` hook)
- Throughput calculation
- Benchmark results table and summary statistics

**Measurement Items**:
- Processing time (ms)
- Memory usage (MB)
- Throughput (images/sec)
- Performance score (comprehensive)

---

### 🛠️ Convenience Features

#### Sample Image Selector
- 12 sample images (4 each of JPEG, PNG, SVG)
- Format-based filtering (ALL/JPG/PNG/SVG)
- Grid preview and one-click selection
- Integrated into all major demo pages

#### Image Uploader
- Drag & drop support
- File selection button
- Integrated sample image selector
- File type and size validation

#### Before/After Comparison
- Side-by-side display of before and after processing
- Zoom and pan functionality
- Metadata display (size, file size, compression ratio)

---

## 🏗️ Project Structure

### Monorepo Structure

```
web-image-util/                    # 모노레포 루트
├── apps/
│   └── exam/                      # 예제 앱 (이 프로젝트)
│       ├── src/
│       │   ├── app/               # Next.js 15 App Router 페이지
│       │   │   ├── page.tsx       # 홈페이지
│       │   │   ├── basic/         # 기본 처리
│       │   │   ├── presets/       # 프리셋 함수
│       │   │   ├── advanced/      # 고급 기능
│       │   │   ├── svg-quality-comparison/  # SVG 품질 비교
│       │   │   ├── smart-format/  # 스마트 포맷 선택
│       │   │   └── performance-benchmark/   # 성능 벤치마크
│       │   ├── components/
│       │   │   ├── demos/         # Demo 컴포넌트 (비즈니스 로직)
│       │   │   ├── common/        # 공통 컴포넌트 (ImageUploader 등)
│       │   │   ├── ui/            # UI 컴포넌트 (ProcessingStatus 등)
│       │   │   └── layout/        # 레이아웃 (AppLayout)
│       │   ├── hooks/             # React 훅
│       │   │   ├── useImageProcessing.ts   # 이미지 처리 훅
│       │   │   ├── usePerformanceMonitor.ts # 성능 모니터링
│       │   │   └── useSampleImages.ts      # 샘플 이미지 관리
│       │   ├── lib/               # 유틸리티
│       │   │   ├── types.ts       # 공통 타입 정의
│       │   │   └── errorHandling.ts # 에러 처리 유틸
│       │   └── theme.ts           # Material-UI 테마
│       ├── public/
│       │   └── sample-images/     # 샘플 이미지 (12개)
│       ├── docs/                  # 문서
│       │   ├── usage-guide.md     # 사용법 가이드
│       │   ├── best-practices.md  # 베스트 프랙티스
│       │   ├── migration-guide.md # 마이그레이션 가이드
│       │   ├── troubleshooting.md # 트러블슈팅
│       │   └── performance-tips.md # 성능 최적화 팁
│       ├── CLAUDE.md              # 개발자 가이드
│       └── README.md              # 이 파일
├── sub/
│   └── web-image-util/            # 메인 라이브러리
├── turbo.json                     # Turbo 설정
└── pnpm-workspace.yaml            # pnpm 워크스페이스
```

---

## 🔧 Technology Stack

### Core Framework
- **Next.js 15.5.4**: App Router, Server/Client Components, React 19 지원
- **React 19.1.1**: 최신 React (Concurrent Features, 새로운 훅)
- **TypeScript 5.9**: 타입 안전성 보장
- **Turbo**: 모노레포 빌드 오케스트레이션

### UI/UX
- **Material-UI (MUI) 7.3**: 모던 React 컴포넌트 라이브러리
- **Emotion 11.14**: CSS-in-JS 스타일링
- **Grid v2**: 반응형 레이아웃 시스템

### 기능 라이브러리
- **React Dropzone 14.3**: 드래그앤드롭 파일 업로드
- **Chart.js 4.5**: 성능 차트 및 데이터 시각화
- **JSZip 3.10**: 배치 처리 ZIP 다운로드

### 메인 라이브러리
- **@cp949/web-image-util**: 이미지 처리 라이브러리 (워크스페이스 연결)
  - 메인 API: `processImage()`
  - 고급 기능: `@cp949/web-image-util/advanced`
  - 프리셋: `@cp949/web-image-util/presets`
  - 유틸리티: `@cp949/web-image-util/utils`

---

## 📖 Key Page Guide

### 1. 홈페이지 (`/`)
- 라이브러리 소개 및 빠른 시작 가이드
- v2.0 주요 기능 하이라이트
- 전체 데모 페이지 링크

### 2. 기본 처리 (`/basic`)
- **대상**: 초보 사용자
- **학습 내용**: 기본 API 사용법, Fit 모드, 포맷 변환
- **샘플 이미지**: `sample1.jpg` (풍경 이미지) 권장

### 3. 프리셋 (`/presets`)
- **대상**: 일반 사용자
- **학습 내용**: 썸네일, 아바타, 소셜 이미지 생성
- **샘플 이미지**: `sample2.jpg` (인물 사진) 권장

### 4. 고급 기능 (`/advanced`)
- **대상**: 고급 사용자
- **학습 내용**: 워터마크, 필터, 배치 처리
- **샘플 이미지**: `sample3.png` (제품 이미지, 투명 배경) 권장

### 5. SVG 품질 비교 (`/svg-quality-comparison`)
- **대상**: SVG 사용자
- **학습 내용**: SVG 품질 시스템, 복잡도 기반 자동 선택
- **샘플 이미지**: `sample4.svg` (그래픽 아트) 권장

### 6. 스마트 포맷 (`/smart-format`)
- **대상**: 웹 최적화 관심 사용자
- **학습 내용**: 브라우저 지원 감지, 포맷별 압축률 비교
- **샘플 이미지**: 모든 포맷 (JPEG, PNG) 가능

### 7. 성능 벤치마크 (`/performance-benchmark`)
- **대상**: 성능 최적화 관심 개발자
- **학습 내용**: 처리 시간 측정, 메모리 사용량, 처리량
- **샘플 이미지**: 자동 생성 (소형/중형/대형)

---

## 💻 Development Commands

### 개발 서버
```bash
pnpm dev          # 개발 서버 실행 (http://localhost:3000)
```

### 빌드
```bash
pnpm build        # 프로덕션 빌드
pnpm start        # 프로덕션 서버 실행
```

### 품질 검증
```bash
pnpm typecheck    # TypeScript 타입 체크
pnpm lint         # ESLint 린팅
```

---

## 🎨 Design System

### Material-UI 7.3 컴포넌트

- **레이아웃**: Container, Grid (v2), Stack, Box
- **입력**: TextField, Button, Switch, Slider, Select
- **표시**: Card, Typography, Alert, CircularProgress
- **네비게이션**: Drawer, List, ListItem, Divider

### 테마 설정

```typescript
// src/theme.ts
const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },    // Material Blue
    secondary: { main: '#dc004e' },  // Material Pink
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  }
});
```

### 반응형 브레이크포인트

- **xs**: 0px (모바일)
- **sm**: 600px (태블릿)
- **md**: 900px (데스크톱 소형)
- **lg**: 1200px (데스크톱 대형)
- **xl**: 1536px (초대형)

---

## 📚 Documentation

### 예제 앱 전용 문서

- **[사용법 가이드](./docs/usage-guide.md)**: 기능별 상세 사용법
- **[베스트 프랙티스](./docs/best-practices.md)**: 권장 사항 및 최적화
- **[마이그레이션 가이드](./docs/migration-guide.md)**: v1.x → v2.0 마이그레이션
- **[트러블슈팅](./docs/troubleshooting.md)**: 문제 해결 가이드
- **[성능 최적화 팁](./docs/performance-tips.md)**: 성능 개선 방법

### 메인 라이브러리 문서

- **[메인 README](../../sub/web-image-util/README.md)**: 라이브러리 전체 문서
- **[CLAUDE.md](./CLAUDE.md)**: 개발자 가이드 (AI 어시스턴트용)

---

## 🔒 Security Considerations

### 파일 업로드 보안
- **파일 타입 검증**: MIME type + 확장자 확인
- **파일 크기 제한**: 기본 10MB
- **SVG 안전 처리**: 스크립트 실행 방지 (래스터 변환)

### XSS 방지
- **입력 검증**: 사용자 입력 데이터 검증
- **안전한 렌더링**: React의 자동 이스케이핑 활용
- **CSP**: Content Security Policy 적용 (프로덕션)

---

## 🌐 Browser Compatibility

### 지원 브라우저 (권장)
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### 브라우저 기능 감지
```typescript
import { detectBrowserSupport } from '@cp949/web-image-util/utils';

const support = await detectBrowserSupport();
console.log('WebP 지원:', support.webp);
console.log('AVIF 지원:', support.avif);
console.log('OffscreenCanvas 지원:', support.offscreenCanvas);
```

### 폴백 전략
- **WebP 미지원**: JPEG로 자동 폴백
- **OffscreenCanvas 미지원**: Canvas 2D로 폴백
- **다운로드 속성 미지원**: window.open() 폴백

---

## ⚡ Performance Optimization

### 1. 이미지 최적화
- WebP 포맷 우선 사용 (브라우저 지원 시)
- 적절한 품질 설정 (80-85%)
- 샘플 이미지 지연 로딩

### 2. Next.js 최적화
- App Router의 Server Components 활용
- 동적 import로 코드 스플리팅
- 이미지 최적화 (next/image)

### 3. 메모리 관리
- Canvas Pool 자동 관리 (라이브러리)
- 순차 처리 권장 (대량 이미지)
- URL.createObjectURL() 사용 후 cleanup

### 4. 번들 최적화
- Tree Shaking (ES Modules)
- 필요한 서브패키지만 import
- 동적 import로 초기 로딩 감소

---

## 🐛 Known Issues

### 1. Next.js 15 + React 19
- 일부 MUI 컴포넌트에서 hydration 경고 (개발 환경)
- 프로덕션 빌드에서는 정상 작동

### 2. iOS Safari
- WebP 지원 (Safari 14+)
- 다운로드 속성 미지원 (폴백 구현됨)

### 3. 대형 이미지 처리
- 4096px 이상 이미지는 2단계 리사이징 권장
- 메모리 부족 시 브라우저 탭 크래시 가능

---

## 🤝 Contributing

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/YOUR_REPO/web-image-util.git
cd web-image-util

# 의존성 설치
pnpm install

# 예제 앱 개발 서버 실행
cd apps/exam
pnpm dev
```

### 새로운 데모 페이지 추가

1. `src/app/your-feature/page.tsx` 생성
2. `src/components/demos/YourFeatureDemo.tsx` 생성
3. `src/components/layout/AppLayout.tsx`에 네비게이션 항목 추가
4. 샘플 이미지 선택기 통합 (권장)
5. 문서 업데이트 (`docs/usage-guide.md`)

### 코딩 규칙
- **TypeScript Strict Mode** 준수
- **ESLint 설정** 따르기
- **한글 주석** 권장
- **테스트 코드** 작성 (권장)

---

## 📝 라이센스

MIT License

---

## 🔗 관련 링크

- **메인 라이브러리**: [@cp949/web-image-util](../../sub/web-image-util/README.md)
- **NPM 패키지**: [https://www.npmjs.com/package/@cp949/web-image-util](https://www.npmjs.com/package/@cp949/web-image-util)
- **GitHub 저장소**: GitHub 링크 (향후 공개)

---

## 🆘 지원

### 문서
- [사용법 가이드](./docs/usage-guide.md)
- [베스트 프랙티스](./docs/best-practices.md)
- [트러블슈팅](./docs/troubleshooting.md)

### 이슈 리포팅
- GitHub Issues (향후 공개)
- 버그 리포트 및 기능 제안

---

**Happy Coding! 🎉**