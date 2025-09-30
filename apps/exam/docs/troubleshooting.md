# 트러블슈팅 가이드

`@cp949/web-image-util` 사용 시 발생할 수 있는 문제와 해결 방법을 안내합니다.

## 📖 목차

1. [이미지 업로드 문제](#이미지-업로드-문제)
2. [처리 속도 문제](#처리-속도-문제)
3. [품질 관련 문제](#품질-관련-문제)
4. [메모리 문제](#메모리-문제)
5. [브라우저 호환성 문제](#브라우저-호환성-문제)
6. [빌드 및 배포 문제](#빌드-및-배포-문제)
7. [에러 코드 참조](#에러-코드-참조)

---

## 이미지 업로드 문제

### 문제: 이미지가 업로드되지 않음

**증상**:
- 드래그앤드롭이 작동하지 않음
- 파일 선택 후 아무 반응 없음
- "Invalid source" 에러 발생

**원인 및 해결**:

#### 1. 지원하지 않는 파일 형식
```typescript
// 지원 형식 확인
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/bmp'];

const validateFileType = (file: File): boolean => {
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    alert(`지원하지 않는 형식: ${file.type}\n지원 형식: ${SUPPORTED_FORMATS.join(', ')}`);
    return false;
  }
  return true;
};
```

#### 2. 파일 크기 제한 초과
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB

const validateFileSize = (file: File): boolean => {
  if (file.size > MAX_FILE_SIZE) {
    alert(`파일 크기가 너무 큽니다: ${(file.size / 1024 / 1024).toFixed(2)}MB\n최대 크기: 10MB`);
    return false;
  }
  return true;
};
```

#### 3. 손상된 이미지 파일
```typescript
import { ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(file).toBlob();
} catch (error) {
  if (error instanceof ImageProcessError && error.code === 'SOURCE_LOAD_FAILED') {
    alert('이미지 파일이 손상되었거나 읽을 수 없습니다.');
  }
}
```

---

### 문제: SVG 이미지가 제대로 표시되지 않음

**증상**:
- SVG 업로드 후 빈 화면
- SVG 크기가 이상함
- "Invalid SVG" 에러

**원인 및 해결**:

#### 1. SVG 네임스페이스 누락
```typescript
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/svg-compatibility';

// SVG 호환성 자동 보정
const fixedSvg = await enhanceBrowserCompatibility(svgString);
const result = await processImage(fixedSvg).resize(800, 600).toBlob();
```

#### 2. viewBox 속성 누락
```typescript
// SVG 문자열에 viewBox가 없는 경우
const addViewBox = (svgString: string): string => {
  // normalizeSvgBasics가 자동으로 처리
  return svgString;
};

// 사용
import { normalizeSvgBasics } from '@cp949/web-image-util/svg-compatibility';
const normalized = await normalizeSvgBasics(svgString);
```

#### 3. SVG 품질 문제
```typescript
// 복잡한 SVG는 높은 품질 레벨 사용
const result = await processImage(svgSource)
  .quality('ultra')  // 4x 스케일링
  .resize(800, 600)
  .toBlob();
```

---

## 처리 속도 문제

### 문제: 이미지 처리가 너무 느림

**증상**:
- 처리 시간이 5초 이상
- 브라우저가 응답 없음
- "처리 중" 상태가 계속됨

**원인 및 해결**:

#### 1. 이미지 크기가 너무 큼
```typescript
// ❌ 문제가 되는 코드
const result = await processImage(largeImage)  // 10000x10000px
  .resize(300, 200)
  .toBlob();

// ✅ 해결 방법
const MAX_INPUT_SIZE = 4096;  // 최대 4K

const preprocessLargeImage = async (source: ImageSource) => {
  const img = await loadImage(source);

  if (img.width > MAX_INPUT_SIZE || img.height > MAX_INPUT_SIZE) {
    // 먼저 중간 크기로 축소
    const intermediate = await processImage(source)
      .resize(MAX_INPUT_SIZE, MAX_INPUT_SIZE, { fit: 'inside' })
      .toBlob();

    // 그 다음 목표 크기로 축소
    return await processImage(intermediate)
      .resize(300, 200)
      .toBlob();
  }

  return await processImage(source).resize(300, 200).toBlob();
};
```

#### 2. 과도한 품질 설정
```typescript
// ❌ 불필요하게 높은 품질
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format: 'png', quality: 1.0 });  // 느림

// ✅ 적절한 품질
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format: 'jpeg', quality: 0.85 });  // 빠름
```

#### 3. 동시 처리 과다
```typescript
// ❌ 너무 많은 이미지를 동시 처리
const promises = images.map(img => processImage(img).resize(300, 200).toBlob());
await Promise.all(promises);  // 메모리 부족 위험

// ✅ 배치 처리 또는 제한된 동시 처리
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

const processor = new AdvancedImageProcessor();
const results = await processor.processBatch(images, {
  resize: { width: 300, height: 200, fit: 'cover' }
});
```

---

### 문제: 배치 처리가 멈춤

**증상**:
- 진행률이 특정 지점에서 멈춤
- 브라우저 탭이 응답 없음
- 메모리 부족 경고

**해결**:

```typescript
// 순차 처리로 메모리 부담 감소
const processBatchSequentially = async (images: File[]) => {
  const results = [];

  for (const image of images) {
    try {
      const result = await processImage(image).resize(300, 200).toBlob();
      results.push({ success: true, result });
    } catch (error) {
      results.push({ success: false, error });
    }

    // 메모리 정리 시간 제공
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
};
```

---

## 품질 관련 문제

### 문제: 결과 이미지 품질이 기대보다 낮음

**증상**:
- 이미지가 흐릿함
- 색상이 변색됨
- 압축 아티팩트 발생

**원인 및 해결**:

#### 1. 품질 설정이 너무 낮음
```typescript
// ❌ 낮은 품질
const result = await processImage(source)
  .toBlob({ quality: 0.5 });  // 50% 품질

// ✅ 적절한 품질
const result = await processImage(source)
  .toBlob({ quality: 0.85 });  // 85% 품질
```

#### 2. 원본보다 확대
```typescript
// ❌ 저해상도 이미지를 확대
const result = await processImage(smallImage)  // 100x100px
  .resize(1000, 1000)  // 10배 확대
  .toBlob();

// ✅ 확대 금지 옵션
const result = await processImage(source)
  .resize(1000, 1000, {
    fit: 'inside',
    withoutEnlargement: true  // 확대 방지
  })
  .toBlob();
```

#### 3. 부적절한 포맷 사용
```typescript
// ❌ 사진을 PNG로 저장
const result = await processImage(photo)
  .toBlob({ format: 'png' });  // 파일 크기만 증가

// ✅ 사진은 JPEG 사용
const result = await processImage(photo)
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

---

### 문제: SVG 품질이 낮음

**해결**:

```typescript
// SVG 품질 레벨 상향
const result = await processImage(svgSource)
  .quality('ultra')  // 4x 스케일링
  .resize(800, 600)
  .toBlob();

// 또는 자동 선택
const result = await processImage(svgSource)
  .quality('auto')  // 복잡도 기반 자동 선택
  .resize(800, 600)
  .toBlob();
```

---

## 메모리 문제

### 문제: "Out of memory" 에러

**증상**:
- 브라우저 탭 크래시
- "Uncaught RangeError: Maximum call stack size exceeded"
- 시스템이 느려짐

**원인 및 해결**:

#### 1. 대형 이미지 처리
```typescript
// ✅ 이미지 크기 제한
const MAX_DIMENSION = 4096;

const safeResize = async (source: ImageSource, targetWidth: number, targetHeight: number) => {
  const img = await loadImage(source);

  // 원본이 너무 크면 먼저 축소
  if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
    const intermediate = await processImage(source)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside' })
      .toBlob();

    return await processImage(intermediate)
      .resize(targetWidth, targetHeight)
      .toBlob();
  }

  return await processImage(source)
    .resize(targetWidth, targetHeight)
    .toBlob();
};
```

#### 2. 메모리 누수 방지
```typescript
// Canvas 수동 정리 (필요 시)
const result = await processImage(source).resize(300, 200).toBlob();

// 사용 후 참조 해제
imageElement.src = '';
imageElement = null;
```

---

## 브라우저 호환성 문제

### 문제: 특정 브라우저에서 작동하지 않음

**증상**:
- WebP 포맷이 지원되지 않음
- OffscreenCanvas 에러
- Blob download가 작동하지 않음

**원인 및 해결**:

#### 1. WebP 미지원 브라우저 (IE, 구형 Safari)
```typescript
import { detectBrowserSupport } from '@cp949/web-image-util/utils';

const smartFormat = async (source: ImageSource) => {
  const support = await detectBrowserSupport();

  const format = support.webp ? 'webp' : 'jpeg';

  return await processImage(source).toBlob({ format });
};
```

#### 2. OffscreenCanvas 미지원
```typescript
// 라이브러리가 자동으로 폴백하지만, 수동 확인 가능
const support = await detectBrowserSupport();

if (!support.offscreenCanvas) {
  console.warn('OffscreenCanvas 미지원. Canvas 2D 사용.');
}
```

#### 3. 다운로드 기능 폴백
```typescript
// iOS Safari 등 일부 브라우저는 download 속성 미지원
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  // iOS Safari 폴백
  if ('download' in a) {
    a.click();
  } else {
    window.open(url, '_blank');
  }

  URL.revokeObjectURL(url);
};
```

---

## 빌드 및 배포 문제

### 문제: 빌드 실패

**증상**:
```
Module not found: Can't resolve '@cp949/web-image-util/...'
```

**해결**:

#### 1. Import 경로 확인
```typescript
// ❌ 잘못된 경로
import { processImage } from '@cp949/web-image-util/dist';
import { createThumbnail } from '@cp949/web-image-util/dist/presets';

// ✅ 올바른 경로
import { processImage } from '@cp949/web-image-util';
import { createThumbnail } from '@cp949/web-image-util/presets';
```

#### 2. 의존성 재설치
```bash
rm -rf node_modules package-lock.json
npm install

# 또는
pnpm install
```

---

### 문제: TypeScript 에러

**증상**:
```
Property 'processingTime' does not exist on type 'Blob'
```

**해결**:

```typescript
// ✅ 올바른 타입 import
import { ResultBlob, processImage } from '@cp949/web-image-util';

const result: ResultBlob = await processImage(source).resize(300, 200).toBlob();

console.log('처리 시간:', result.processingTime);
```

---

## 에러 코드 참조

### ImageProcessError 코드 목록

| 코드 | 의미 | 원인 | 해결 방법 |
|------|------|------|-----------|
| `INVALID_SOURCE` | 지원하지 않는 소스 타입 | 잘못된 파일 형식 | 지원 형식 확인 (JPEG, PNG, WebP, SVG) |
| `SOURCE_LOAD_FAILED` | 소스 로딩 실패 | 손상된 파일, 네트워크 오류 | 파일 재업로드, 네트워크 확인 |
| `CANVAS_CREATION_FAILED` | Canvas 생성 실패 | 메모리 부족, 크기 초과 | 이미지 크기 축소, 메모리 확보 |
| `OUTPUT_FAILED` | 출력 생성 실패 | 포맷 미지원, 메모리 부족 | 다른 포맷 시도, 품질 낮춤 |
| `INVALID_OPTIONS` | 잘못된 옵션 | 옵션 값 오류 | 옵션 값 확인 및 수정 |

---

### 에러 처리 템플릿

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

const handleImageProcess = async (source: ImageSource) => {
  try {
    const result = await processImage(source).resize(300, 200).toBlob();
    return { success: true, result };
  } catch (error) {
    if (error instanceof ImageProcessError) {
      switch (error.code) {
        case 'INVALID_SOURCE':
          return { success: false, message: '지원하지 않는 이미지 형식입니다.' };
        case 'SOURCE_LOAD_FAILED':
          return { success: false, message: '이미지를 불러올 수 없습니다.' };
        case 'CANVAS_CREATION_FAILED':
          return { success: false, message: '이미지 처리 중 오류가 발생했습니다.' };
        case 'OUTPUT_FAILED':
          // 포맷 폴백 시도
          try {
            const fallback = await processImage(source)
              .resize(300, 200)
              .toBlob({ format: 'jpeg' });
            return { success: true, result: fallback };
          } catch {
            return { success: false, message: '이미지 출력에 실패했습니다.' };
          }
        default:
          return { success: false, message: `처리 오류: ${error.message}` };
      }
    }
    return { success: false, message: '알 수 없는 오류가 발생했습니다.' };
  }
};
```

---

## FAQ

### Q1: 이미지 처리 시간이 얼마나 걸리나요?

**A**: 이미지 크기와 복잡도에 따라 다릅니다:
- 소형 (300x300px): 50-100ms
- 중형 (1000x1000px): 200-500ms
- 대형 (4000x4000px): 1-3초

### Q2: 최대 이미지 크기는?

**A**: 브라우저 메모리에 따라 다르지만, 권장 최대 크기는 4096x4096px입니다.

### Q3: SVG를 PNG로 변환할 때 권장 품질은?

**A**: 복잡도에 따라 다릅니다:
- 간단한 로고: `quality: 'standard'` (2x)
- 복잡한 일러스트: `quality: 'ultra'` (4x)
- 자동 선택: `quality: 'auto'` (권장)

### Q4: WebP를 지원하지 않는 브라우저는?

**A**: Internet Explorer, Safari < 14. `detectBrowserSupport()`로 자동 감지 및 폴백 권장.

### Q5: 메모리 사용량을 줄이는 방법은?

**A**:
1. 이미지 크기 제한 (4096px 이하)
2. 순차 처리 (동시 처리 제한)
3. 적절한 품질 설정 (80-85%)

---

## 추가 지원

**문서**:
- [사용법 가이드](./usage-guide.md)
- [베스트 프랙티스](./best-practices.md)
- [성능 최적화 팁](./performance-tips.md)
- [마이그레이션 가이드](./migration-guide.md)

**커뮤니티**:
- GitHub Issues
- 프로젝트 README

**긴급 문제**:
1. 브라우저 콘솔 에러 확인
2. 네트워크 탭 확인
3. 파일 형식 및 크기 확인
4. GitHub Issues 검색 및 생성