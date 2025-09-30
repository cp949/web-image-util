# 베스트 프랙티스

`@cp949/web-image-util` 사용 시 권장 사항 및 베스트 프랙티스를 안내합니다.

## 📖 목차

1. [성능 최적화](#성능-최적화)
2. [품질 설정](#품질-설정)
3. [포맷 선택](#포맷-선택)
4. [에러 처리](#에러-처리)
5. [메모리 관리](#메모리-관리)
6. [브라우저 호환성](#브라우저-호환성)
7. [보안 고려사항](#보안-고려사항)

---

## 성능 최적화

### 1. 적절한 이미지 크기 선택

**웹용 이미지 권장 크기**:

| 용도 | 권장 크기 | 비고 |
|------|-----------|------|
| 썸네일 | 150x150px | 목록 표시용 |
| 프로필 이미지 | 200x200px | 아바타용 |
| 제품 이미지 (소형) | 300x300px | 모바일 최적화 |
| 제품 이미지 (중형) | 600x600px | 데스크톱 기본 |
| 제품 이미지 (대형) | 1200x1200px | 확대 보기용 |
| 배너 이미지 | 1920x1080px | 풀 HD |
| 소셜 미디어 | 플랫폼별 상이 | 프리셋 함수 사용 권장 |

**✅ 권장**:
```typescript
// 용도에 맞는 크기 설정
const thumbnail = await processImage(source)
  .resize(150, 150, { fit: 'cover' })
  .toBlob();
```

**❌ 지양**:
```typescript
// 과도하게 큰 이미지
const oversized = await processImage(source)
  .resize(5000, 5000)  // 불필요하게 큼
  .toBlob();
```

---

### 2. 확대 금지 옵션 활용

원본 이미지보다 큰 크기로 확대하면 품질 저하가 발생합니다.

**✅ 권장**:
```typescript
const result = await processImage(source)
  .resize(300, 200, {
    fit: 'inside',  // 축소만 수행 (확대 안함)
    withoutEnlargement: true
  })
  .toBlob();
```

**❌ 지양**:
```typescript
// 저해상도 이미지를 무리하게 확대
const lowRes = await processImage(smallImage)  // 100x100px
  .resize(1000, 1000)  // 10배 확대 → 품질 저하
  .toBlob();
```

---

### 3. 프리셋 함수 활용

반복적인 작업은 프리셋 함수를 사용하여 간소화하세요.

**✅ 권장**:
```typescript
import { createThumbnail } from '@cp949/web-image-util/presets';

// 간결하고 최적화된 코드
const thumbnail = await createThumbnail(source, { size: 150 });
```

**❌ 지양**:
```typescript
// 매번 동일한 옵션을 수동 설정
const thumbnail = await processImage(source)
  .resize(150, 150, { fit: 'cover' })
  .toBlob({ format: 'webp', quality: 0.8 });
```

---

### 4. 배치 처리 활용

여러 이미지를 동시에 처리할 때는 배치 처리를 사용하세요.

**✅ 권장**:
```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

const processor = new AdvancedImageProcessor();
const results = await processor.processBatch(images, {
  resize: { width: 300, height: 200, fit: 'cover' },
  format: 'webp',
  quality: 0.8
});
```

**❌ 지양**:
```typescript
// 순차 처리 (느림)
const results = [];
for (const image of images) {
  const result = await processImage(image)
    .resize(300, 200)
    .toBlob();
  results.push(result);
}
```

---

## 품질 설정

### 1. 포맷별 권장 품질 값

| 포맷 | 용도 | 권장 품질 | 비고 |
|------|------|-----------|------|
| **JPEG** | 사진 | 80-85% | 균형 잡힌 품질/크기 |
| **JPEG** | 그래픽 | 90-95% | 선명도 중요 |
| **PNG** | 투명도 필요 | 100% | 무손실 압축 |
| **WebP** | 웹 최적화 | 75-85% | 우수한 압축률 |
| **WebP** | 고품질 필요 | 90-95% | 품질 우선 |

**✅ 권장**:
```typescript
// 사진: JPEG 80%
const photo = await processImage(photoSource)
  .toBlob({ format: 'jpeg', quality: 0.8 });

// 그래픽: PNG 100%
const graphic = await processImage(graphicSource)
  .toBlob({ format: 'png', quality: 1.0 });

// 웹 최적화: WebP 80%
const optimized = await processImage(source)
  .toBlob({ format: 'webp', quality: 0.8 });
```

**❌ 지양**:
```typescript
// 과도하게 낮은 품질
const lowQuality = await processImage(source)
  .toBlob({ quality: 0.3 });  // 시각적 품질 저하

// 불필요하게 높은 품질
const highQuality = await processImage(source)
  .toBlob({ format: 'jpeg', quality: 1.0 });  // 파일 크기만 증가
```

---

### 2. SVG 품질 설정

SVG를 래스터 이미지로 변환할 때는 복잡도를 고려하세요.

**✅ 권장**:
```typescript
// 자동 품질 선택 (복잡도 기반)
const auto = await processImage(svgSource)
  .quality('auto')
  .resize(800, 600)
  .toBlob();

// 복잡한 SVG: 높은 품질
const complex = await processImage(complexSvg)
  .quality('ultra')  // 4x 스케일링
  .resize(800, 600)
  .toBlob();

// 간단한 SVG: 표준 품질
const simple = await processImage(simpleSvg)
  .quality('standard')  // 2x 스케일링
  .resize(800, 600)
  .toBlob();
```

**❌ 지양**:
```typescript
// 복잡한 SVG에 낮은 품질 사용
const badQuality = await processImage(complexSvg)
  .quality('low')  // 1x 스케일링 → 품질 저하
  .resize(800, 600)
  .toBlob();
```

---

## 포맷 선택

### 1. 포맷별 특징 및 사용 시나리오

#### JPEG
- **장점**: 작은 파일 크기, 빠른 로딩, 광범위한 지원
- **단점**: 투명도 미지원, 손실 압축
- **권장 사용**: 사진, 복잡한 색상의 이미지

**✅ 권장**:
```typescript
// 사진
const photo = await processImage(photoSource)
  .toBlob({ format: 'jpeg', quality: 0.85 });
```

---

#### PNG
- **장점**: 투명도 지원, 무손실 압축, 선명한 그래픽
- **단점**: 큰 파일 크기
- **권장 사용**: 로고, 아이콘, 투명 배경 필요한 이미지

**✅ 권장**:
```typescript
// 로고 (투명 배경)
const logo = await processImage(logoSource)
  .toBlob({ format: 'png', quality: 1.0 });
```

---

#### WebP
- **장점**: 우수한 압축률, 투명도 지원, JPEG보다 20-30% 작은 크기
- **단점**: 일부 브라우저 미지원 (IE, 구형 Safari)
- **권장 사용**: 웹 최적화 (브라우저 지원 확인 필요)

**✅ 권장**:
```typescript
// 스마트 포맷 선택
const smartFormat = async (source: ImageSource) => {
  const supportsWebP = await checkWebPSupport();
  return await processImage(source).toBlob({
    format: supportsWebP ? 'webp' : 'jpeg',
    quality: 0.8
  });
};
```

---

### 2. 스마트 포맷 선택 전략

**✅ 권장**:
```typescript
// 브라우저 지원에 따른 자동 포맷 선택
import {
  detectBrowserSupport,
  processImage
} from '@cp949/web-image-util';

const smartFormat = async (source: ImageSource) => {
  const support = await detectBrowserSupport();

  let format: 'webp' | 'jpeg' | 'png' = 'jpeg';

  if (support.webp) {
    format = 'webp';  // WebP 우선
  } else if (needsTransparency(source)) {
    format = 'png';   // 투명도 필요 시 PNG
  }

  return await processImage(source).toBlob({ format, quality: 0.8 });
};
```

---

## 에러 처리

### 1. 기본 에러 처리 패턴

**✅ 권장**:
```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

const safeProcess = async (source: ImageSource) => {
  try {
    return await processImage(source)
      .resize(300, 200)
      .toBlob();
  } catch (error) {
    if (error instanceof ImageProcessError) {
      // 구체적인 에러 처리
      switch (error.code) {
        case 'INVALID_SOURCE':
          console.error('지원하지 않는 이미지 형식입니다.');
          break;
        case 'SOURCE_LOAD_FAILED':
          console.error('이미지를 불러올 수 없습니다.');
          break;
        case 'CANVAS_CREATION_FAILED':
          console.error('이미지 처리 중 오류가 발생했습니다.');
          break;
        default:
          console.error(`처리 오류: ${error.message}`);
      }
    } else {
      console.error('알 수 없는 오류가 발생했습니다.');
    }
    throw error;
  }
};
```

**❌ 지양**:
```typescript
// 에러를 무시하거나 일반적으로 처리
const badProcess = async (source: ImageSource) => {
  try {
    return await processImage(source).resize(300, 200).toBlob();
  } catch (error) {
    console.error('오류 발생');  // 구체적인 정보 없음
  }
};
```

---

### 2. 복구 가능한 에러 처리

**✅ 권장**:
```typescript
// 포맷 폴백 전략
const processWithFallback = async (source: ImageSource) => {
  const formats = ['webp', 'jpeg', 'png'] as const;

  for (const format of formats) {
    try {
      return await processImage(source).toBlob({ format });
    } catch (error) {
      if (error instanceof ImageProcessError && error.code === 'OUTPUT_FAILED') {
        continue;  // 다음 포맷 시도
      }
      throw error;  // 다른 에러는 즉시 throw
    }
  }

  throw new Error('모든 포맷 처리 실패');
};
```

---

### 3. 사용자 친화적 에러 UI

**✅ 권장** (React 예제):
```typescript
import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { ImageProcessError } from '@cp949/web-image-util';

function ImageProcessor() {
  const [error, setError] = useState<ImageProcessError | null>(null);

  const handleProcess = async () => {
    try {
      setError(null);
      const result = await processImage(source).resize(300, 200).toBlob();
      // 성공 처리...
    } catch (err) {
      setError(err as ImageProcessError);
    }
  };

  const getErrorMessage = (err: ImageProcessError): string => {
    switch (err.code) {
      case 'INVALID_SOURCE':
        return '지원하지 않는 이미지 형식입니다. JPEG, PNG, WebP, SVG 파일을 사용해주세요.';
      case 'SOURCE_LOAD_FAILED':
        return '이미지를 불러올 수 없습니다. 파일이 손상되었거나 네트워크 오류가 발생했습니다.';
      case 'CANVAS_CREATION_FAILED':
        return '이미지 처리 중 오류가 발생했습니다. 이미지 크기가 너무 크거나 메모리가 부족합니다.';
      default:
        return `처리 오류: ${err.message}`;
    }
  };

  const isRecoverableError = (err: ImageProcessError): boolean => {
    return ['OUTPUT_FAILED', 'CANVAS_CREATION_FAILED'].includes(err.code);
  };

  return (
    <>
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          action={
            isRecoverableError(error) && (
              <Button color="inherit" onClick={handleProcess}>
                다시 시도
              </Button>
            )
          }
        >
          {getErrorMessage(error)}
        </Alert>
      )}
      {/* 나머지 UI... */}
    </>
  );
}
```

---

## 메모리 관리

### 1. Canvas Pool 활용

v2.0은 자동으로 Canvas Pool을 관리하지만, 최적 사용 방법이 있습니다.

**✅ 권장**:
```typescript
// 순차 처리 (메모리 효율적)
for (const image of images) {
  const result = await processImage(image).resize(300, 200).toBlob();
  await saveImage(result);
  // Canvas는 자동으로 Pool에 반환됨
}
```

**❌ 지양**:
```typescript
// 동시 처리 과다 (메모리 부족 위험)
const promises = images.map(image =>
  processImage(image).resize(5000, 5000).toBlob()  // 대형 이미지 동시 처리
);
await Promise.all(promises);  // 메모리 부족 가능
```

---

### 2. 메모리 사용량 모니터링

**✅ 권장**:
```typescript
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

function ImageProcessor() {
  const { metrics, startMonitoring, stopMonitoring } = usePerformanceMonitor();

  const handleProcess = async () => {
    startMonitoring();
    try {
      const result = await processImage(source).resize(300, 200).toBlob();
      // 처리 완료
    } finally {
      stopMonitoring();
    }
  };

  return (
    <div>
      <p>메모리 사용량: {metrics.memoryUsage}MB</p>
      <p>처리 시간: {metrics.processingTime}ms</p>
    </div>
  );
}
```

---

## 브라우저 호환성

### 1. 브라우저 지원 감지

**✅ 권장**:
```typescript
import { detectBrowserSupport } from '@cp949/web-image-util/utils';

const support = await detectBrowserSupport();

console.log('WebP 지원:', support.webp);
console.log('AVIF 지원:', support.avif);
console.log('OffscreenCanvas 지원:', support.offscreenCanvas);

// 지원에 따른 처리
if (support.webp) {
  // WebP 사용
} else {
  // JPEG/PNG 폴백
}
```

---

### 2. 폴리필 및 폴백 전략

**✅ 권장**:
```typescript
// 브라우저별 최적 전략
const getOptimalFormat = async (): Promise<'webp' | 'jpeg' | 'png'> => {
  const support = await detectBrowserSupport();

  if (support.avif) return 'avif';  // 최선 (미래)
  if (support.webp) return 'webp';  // 차선
  return 'jpeg';  // 기본
};
```

---

## 보안 고려사항

### 1. 사용자 입력 검증

**✅ 권장**:
```typescript
// 파일 타입 및 크기 검증
const validateImage = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  const maxSize = 10 * 1024 * 1024;  // 10MB

  if (!validTypes.includes(file.type)) {
    alert('지원하지 않는 파일 형식입니다.');
    return false;
  }

  if (file.size > maxSize) {
    alert('파일 크기가 10MB를 초과합니다.');
    return false;
  }

  return true;
};

// 사용
const handleFileUpload = async (file: File) => {
  if (!validateImage(file)) return;

  const result = await processImage(file).resize(300, 200).toBlob();
  // 처리 계속...
};
```

---

### 2. SVG 보안

SVG 파일은 악의적인 스크립트를 포함할 수 있습니다.

**✅ 권장**:
```typescript
import { enhanceBrowserCompatibility } from '@cp949/web-image-util/svg-compatibility';

// SVG를 래스터 이미지로 변환하여 스크립트 제거
const safeSvg = async (svgSource: string) => {
  // SVG를 PNG로 변환 (스크립트 실행 방지)
  const result = await processImage(svgSource)
    .resize(800, 600)
    .toBlob({ format: 'png' });

  return result;
};
```

**❌ 지양**:
```typescript
// SVG를 직접 DOM에 삽입 (XSS 위험)
const unsafeSvg = (svgString: string) => {
  document.getElementById('container')!.innerHTML = svgString;  // 위험!
};
```

---

## 요약 체크리스트

### 성능
- [ ] 용도에 맞는 이미지 크기 선택
- [ ] 확대 금지 옵션 활용
- [ ] 프리셋 함수 사용
- [ ] 배치 처리 활용

### 품질
- [ ] 포맷별 권장 품질 값 적용
- [ ] SVG 품질 자동 선택 사용
- [ ] 과도한 압축 지양

### 포맷
- [ ] 용도에 맞는 포맷 선택
- [ ] WebP 우선 사용 (지원 시)
- [ ] 스마트 포맷 선택 전략 적용

### 에러
- [ ] ImageProcessError 사용
- [ ] 복구 가능한 에러 처리
- [ ] 사용자 친화적 에러 메시지

### 메모리
- [ ] Canvas Pool 적절히 활용
- [ ] 메모리 사용량 모니터링
- [ ] 과도한 동시 처리 지양

### 호환성
- [ ] 브라우저 지원 감지
- [ ] 폴백 전략 수립
- [ ] 최신 브라우저 권장

### 보안
- [ ] 사용자 입력 검증
- [ ] SVG 안전하게 처리
- [ ] 파일 크기 제한

---

## 관련 문서

- [사용법 가이드](./usage-guide.md)
- [성능 최적화 팁](./performance-tips.md)
- [마이그레이션 가이드](./migration-guide.md)
- [트러블슈팅](./troubleshooting.md)