# 고급 기능 가이드

> @cp949/web-image-util의 전문 기능들 - 필터, 워터마크, 합성, 성능 최적화

[![← 메인 가이드로 돌아가기](https://img.shields.io/badge/←-메인%20가이드-blue?style=for-the-badge)](./README.md)

## 📖 목차

- [🎨 필터 시스템](#-필터-시스템)
- [🏷️ 워터마크 시스템](#-워터마크-시스템)
- [🖼️ 이미지 합성](#-이미지-합성)
- [⚡ 성능 최적화](#-성능-최적화)
- [🔧 개발자 도구](#-개발자-도구)

---

## 🎨 필터 시스템

플러그인 기반의 강력한 필터 시스템으로 이미지에 다양한 효과를 적용할 수 있습니다.

### 기본 필터 사용법

```typescript
import { processImage } from '@cp949/web-image-util';
import {
  BrightnessFilterPlugin,
  BlurFilterPlugin,
  GrayscaleFilterPlugin
} from '@cp949/web-image-util/filters';

// 단일 필터 적용
const brightened = await processImage(source)
  .filter(BrightnessFilterPlugin, { value: 20 })  // 밝기 +20
  .toBlob();

// 다중 필터 체이닝
const processed = await processImage(source)
  .resize(400, 300)
  .filter(GrayscaleFilterPlugin)  // 흑백 변환
  .filter(BlurFilterPlugin, { radius: 2 })  // 블러 효과
  .toBlob();
```

### 색상 조정 필터

```typescript
import {
  BrightnessFilterPlugin,
  ContrastFilterPlugin,
  SaturationFilterPlugin
} from '@cp949/web-image-util/filters';

// 밝기 조정 (-100 ~ +100)
await processImage(source)
  .filter(BrightnessFilterPlugin, { value: 15 })
  .toBlob();

// 대비 조정 (-100 ~ +100)
await processImage(source)
  .filter(ContrastFilterPlugin, { value: 25 })
  .toBlob();

// 채도 조정 (-100 ~ +100)
await processImage(source)
  .filter(SaturationFilterPlugin, { value: -20 })  // 채도 감소
  .toBlob();

// 조합 사용
const enhanced = await processImage(source)
  .filter(BrightnessFilterPlugin, { value: 10 })
  .filter(ContrastFilterPlugin, { value: 15 })
  .filter(SaturationFilterPlugin, { value: 5 })
  .toBlob();
```

### 효과 필터

```typescript
import {
  BlurFilterPlugin,
  SharpenFilterPlugin,
  GrayscaleFilterPlugin,
  SepiaFilterPlugin,
  EmbossFilterPlugin,
  EdgeDetectionFilterPlugin
} from '@cp949/web-image-util/filters';

// 블러 효과 (반지름 1-10)
await processImage(source)
  .filter(BlurFilterPlugin, { radius: 3 })
  .toBlob();

// 선명하게 만들기
await processImage(source)
  .filter(SharpenFilterPlugin, { strength: 1.5 })
  .toBlob();

// 흑백 변환
await processImage(source)
  .filter(GrayscaleFilterPlugin)
  .toBlob();

// 세피아 톤
await processImage(source)
  .filter(SepiaFilterPlugin, { intensity: 0.8 })
  .toBlob();

// 엠보스 효과
await processImage(source)
  .filter(EmbossFilterPlugin, { strength: 2 })
  .toBlob();

// 가장자리 검출
await processImage(source)
  .filter(EdgeDetectionFilterPlugin, { threshold: 50 })
  .toBlob();
```

### 커스텀 필터 개발

```typescript
import { FilterPlugin } from '@cp949/web-image-util/filters';

// 커스텀 빈티지 필터
const VintageFilterPlugin: FilterPlugin<{ intensity: number }> = {
  name: 'vintage',
  apply: (imageData, { intensity = 0.5 }) => {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // 빨강, 초록, 파랑 채널 조정
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // 빈티지 효과 공식
      data[i] = Math.min(255, r * 0.9 + g * 0.5 + b * 0.1);     // 빨강
      data[i + 1] = Math.min(255, r * 0.3 + g * 0.8 + b * 0.1); // 초록
      data[i + 2] = Math.min(255, r * 0.2 + g * 0.3 + b * 0.5); // 파랑
    }

    return imageData;
  }
};

// 사용하기
await processImage(source)
  .filter(VintageFilterPlugin, { intensity: 0.7 })
  .toBlob();
```

---

## 🏷️ 워터마크 시스템

텍스트와 이미지 워터마크를 자유롭게 조합하여 사용할 수 있습니다.

### 텍스트 워터마크

```typescript
import { TextWatermark } from '@cp949/web-image-util/advanced';

// 기본 텍스트 워터마크
const watermarked = await processImage(source)
  .resize(800, 600)
  .addTextWatermark({
    text: '© 2024 My Company',
    position: 'bottom-right',
    style: {
      fontFamily: 'Arial',
      fontSize: 24,
      color: '#ffffff',
      opacity: 0.8
    }
  })
  .toBlob();

// 고급 텍스트 스타일
const styled = await processImage(source)
  .addTextWatermark({
    text: 'CONFIDENTIAL',
    position: 'center',
    style: {
      fontFamily: 'Arial Black',
      fontSize: 48,
      fontWeight: 'bold',
      color: '#ff0000',
      strokeColor: '#ffffff',
      strokeWidth: 2,
      shadow: {
        color: 'rgba(0,0,0,0.5)',
        offsetX: 2,
        offsetY: 2,
        blur: 4
      },
      opacity: 0.6
    },
    rotation: -45  // 45도 회전
  })
  .toBlob();
```

### 텍스트 워터마크 위치 옵션

```typescript
// 미리 정의된 위치
type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

// 커스텀 위치 (픽셀 단위)
await processImage(source)
  .addTextWatermark({
    text: 'Custom Position',
    position: 'custom',
    customPosition: { x: 50, y: 100 },  // 왼쪽에서 50px, 위에서 100px
    style: { fontSize: 20, color: '#000000' }
  })
  .toBlob();

// 여백 조정
await processImage(source)
  .addTextWatermark({
    text: 'With Margin',
    position: 'bottom-right',
    margin: { x: 20, y: 20 },  // 가장자리에서 20px 여백
    style: { fontSize: 16, color: '#ffffff' }
  })
  .toBlob();
```

### 다중 텍스트 워터마크

```typescript
// 여러 텍스트 워터마크 조합
const multiWatermark = await processImage(source)
  .addTextWatermark({
    text: '© 2024 Company',
    position: 'bottom-right',
    style: { fontSize: 14, color: '#ffffff', opacity: 0.8 }
  })
  .addTextWatermark({
    text: 'SAMPLE',
    position: 'center',
    style: {
      fontSize: 72,
      color: '#ff0000',
      opacity: 0.3,
      fontWeight: 'bold'
    },
    rotation: -30
  })
  .toBlob();
```

### 반복 패턴 텍스트 워터마크

```typescript
import { TextWatermark } from '@cp949/web-image-util/advanced';

// 타일링 워터마크 (전체 이미지에 반복)
const canvas = await processImage(source).toCanvas();

TextWatermark.addRepeatingPattern(canvas, {
  text: 'CONFIDENTIAL',
  style: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.1)',
    fontWeight: 'bold'
  },
  rotation: -45,
  spacing: { x: 200, y: 150 },  // 간격 조정
  stagger: true  // 지그재그 배치
});

const blob = canvas.toBlob();
```

### 이미지 워터마크

```typescript
import { ImageWatermark } from '@cp949/web-image-util/advanced';

// 로고 이미지 로드
const logoElement = new Image();
logoElement.src = '/logo.png';
await logoElement.decode();

// 기본 이미지 워터마크
const logoWatermarked = await processImage(source)
  .resize(800, 600)
  .addImageWatermark({
    watermarkImage: logoElement,
    position: 'top-left',
    scale: 0.3,  // 원본 크기의 30%
    opacity: 0.8,
    margin: { x: 20, y: 20 }
  })
  .toBlob();

// 고급 이미지 워터마크 옵션
const advanced = await processImage(source)
  .addImageWatermark({
    watermarkImage: logoElement,
    position: 'bottom-right',
    scale: 0.5,
    opacity: 0.7,
    rotation: 15,  // 15도 회전
    blendMode: 'multiply'  // 블렌딩 모드
  })
  .toBlob();
```

### 적응형 크기 워터마크

```typescript
// 이미지 크기에 따라 워터마크 크기 자동 조정
const canvas = await processImage(source).toCanvas();

ImageWatermark.addWithAdaptiveSize(canvas, {
  watermarkImage: logoElement,
  position: 'center',
  maxWidthPercent: 0.25,   // 이미지 너비의 최대 25%
  maxHeightPercent: 0.25,  // 이미지 높이의 최대 25%
  opacity: 0.6
});
```

---

## 🖼️ 이미지 합성

여러 이미지를 합성하여 하나의 이미지로 만드는 고급 기능입니다.

### 레이어 기반 합성

```typescript
import { ImageComposer, Layer } from '@cp949/web-image-util/advanced';

// 레이어 정의
const layers: Layer[] = [
  {
    image: backgroundImage,
    x: 0,
    y: 0,
    width: 800,
    height: 600
  },
  {
    image: overlayImage,
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    opacity: 0.8,
    blendMode: 'multiply'
  },
  {
    image: logoImage,
    x: 650,
    y: 50,
    width: 100,
    height: 50,
    rotation: 10  // 10도 회전
  }
];

// 합성 실행
const composed = await ImageComposer.composeLayers(layers, {
  width: 800,
  height: 600,
  backgroundColor: '#ffffff'
});

const result = composed.toDataURL();
```

### 그리드 레이아웃

```typescript
// 여러 이미지를 그리드로 배열
const gridImages = [image1, image2, image3, image4, image5, image6];

const gridComposed = await ImageComposer.composeGrid(gridImages, {
  rows: 2,
  cols: 3,
  spacing: 10,  // 이미지 간 간격
  backgroundColor: '#f0f0f0',
  fit: 'cover'  // 각 셀에서 이미지 맞춤 방식
});

const gridBlob = gridComposed.toBlob();
```

### 콜라주 스타일 합성

```typescript
// 자유로운 배치의 콜라주 생성
const collageImages = [photo1, photo2, photo3, photo4];

const collage = await ImageComposer.composeCollage(
  collageImages,
  { width: 1200, height: 800 },  // 캔버스 크기
  {
    backgroundColor: '#ffffff',
    randomRotation: true,      // 랜덤 회전
    maxRotation: 15,          // 최대 회전각 15도
    overlap: false            // 겹침 방지
  }
);

const collageBlob = collage.toBlob();
```

---

## ⚡ 성능 최적화

고해상도 이미지와 대량 처리를 위한 최적화 기법들입니다.

### 고해상도 이미지 처리

```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

// 단계적 리사이징으로 고해상도 이미지 처리
const optimized = await AdvancedImageProcessor.processLargeImage(largeImage, {
  targetWidth: 1920,
  targetHeight: 1080,
  priority: 'quality',  // 'speed' | 'quality' | 'balanced'
  stepSize: 0.5,        // 단계별 축소 비율
  memoryLimit: 100      // MB 단위 메모리 제한
});
```

### 배치 처리

```typescript
import { batchOptimize } from '@cp949/web-image-util/advanced';

// 여러 이미지 동시 최적화
const imageFiles = [file1, file2, file3, file4, file5];

const results = await batchOptimize(imageFiles, {
  resize: { width: 800, height: 600, fit: 'cover' },
  format: 'webp',
  quality: 0.8,
  concurrency: 3  // 동시 처리 개수
});

// 결과 처리
results.forEach((result, index) => {
  if (result.success) {
    console.log(`이미지 ${index + 1} 처리 완료:`, result.blob);
  } else {
    console.error(`이미지 ${index + 1} 처리 실패:`, result.error);
  }
});
```

### 메모리 관리

```typescript
import { CanvasPool, MemoryManager } from '@cp949/web-image-util/advanced';

// Canvas 풀 설정
CanvasPool.configure({
  maxSize: 10,      // 최대 풀 크기
  maxCanvasSize: {  // 개별 Canvas 최대 크기
    width: 4096,
    height: 4096
  }
});

// 메모리 사용량 모니터링
const memoryInfo = MemoryManager.getUsageInfo();
console.log('현재 메모리 사용량:', memoryInfo);

// 수동 정리
MemoryManager.cleanup();
```

### 성능 최적화 옵션

```typescript
// 성능 중심 처리
const fastResult = await processImage(source)
  .resize(800, 600, {
    fit: 'cover',
    interpolation: 'fast'  // 빠른 보간법
  })
  .toBlob({
    format: 'jpeg',
    quality: 0.8,
    progressive: false  // 프로그레시브 비활성화로 속도 향상
  });

// 품질 중심 처리
const qualityResult = await processImage(source)
  .resize(800, 600, {
    fit: 'cover',
    interpolation: 'lanczos'  // 고품질 보간법
  })
  .toBlob({
    format: 'png',
    quality: 0.95,
    progressive: true
  });
```

---

## 🔧 개발자 도구

라이브러리 확장과 커스터마이징을 위한 개발자 도구들입니다.

### AdvancedImageProcessor API

```typescript
import { AdvancedImageProcessor } from '@cp949/web-image-util/advanced';

// 고급 처리 파이프라인
const result = await AdvancedImageProcessor.processImage(source, {
  resize: {
    width: 800,
    height: 600,
    fit: 'cover',
    priority: 'quality'
  },
  filters: {
    enabled: true,
    filters: [
      { name: 'brightness', params: { value: 10 } },
      { name: 'contrast', params: { value: 15 } }
    ]
  },
  watermark: {
    text: {
      text: '© 2024 Company',
      position: 'bottom-right',
      style: { fontSize: 16, color: '#ffffff' }
    }
  },
  output: {
    format: 'webp',
    quality: 0.8
  }
});
```

### 플러그인 개발 가이드

```typescript
import { FilterPlugin, createFilterPlugin } from '@cp949/web-image-util/filters';

// 플러그인 인터페이스
interface MyFilterOptions {
  intensity: number;
  color: string;
}

// 커스텀 플러그인 생성
const MyCustomFilter = createFilterPlugin<MyFilterOptions>({
  name: 'myCustomFilter',
  version: '1.0.0',
  description: '커스텀 색상 효과 필터',

  // 옵션 검증
  validateOptions: (options) => {
    if (options.intensity < 0 || options.intensity > 100) {
      throw new Error('intensity는 0-100 사이여야 합니다');
    }
  },

  // 필터 적용 로직
  apply: (imageData, options) => {
    const { intensity, color } = options;
    const data = imageData.data;

    // 픽셀 처리 로직
    for (let i = 0; i < data.length; i += 4) {
      // 커스텀 효과 적용
      data[i] = Math.min(255, data[i] * (1 + intensity / 100));
    }

    return imageData;
  }
});

// 플러그인 등록
import { registerPlugin } from '@cp949/web-image-util/filters';
registerPlugin(MyCustomFilter);
```

### 파이프라인 확장

```typescript
import { Pipeline, PipelineStep } from '@cp949/web-image-util/advanced';

// 커스텀 파이프라인 단계
const customStep: PipelineStep = {
  name: 'customProcessing',
  process: async (imageData, options) => {
    // 커스텀 처리 로직
    console.log('커스텀 단계 실행 중...');
    return imageData;
  }
};

// 파이프라인에 단계 추가
const pipeline = new Pipeline()
  .addStep('resize')
  .addStep(customStep)
  .addStep('filter')
  .addStep('output');

// 실행
const result = await pipeline.execute(source, options);
```

### 디버깅 및 성능 측정

```typescript
import { enableDebugMode, getPerformanceMetrics } from '@cp949/web-image-util/advanced';

// 디버그 모드 활성화
enableDebugMode(true);

// 성능 측정
const startTime = performance.now();

const result = await processImage(source)
  .resize(800, 600)
  .filter(BlurFilterPlugin, { radius: 2 })
  .toBlob();

const endTime = performance.now();
console.log(`처리 시간: ${endTime - startTime}ms`);

// 상세 성능 메트릭스
const metrics = getPerformanceMetrics();
console.log('성능 정보:', metrics);
```

---

## 📚 추가 리소스

### 관련 문서
- **[← 메인 가이드](./README.md)** - 기본 사용법과 리사이징 가이드
- **[API 레퍼런스](./README-API.md)** - 완전한 API 문서
- **[예제 앱](../../apps/exam/)** - 인터랙티브 데모

### 고급 사용 사례
- **포트폴리오 웹사이트**: 이미지 갤러리 최적화
- **소셜 미디어 앱**: 실시간 필터 및 워터마크
- **전자상거래**: 상품 이미지 배치 처리
- **콘텐츠 관리**: 자동 이미지 최적화 파이프라인

---

<div align="center">

**더 많은 정보가 필요하신가요?**

[🏠 메인 가이드](./README.md) • [📖 API 문서](./README-API.md) • [💡 예제 보기](../../apps/exam/)

</div>