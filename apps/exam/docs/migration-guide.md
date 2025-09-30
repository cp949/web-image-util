# v1.x에서 v2.0 마이그레이션 가이드

`@cp949/web-image-util` v1.x에서 v2.0으로 마이그레이션하는 방법을 안내합니다.

## 📖 목차

1. [주요 변경사항](#주요-변경사항)
2. [Breaking Changes](#breaking-changes)
3. [API 변경사항](#api-변경사항)
4. [마이그레이션 단계](#마이그레이션-단계)
5. [자동 마이그레이션 스크립트](#자동-마이그레이션-스크립트)
6. [트러블슈팅](#트러블슈팅)

---

## 주요 변경사항

### v2.0의 핵심 개선사항

1. **새로운 메인 API**: `Images.resizeFrom()` → `processImage()`
2. **완전한 체이닝 지원**: 모든 메서드를 체이닝으로 연결
3. **결과 타입 개선**: `ResultBlob`, `ResultDataURL`, `ResultFile` 타입 추가
4. **에러 처리 강화**: `ImageProcessError` 클래스 도입
5. **메타데이터 추가**: 처리 시간, 파일 크기, 해상도 정보 자동 포함
6. **성능 최적화**: Canvas Pool, 메모리 관리 개선
7. **레거시 코드 제거**: ImageMain, ModernImageResizer 클래스 삭제

---

## Breaking Changes

### 1. 레거시 API 완전 제거

**v1.x에서 지원됨 (현재 삭제됨)**:
```typescript
// ❌ ImageMain 클래스 (삭제됨)
import Images from '@cp949/web-image-util';
const result = await Images.resizeFrom(source).centerCrop({...}).toBlob();

// ❌ ModernImageResizer 클래스 (삭제됨)
import { ModernImageResizer } from '@cp949/web-image-util';
const resizer = new ModernImageResizer(source);
```

**v2.0에서 사용**:
```typescript
// ✅ processImage 함수 (권장)
import { processImage } from '@cp949/web-image-util';
const result = await processImage(source).resize(300, 200).toBlob();
```

---

### 2. Import 경로 변경

**v1.x**:
```typescript
import Images from '@cp949/web-image-util';
import { createThumbnail } from '@cp949/web-image-util/dist/presets';
import { AdvancedImageProcessor } from '@cp949/web-image-util/dist/advanced-index';
```

**v2.0**:
```typescript
import { processImage } from '@cp949/web-image-util';
import { createThumbnail } from '@cp949/web-image-util/presets';
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';
```

**변경 사항**:
- `/dist/` 경로 제거
- `/advanced-index` → `/advanced`
- 기본 import에서 named import로 변경

---

### 3. 메서드 이름 변경

| v1.x | v2.0 | 비고 |
|------|------|------|
| `.centerCrop()` | `.resize(..., { fit: 'cover' })` | Fit 모드로 통합 |
| `.centerInside()` | `.resize(..., { fit: 'contain' })` | Fit 모드로 통합 |
| `.fit()` | `.resize(..., { fit: 'contain' })` | 이름 변경 |
| `.fill()` | `.resize(..., { fit: 'fill' })` | Fit 모드로 통합 |

---

### 4. 결과 타입 변경

**v1.x**:
```typescript
const blob: Blob = await resizer.toBlob();  // 단순 Blob
```

**v2.0**:
```typescript
const result: ResultBlob = await processor.toBlob();  // 메타데이터 포함

// 사용 가능한 속성
console.log('크기:', result.width, 'x', result.height);
console.log('처리 시간:', result.processingTime, 'ms');
console.log('원본 크기:', result.originalSize);  // optional
```

---

## API 변경사항

### 1. 기본 리사이징

#### v1.x
```typescript
import Images from '@cp949/web-image-util';

// centerCrop 사용
const cropped = await Images.resizeFrom(source)
  .centerCrop({ width: 300, height: 200 })
  .toBlob();

// fit 사용
const fitted = await Images.resizeFrom(source)
  .fit({ width: 300, height: 200 })
  .toBlob();
```

#### v2.0
```typescript
import { processImage } from '@cp949/web-image-util';

// cover fit (centerCrop와 동일)
const cropped = await processImage(source)
  .resize(300, 200, { fit: 'cover' })
  .toBlob();

// contain fit (fit와 동일)
const fitted = await processImage(source)
  .resize(300, 200, { fit: 'contain' })
  .toBlob();
```

---

### 2. 체이닝 API

#### v1.x (제한적)
```typescript
const resizer = Images.resizeFrom(source);
const cropped = resizer.centerCrop({ width: 300, height: 200 });
const result = await cropped.toBlob();
```

#### v2.0 (완전한 체이닝)
```typescript
const result = await processImage(source)
  .resize(300, 200, { fit: 'cover' })
  .blur(2)
  .toBlob({ format: 'webp', quality: 0.8 });
```

---

### 3. 프리셋 함수

#### v1.x
```typescript
import { createThumbnail } from '@cp949/web-image-util/dist/presets';

const thumbnail = await createThumbnail(source, {
  size: 150,
  format: 'webp',
  quality: 0.8
});
```

#### v2.0
```typescript
import { createThumbnail } from '@cp949/web-image-util/presets';

// API는 동일하지만 import 경로만 변경
const thumbnail = await createThumbnail(source, {
  size: 150,
  format: 'webp',
  quality: 0.8
});
```

---

### 4. 에러 처리

#### v1.x
```typescript
try {
  const result = await resizer.toBlob();
} catch (error) {
  console.error(error.message);  // 일반 Error
}
```

#### v2.0
```typescript
import { ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processor.toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    console.error('에러 코드:', error.code);
    console.error('에러 메시지:', error.message);
    // 구체적인 에러 처리 가능
  }
}
```

---

### 5. 고급 기능

#### v1.x
```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/dist/advanced-index';

const processor = new AdvancedImageProcessor();
const result = await processor.applyWatermark(baseImage, watermark, {
  position: 'center',
  opacity: 0.5
});
```

#### v2.0
```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

// API는 동일하지만 import 경로만 변경
const processor = new AdvancedImageProcessor();
const result = await processor.applyWatermark(baseImage, watermark, {
  position: 'center',
  opacity: 0.5
});
```

---

## 마이그레이션 단계

### Step 1: 의존성 업데이트

```bash
# 최신 버전 설치
npm install @cp949/web-image-util@^2.0.0

# 또는
pnpm add @cp949/web-image-util@^2.0.0
```

---

### Step 2: Import 구문 변경

**자동화 스크립트** (아래 섹션 참조):
```bash
./scripts/migrate-imports.sh
```

**수동 변경**:
1. 기본 API import 수정
2. 서브패키지 import 경로 수정
3. Type import 추가

---

### Step 3: API 호출 변경

#### 3.1. 기본 리사이징
```typescript
// Before (v1.x)
const result = await Images.resizeFrom(source)
  .centerCrop({ width: 300, height: 200 })
  .toBlob();

// After (v2.0)
const result = await processImage(source)
  .resize(300, 200, { fit: 'cover' })
  .toBlob();
```

#### 3.2. Fit 모드
```typescript
// Before
.centerCrop({ width: 300, height: 200 })  → .resize(300, 200, { fit: 'cover' })
.centerInside({ width: 300, height: 200 }) → .resize(300, 200, { fit: 'contain' })
.fit({ width: 300, height: 200 })          → .resize(300, 200, { fit: 'contain' })
.fill({ width: 300, height: 200 })         → .resize(300, 200, { fit: 'fill' })
```

---

### Step 4: 타입 정의 업데이트

```typescript
// Before (v1.x)
const result: Blob = await resizer.toBlob();

// After (v2.0)
import { ResultBlob } from '@cp949/web-image-util';
const result: ResultBlob = await processor.toBlob();

// 메타데이터 활용
console.log('처리 시간:', result.processingTime, 'ms');
console.log('크기:', result.width, 'x', result.height);
```

---

### Step 5: 에러 처리 강화

```typescript
// Before (v1.x)
try {
  const result = await resizer.toBlob();
} catch (error) {
  alert('처리 실패');
}

// After (v2.0)
import { ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processor.toBlob();
} catch (error) {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'INVALID_SOURCE':
        alert('지원하지 않는 이미지 형식입니다.');
        break;
      case 'SOURCE_LOAD_FAILED':
        alert('이미지를 불러올 수 없습니다.');
        break;
      case 'CANVAS_CREATION_FAILED':
        alert('이미지 처리 중 오류가 발생했습니다.');
        break;
      default:
        alert(`처리 오류: ${error.message}`);
    }
  }
}
```

---

### Step 6: 빌드 및 테스트

```bash
# 타입 체크
npm run typecheck

# 빌드
npm run build

# 테스트
npm test
```

---

## 자동 마이그레이션 스크립트

### 1. Import 경로 자동 변경

`scripts/migrate-imports.sh` (생성 필요):
```bash
#!/bin/bash

# 기본 API import 변경
find src -name "*.{ts,tsx}" -exec sed -i "s/import Images from '@cp949\/web-image-util'/import { processImage } from '@cp949\/web-image-util'/g" {} \;

# 프리셋 import 경로 변경
find src -name "*.{ts,tsx}" -exec sed -i "s/@cp949\/web-image-util\/dist\/presets/@cp949\/web-image-util\/presets/g" {} \;

# 고급 기능 import 경로 변경
find src -name "*.{ts,tsx}" -exec sed -i "s/@cp949\/web-image-util\/dist\/advanced-index/@cp949\/web-image-util\/advanced/g" {} \;

# 유틸리티 import 경로 변경
find src -name "*.{ts,tsx}" -exec sed -i "s/@cp949\/web-image-util\/dist\/utils/@cp949\/web-image-util\/utils/g" {} \;

# 필터 import 경로 변경
find src -name "*.{ts,tsx}" -exec sed -i "s/@cp949\/web-image-util\/dist\/filters/@cp949\/web-image-util\/filters/g" {} \;

echo "✅ Import 경로 변경 완료"
```

**사용법**:
```bash
chmod +x scripts/migrate-imports.sh
./scripts/migrate-imports.sh
```

---

### 2. API 호출 자동 변경 (부분적)

**주의**: 완전 자동화는 어려우므로 수동 검토 필요

```bash
#!/bin/bash

# Images.resizeFrom → processImage
find src -name "*.{ts,tsx}" -exec sed -i 's/Images\.resizeFrom/processImage/g' {} \;

echo "⚠️  API 호출 부분 변경 (수동 검토 필요)"
```

---

## 트러블슈팅

### 문제 1: Import 에러

**증상**:
```
Module not found: Can't resolve '@cp949/web-image-util/dist/presets'
```

**해결**:
```typescript
// ❌ 구 버전 경로
import { createThumbnail } from '@cp949/web-image-util/dist/presets';

// ✅ 신 버전 경로
import { createThumbnail } from '@cp949/web-image-util/presets';
```

---

### 문제 2: 타입 에러

**증상**:
```
Property 'processingTime' does not exist on type 'Blob'
```

**해결**:
```typescript
// ❌ 구 타입
const result: Blob = await processor.toBlob();

// ✅ 신 타입
import { ResultBlob } from '@cp949/web-image-util';
const result: ResultBlob = await processor.toBlob();
```

---

### 문제 3: 메서드 없음 에러

**증상**:
```
Property 'centerCrop' does not exist on type 'ImageProcessor'
```

**해결**:
```typescript
// ❌ 구 API
const result = await processImage(source)
  .centerCrop({ width: 300, height: 200 })
  .toBlob();

// ✅ 신 API
const result = await processImage(source)
  .resize(300, 200, { fit: 'cover' })
  .toBlob();
```

---

### 문제 4: 빌드 에러

**증상**:
```
Error: Cannot find module 'ModernImageResizer'
```

**해결**:
ModernImageResizer는 v2.0에서 완전히 제거되었습니다. processImage 함수를 사용하세요.

```typescript
// ❌ 구 코드 (제거됨)
import { ModernImageResizer } from '@cp949/web-image-util';
const resizer = new ModernImageResizer(source);

// ✅ 신 코드
import { processImage } from '@cp949/web-image-util';
const processor = processImage(source);
```

---

## 마이그레이션 체크리스트

### 필수 체크리스트

- [ ] **1단계**: 의존성 업데이트 (`@cp949/web-image-util@^2.0.0`)
- [ ] **2단계**: Import 구문 변경 (기본 API, 서브패키지)
- [ ] **3단계**: API 호출 변경 (`.centerCrop()` → `.resize(..., { fit: 'cover' })`)
- [ ] **4단계**: 타입 정의 업데이트 (`ResultBlob`, `ResultDataURL`)
- [ ] **5단계**: 에러 처리 강화 (`ImageProcessError`)
- [ ] **6단계**: 빌드 및 테스트 (`npm run build`, `npm test`)

### 검증 체크리스트

- [ ] 타입 체크 통과 (`npm run typecheck`)
- [ ] 빌드 성공 (`npm run build`)
- [ ] 테스트 통과 (`npm test`)
- [ ] 런타임 에러 없음 (브라우저 콘솔 확인)
- [ ] 기능 정상 동작 확인

### 선택 체크리스트

- [ ] 메타데이터 활용 코드 추가 (처리 시간, 파일 크기 표시)
- [ ] 에러 UI 개선 (ImageProcessError 활용)
- [ ] 성능 모니터링 추가 (usePerformanceMonitor 훅)
- [ ] 새로운 v2.0 기능 활용 (SVG 품질, 스마트 포맷 등)

---

## v2.0 신기능 활용 권장사항

마이그레이션 완료 후 다음 v2.0 신기능을 활용해보세요:

### 1. SVG 품질 시스템
```typescript
const result = await processImage(svgSource)
  .quality('auto')  // 복잡도 기반 자동 선택
  .resize(800, 600)
  .toBlob();
```

### 2. 스마트 포맷 선택
```typescript
import { detectBrowserSupport } from '@cp949/web-image-util/utils';

const support = await detectBrowserSupport();
const format = support.webp ? 'webp' : 'jpeg';
```

### 3. 메타데이터 활용
```typescript
const result = await processImage(source).resize(300, 200).toBlob();

console.log('처리 시간:', result.processingTime, 'ms');
console.log('압축률:', result.originalSize
  ? ((1 - result.blob.size / result.originalSize) * 100).toFixed(2) + '%'
  : 'N/A'
);
```

---

## 참고 자료

- [사용법 가이드](./usage-guide.md)
- [베스트 프랙티스](./best-practices.md)
- [성능 최적화 팁](./performance-tips.md)
- [트러블슈팅](./troubleshooting.md)
- [메인 CLAUDE.md](../CLAUDE.md) - 레거시 지원 중단 정책

---

## 지원

마이그레이션 관련 문제 발생 시:
1. [트러블슈팅 가이드](./troubleshooting.md) 확인
2. [GitHub Issues](https://github.com/YOUR_REPO/issues) 검색
3. 새로운 이슈 생성 시 다음 정보 포함:
   - v1.x 버전 번호
   - 마이그레이션 단계
   - 에러 메시지 전체
   - 코드 스니펫