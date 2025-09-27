# @cp949/web-image-util Examples

`@cp949/web-image-util` 라이브러리의 기능을 시연하는 React 기반 예제 애플리케이션입니다.

## 🚀 실행하기

```bash
# 루트 디렉토리에서
pnpm install
cd apps/exam
pnpm dev
```

브라우저에서 `http://localhost:5173`을 열면 예제 애플리케이션을 확인할 수 있습니다.

## 📦 프로젝트 구조

```
apps/exam/
├── src/
│   ├── components/
│   │   ├── common/           # 공통 컴포넌트
│   │   │   ├── CodeSnippet.tsx      # 코드 예제 표시
│   │   │   └── ImageUploader.tsx    # 이미지 업로드 컴포넌트
│   │   ├── layout/           # 레이아웃 컴포넌트
│   │   │   ├── AppLayout.tsx        # 메인 레이아웃 + 네비게이션
│   │   │   └── MobileOptimizedLayout.tsx  # 모바일 최적화 레이아웃
│   │   └── ui/               # UI 컴포넌트
│   │       └── BeforeAfterView.tsx  # Before/After 비교 뷰
│   ├── pages/                # 예제 페이지들
│   │   ├── HomePage.tsx             # 홈페이지 및 소개
│   │   ├── BasicProcessingPage.tsx  # 기본 이미지 처리
│   │   ├── PresetsPage.tsx          # 프리셋 기능
│   │   ├── AdvancedPage.tsx         # 고급 기능
│   │   ├── FiltersPage.tsx          # 이미지 필터
│   │   ├── ConvertersPage.tsx       # 포맷 변환
│   │   ├── BatchPage.tsx            # 일괄 처리
│   │   ├── PerformancePage.tsx      # 성능 테스트
│   │   ├── DevToolsPage.tsx         # 개발자 도구
│   │   └── SvgCompatibilityPage.tsx # SVG 호환성
│   ├── hooks/                # 커스텀 훅
│   │   ├── useWebWorker.ts          # 웹워커 활용
│   │   └── useAccessibility.ts      # 접근성 지원
│   ├── App.tsx               # 메인 앱 + 라우팅
│   └── main.tsx              # 엔트리 포인트
├── package.json
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md                 # 개발자 가이드
└── README.md                 # 이 파일
```

## 🎯 예제 페이지 소개

### 1. 홈페이지 (`/`)
- 라이브러리 소개 및 주요 기능 설명
- 빠른 시작 가이드 제공
- 전체 기능 개요

### 2. 기본 처리 (`/basic`)
- 기본적인 이미지 리사이징 기능
- 다양한 fit 모드 (cover, letterbox, stretch, atMost, atLeast)
- 실시간 미리보기 및 코드 예제

### 3. 프리셋 (`/presets`)
- 미리 정의된 이미지 처리 프리셋
- 소셜 미디어 규격 (Instagram, Facebook, Twitter)
- 웹사이트 최적화 규격 (Thumbnail, Banner)

### 4. 고급 기능 (`/advanced`)
- 세밀한 옵션 제어
- 커스텀 캔버스 조작
- 고급 이미지 처리 기법

### 5. 필터 (`/filters`)
- 이미지 필터 효과
- 색상 조정 (밝기, 대비, 채도)
- 특수 효과 (흑백, 세피아, 블러)

### 6. 변환기 (`/converters`)
- 이미지 포맷 변환 (JPEG, PNG, WebP)
- 품질 조정 및 최적화
- 파일 크기 비교

### 7. 일괄 처리 (`/batch`)
- 다중 파일 업로드 및 처리
- ZIP 파일로 다운로드
- 진행률 표시 및 취소 기능

### 8. 성능 테스트 (`/performance`)
- 처리 속도 벤치마크
- 메모리 사용량 모니터링
- 다양한 이미지 크기별 성능 비교

### 9. 개발자 도구 (`/dev-tools`)
- 디버깅 및 개발 유틸리티
- 이미지 메타데이터 분석
- 성능 프로파일링

### 10. SVG 호환성 (`/svg-compatibility`)
- SVG 파일 처리 및 변환
- 복잡한 SVG 구조 지원
- 래스터화 옵션

## 🛠️ 사용된 기술 스택

### Core
- **React 19.1.1**: UI 프레임워크
- **TypeScript**: 타입 안전성
- **Vite**: 빠른 개발 서버 및 빌드 도구

### UI/UX
- **Material-UI (MUI) 7.3**: 컴포넌트 라이브러리
- **Emotion**: CSS-in-JS 스타일링
- **React Router 7.9**: 클라이언트 사이드 라우팅

### 기능
- **React Dropzone 14.3**: 드래그 앤 드롭 파일 업로드
- **FileSaver.js 2.0**: 파일 다운로드
- **JSZip 3.10**: ZIP 파일 생성
- **Recharts 3.2**: 데이터 시각화

### 라이브러리
- **@cp949/web-image-util**: 메인 이미지 처리 라이브러리 (워크스페이스 연결)

## 🎨 디자인 시스템

### 레이아웃 패턴
- **반응형 Grid 시스템**: Material-UI Grid v2 사용
- **Container + Stack**: 일관된 간격과 정렬
- **Card 기반**: 각 기능별 섹션 분리

### 색상 테마
- **Primary**: Material Design Blue
- **Secondary**: Material Design Grey
- **Success/Error/Warning**: 표준 시맨틱 컬러

### 타이포그래피
- **헤딩**: Material-UI Typography variants (h1-h6)
- **본문**: body1, body2
- **코드**: Monospace 폰트

## 🔧 개발 가이드

### 새 예제 페이지 추가하기

1. `src/pages/YourPage.tsx` 생성
2. `src/App.tsx`에 라우트 추가
3. `src/components/layout/AppLayout.tsx`에 네비게이션 항목 추가

자세한 가이드는 `CLAUDE.md` 파일을 참조하세요.

### 공통 컴포넌트 활용

#### ImageUploader
```typescript
<ImageUploader
  onImageSelect={handleFileSelect}
  supportedFormats={['jpg', 'png', 'webp']}
/>
```

#### CodeSnippet
```typescript
<CodeSnippet
  title="사용 예제"
  examples={[
    {
      title: "기본 사용법",
      code: "const result = await processImage(source);",
      language: "typescript"
    }
  ]}
/>
```

#### BeforeAfterView
```typescript
<BeforeAfterView
  before={originalImage}
  after={processedImage}
/>
```

## 📱 반응형 디자인

- **Mobile First**: 모바일 우선 설계
- **Breakpoints**: xs(0), sm(600), md(900), lg(1200), xl(1536)
- **Touch Friendly**: 터치 인터랙션 최적화
- **Accessibility**: WCAG 2.1 가이드라인 준수

## ⚡ 성능 최적화

### Code Splitting
- 페이지별 지연 로딩 (Lazy Loading)
- 동적 import로 번들 크기 최소화

### 이미지 최적화
- WebP 포맷 우선 사용
- 반응형 이미지 크기 조정
- 지연 로딩 (Intersection Observer)

### 메모리 관리
- `URL.createObjectURL()` 사용 후 cleanup
- 큰 파일 처리 시 청크 단위 처리
- Web Worker 활용으로 메인 스레드 블로킹 방지

## 🧪 테스트

### 테스트 전략
- **Unit Tests**: 개별 컴포넌트 테스트
- **Integration Tests**: 페이지 단위 통합 테스트
- **E2E Tests**: 사용자 시나리오 테스트

### 테스트 환경
- **Testing Library**: React 컴포넌트 테스트
- **Jest**: 테스트 러너
- **MSW**: API 모킹

## 🔒 보안 고려사항

### 파일 업로드 보안
- 파일 타입 검증 (MIME type + 확장자)
- 파일 크기 제한
- 악성 코드 방지를 위한 샌드박스 처리

### XSS 방지
- 사용자 입력 데이터 검증
- CSP (Content Security Policy) 적용
- 안전한 HTML 렌더링

## 🌐 브라우저 호환성

### 지원 브라우저
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Polyfills
- Canvas API 지원
- File API 지원
- Web Workers 지원

## 🔄 CI/CD

### GitHub Actions
- 자동 빌드 및 테스트
- 타입 체크 및 린팅
- 배포 자동화

### 배포
- **Vercel**: 프로덕션 배포
- **Netlify**: 스테이징 환경
- **GitHub Pages**: 개발 프리뷰

## 📈 모니터링

### 성능 모니터링
- Web Vitals 수집
- 사용자 경험 지표 추적
- 에러 모니터링 (Sentry)

### 분석
- Google Analytics 연동
- 사용자 행동 분석
- A/B 테스트 지원

## 🤝 기여하기

### 개발 환경 설정
```bash
# 저장소 클론
git clone https://github.com/cp949/web-image-util.git
cd web-image-util

# 의존성 설치
pnpm install

# 개발 서버 실행
cd apps/exam
pnpm dev
```

### 코딩 규칙
- **TypeScript Strict Mode** 준수
- **ESLint + Prettier** 설정 따르기
- **Conventional Commits** 메시지 형식
- **테스트 코드** 작성 권장

### Pull Request 가이드
1. Feature 브랜치 생성
2. 변경사항 구현
3. 테스트 코드 작성
4. PR 생성 및 리뷰 요청

## 📝 라이센스

MIT License - 자세한 내용은 [LICENSE](../../LICENSE) 파일을 참조하세요.

## 🔗 관련 링크

- **메인 라이브러리**: [@cp949/web-image-util](../../sub/web-image-util/README.md)
- **NPM 패키지**: [https://www.npmjs.com/package/@cp949/web-image-util](https://www.npmjs.com/package/@cp949/web-image-util)
- **GitHub 저장소**: [https://github.com/cp949/web-image-util](https://github.com/cp949/web-image-util)
- **문서**: [https://cp949.github.io/web-image-util](https://cp949.github.io/web-image-util)

---

## 🆘 도움이 필요하신가요?

- **Issues**: 버그 리포트 및 기능 제안
- **Discussions**: 질문 및 토론
- **Discord**: 실시간 커뮤니티 채팅

**Happy Coding! 🎉**