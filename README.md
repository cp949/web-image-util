# @cp949/web-image-util

모던 웹 브라우저에서 이미지 처리를 위한 TypeScript 라이브러리입니다. Sharp 라이브러리의 패턴을 참고하여 설계된 체이닝 API를 제공합니다.

## 🎯 주요 특징

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

## 📖 빠른 시작

```typescript
import { processImage } from '@cp949/web-image-util';

// 간단한 리사이징
const thumbnail = await processImage(source)
  .resize(300, 200)
  .toBlob();

// 고급 처리
const result = await processImage(source)
  .resize(300, 200, { fit: 'letterbox', background: '#ffffff' })
  .blur(2)
  .toBlob({ format: 'webp', quality: 0.8 });
```

## 🎯 핵심 기능

### 📐 리사이징
- **크기 제한**: `atMostWidth()`, `atMostHeight()`, `atMostRect()` - 최대 크기 제한
- **크기 보장**: `atLeastWidth()`, `atLeastHeight()`, `atLeastRect()` - 최소 크기 보장
- **정확한 크기**: `resizeLetterBox()`, `resizeCover()`, `stretch()` - 정확한 크기로 맞춤
- **강제 설정**: `forceWidth()`, `forceHeight()` - 한 축 고정하여 비율 유지

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

## 📚 예제 앱

이 모노레포에는 라이브러리의 기능을 보여주는 예제 앱이 포함되어 있습니다:

### 🖥️ Examples App (`apps/examples`)

실제 웹 애플리케이션에서 라이브러리를 사용하는 방법을 보여주는 React 기반 예제들:

- **기본 이미지 처리**: 리사이징, 포맷 변환, 품질 조정
- **인터랙티브 UI**: Material-UI 기반의 직관적인 설정 패널
- **실시간 미리보기**: Before/After 비교 뷰
- **다양한 fit 모드**: cover, letterbox, stretch, atMost, atLeast 데모
- **배경색 설정**: letterbox 모드에서의 배경색 커스터마이징

#### 예제 실행하기

```bash
# 개발 서버 실행
pnpm dev

# 또는 개별 실행
cd apps/examples
pnpm dev
```

웹 브라우저에서 `http://localhost:3000`을 열어 예제를 확인할 수 있습니다.

## 📖 상세 문서

라이브러리의 자세한 사용법과 API 문서는 패키지 디렉토리를 참조하세요:

- **[라이브러리 문서](packages/web-image-util/README.md)** - 완전한 API 레퍼런스와 고급 사용법
- **[개발자 가이드](CLAUDE.md)** - 개발환경 설정 및 기여 가이드

## 🏗️ 모노레포 구조

```
web-image-util/
├── packages/
│   └── web-image-util/     # 메인 라이브러리
├── apps/
│   └── examples/           # React 예제 앱
└── packages/
    └── config/             # 공유 설정
```

## 🚀 개발자 가이드

### 개발 명령어

```bash
# 빌드
pnpm build          # 모든 패키지 빌드
pnpm build:watch    # 감시 모드로 빌드

# 테스트
pnpm test           # 모든 테스트
pnpm test:coverage  # 커버리지 포함

# 품질 검사
pnpm typecheck      # 타입 체크
pnpm lint           # 린팅
pnpm format         # 포맷팅

# 배포
git checkout release && git merge main && git push origin release  # 자동 배포
```

## 🌐 브라우저 지원

- **Chrome** 88+
- **Firefox** 90+
- **Safari** 14+
- **Edge** 88+

필수 브라우저 API:
- Canvas 2D Context
- FileReader API
- Blob API

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License

## 🔗 관련 링크

- [npm 패키지](https://www.npmjs.com/package/@cp949/web-image-util)
- [GitHub 저장소](https://github.com/cp949/web-image-util)
- [이슈 트래커](https://github.com/cp949/web-image-util/issues)