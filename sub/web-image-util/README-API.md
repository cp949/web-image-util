# API 레퍼런스

> @cp949/web-image-util 완전한 API 문서 - 모든 함수, 타입, 인터페이스

[![← 메인 가이드로 돌아가기](https://img.shields.io/badge/←-메인%20가이드-blue?style=for-the-badge)](./README.md)

## 📖 목차

- [🔗 메인 API](#-메인-api)
- [📦 서브 패키지별 API](#-서브-패키지별-api)
- [🏷️ TypeScript 타입](#-typescript-타입)
- [🚨 에러 처리](#-에러-처리)

---

## 🔗 메인 API

### processImage()

메인 진입점 함수로, 이미지 처리 체이닝을 시작합니다.

```typescript
function processImage(source: ImageSource): ImageProcessor
```

**매개변수:**
- `source: ImageSource` - 처리할 이미지 소스

**반환값:**
- `ImageProcessor` - 체이닝 가능한 이미지 프로세서 인스턴스

**사용 예제:**
```typescript
import { processImage } from '@cp949/web-image-util';

const processor = processImage(imageFile);
const result = await processor.resize(300, 200).toBlob();
```

---

### ImageProcessor 클래스

체이닝 가능한 이미지 처리 클래스입니다.

#### resize()

이미지 크기를 조정합니다.

```typescript
resize(width: number | null, height: number | null, options?: ResizeOptions): ImageProcessor
```

**매개변수:**
- `width: number | null` - 목표 너비 (null이면 비율에 따라 자동 계산)
- `height: number | null` - 목표 높이 (null이면 비율에 따라 자동 계산)
- `options?: ResizeOptions` - 리사이징 옵션

**ResizeOptions:**
```typescript
interface ResizeOptions {
  fit?: ResizeFit;                    // 맞춤 모드
  position?: ResizePosition;          // 위치 (fit이 'cover'일 때)
  background?: string;                // 배경색 (fit이 'contain'일 때)
  withoutEnlargement?: boolean;       // 확대 방지
  withoutReduction?: boolean;         // 축소 방지
  interpolation?: InterpolationMethod; // 보간법
}
```

#### blur()

블러 효과를 적용합니다.

```typescript
blur(radius: number): ImageProcessor
```

**매개변수:**
- `radius: number` - 블러 반지름 (1-10)

#### filter()

커스텀 필터를 적용합니다.

```typescript
filter<T>(plugin: FilterPlugin<T>, options?: T): ImageProcessor
```

**매개변수:**
- `plugin: FilterPlugin<T>` - 필터 플러그인
- `options?: T` - 필터별 옵션

#### 출력 메서드들

##### toBlob()

Blob 형태로 결과를 반환합니다.

```typescript
async toBlob(options?: BlobOptions): Promise<BlobResult>
```

**BlobOptions:**
```typescript
interface BlobOptions {
  format?: ImageFormat;  // 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number;      // 0-1 사이의 품질값
  progressive?: boolean; // 프로그레시브 JPEG
}
```

**BlobResult:**
```typescript
interface BlobResult {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;          // 파일 크기 (bytes)
  processingTime: number; // 처리 시간 (ms)
}
```

##### toDataURL()

Data URL 형태로 결과를 반환합니다.

```typescript
async toDataURL(options?: BlobOptions): Promise<DataURLResult>
```

**DataURLResult:**
```typescript
interface DataURLResult {
  dataURL: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  processingTime: number;
}
```

##### toFile()

File 객체로 결과를 반환합니다.

```typescript
async toFile(filename: string, options?: BlobOptions): Promise<FileResult>
```

**FileResult:**
```typescript
interface FileResult {
  file: File;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  processingTime: number;
}
```

##### toCanvas()

Canvas 엘리먼트로 결과를 반환합니다.

```typescript
async toCanvas(): Promise<HTMLCanvasElement>
```

---

## 📦 서브 패키지별 API

### /presets

편의 함수들을 제공하는 서브패키지입니다.

#### createThumbnail()

웹 최적화 썸네일을 생성합니다.

```typescript
async function createThumbnail(
  source: ImageSource,
  options: ThumbnailOptions
): Promise<BlobResult>
```

**ThumbnailOptions:**
```typescript
interface ThumbnailOptions {
  size: number;                    // 정사각형 크기
  format?: 'webp' | 'jpeg' | 'png'; // 기본: 'webp'
  quality?: number;                // 기본: 0.8
  fit?: ResizeFit;                 // 기본: 'cover'
  background?: string;             // 기본: '#ffffff'
}
```

#### createAvatar()

프로필 아바타를 생성합니다.

```typescript
async function createAvatar(
  source: ImageSource,
  options: AvatarOptions
): Promise<BlobResult>
```

**AvatarOptions:**
```typescript
interface AvatarOptions {
  size: number;           // 정사각형 크기
  format?: 'png' | 'webp'; // 기본: 'png'
  quality?: number;       // 기본: 0.9
  background?: string;    // 기본: 'transparent'
}
```

#### createSocialImage()

소셜 미디어용 이미지를 생성합니다.

```typescript
async function createSocialImage(
  source: ImageSource,
  options: SocialImageOptions
): Promise<BlobResult>
```

**SocialImageOptions:**
```typescript
interface SocialImageOptions {
  platform: SocialPlatform;
  format?: 'jpeg' | 'png';  // 기본: 'jpeg'
  quality?: number;         // 기본: 0.85
  background?: string;      // 기본: '#ffffff'
}

type SocialPlatform =
  | 'twitter' | 'facebook' | 'instagram'
  | 'linkedin' | 'youtube' | 'pinterest';
```

### /advanced

고급 기능들을 제공하는 서브패키지입니다.

#### AdvancedImageProcessor

고급 이미지 처리 클래스입니다.

```typescript
class AdvancedImageProcessor {
  static async processImage(
    source: ImageSource,
    config: AdvancedConfig
  ): Promise<BlobResult>

  static async processLargeImage(
    source: ImageSource,
    config: LargeImageConfig
  ): Promise<BlobResult>
}
```

#### batchOptimize()

여러 이미지를 배치로 최적화합니다.

```typescript
async function batchOptimize(
  sources: ImageSource[],
  options: BatchOptions
): Promise<BatchResult[]>
```

#### TextWatermark

텍스트 워터마크 클래스입니다.

```typescript
class TextWatermark {
  static addToCanvas(
    canvas: HTMLCanvasElement,
    options: TextWatermarkOptions
  ): HTMLCanvasElement

  static addMultipleToCanvas(
    canvas: HTMLCanvasElement,
    watermarks: TextWatermarkOptions[]
  ): HTMLCanvasElement

  static addRepeatingPattern(
    canvas: HTMLCanvasElement,
    options: TextWatermarkOptions & RepeatingOptions
  ): HTMLCanvasElement
}
```

#### ImageWatermark

이미지 워터마크 클래스입니다.

```typescript
class ImageWatermark {
  static addToCanvas(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions
  ): HTMLCanvasElement

  static addWithAdaptiveSize(
    canvas: HTMLCanvasElement,
    options: ImageWatermarkOptions & AdaptiveSizeOptions
  ): HTMLCanvasElement
}
```

#### ImageComposer

이미지 합성 클래스입니다.

```typescript
class ImageComposer {
  static async composeLayers(
    layers: Layer[],
    options: CompositionOptions
  ): Promise<HTMLCanvasElement>

  static async composeGrid(
    images: HTMLImageElement[],
    options: GridLayoutOptions
  ): Promise<HTMLCanvasElement>

  static async composeCollage(
    images: HTMLImageElement[],
    canvasSize: Size,
    options?: CollageOptions
  ): Promise<HTMLCanvasElement>
}
```

### /utils

유틸리티 함수들을 제공하는 서브패키지입니다.

#### 변환 함수들

```typescript
// Blob ↔ DataURL 변환
async function blobToDataURL(blob: Blob): Promise<string>
async function dataURLToBlob(dataURL: string): Promise<Blob>

// 이미지 엘리먼트 로딩
async function loadImageElement(source: ImageSource): Promise<HTMLImageElement>

// 포맷 감지
function detectImageFormat(source: ImageSource): Promise<ImageFormat>

// SVG 호환성 개선
function enhanceBrowserCompatibility(
  svgString: string,
  options?: SVGCompatibilityOptions
): SVGCompatibilityResult
```

### /filters

필터 플러그인들을 제공하는 서브패키지입니다.

#### 색상 필터

```typescript
// 밝기 조정 (-100 ~ +100)
const BrightnessFilterPlugin: FilterPlugin<{ value: number }>

// 대비 조정 (-100 ~ +100)
const ContrastFilterPlugin: FilterPlugin<{ value: number }>

// 채도 조정 (-100 ~ +100)
const SaturationFilterPlugin: FilterPlugin<{ value: number }>
```

#### 효과 필터

```typescript
// 블러 효과 (반지름 1-10)
const BlurFilterPlugin: FilterPlugin<{ radius: number }>

// 선명하게 만들기
const SharpenFilterPlugin: FilterPlugin<{ strength: number }>

// 흑백 변환
const GrayscaleFilterPlugin: FilterPlugin<{}>

// 세피아 톤
const SepiaFilterPlugin: FilterPlugin<{ intensity: number }>

// 엠보스 효과
const EmbossFilterPlugin: FilterPlugin<{ strength: number }>

// 가장자리 검출
const EdgeDetectionFilterPlugin: FilterPlugin<{ threshold: number }>
```

#### 플러그인 개발

```typescript
interface FilterPlugin<T = {}> {
  name: string;
  version?: string;
  description?: string;
  apply: (imageData: ImageData, options: T) => ImageData;
  validateOptions?: (options: T) => void;
}

// 플러그인 생성 헬퍼
function createFilterPlugin<T>(config: FilterPluginConfig<T>): FilterPlugin<T>

// 플러그인 등록
function registerPlugin<T>(plugin: FilterPlugin<T>): void
```

---

## 🏷️ TypeScript 타입

### 기본 타입들

#### ImageSource

```typescript
type ImageSource =
  | HTMLImageElement
  | Blob
  | File
  | ArrayBuffer
  | Uint8Array
  | string; // URL, Data URL, SVG XML, 파일 경로
```

#### ImageFormat

```typescript
type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif';
```

#### ResizeFit

```typescript
type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
```

#### ResizePosition

```typescript
type ResizePosition =
  | 'center' | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
```

#### InterpolationMethod

```typescript
type InterpolationMethod = 'fast' | 'good' | 'best' | 'lanczos';
```

### 고급 타입들

#### Position

```typescript
type Position =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'
  | 'custom';
```

#### Point

```typescript
interface Point {
  x: number;
  y: number;
}
```

#### Size

```typescript
interface Size {
  width: number;
  height: number;
}
```

#### Rectangle

```typescript
interface Rectangle extends Point, Size {}
```

### 옵션 타입들

#### TextStyle

```typescript
interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  fontStyle?: 'normal' | 'italic' | 'oblique';
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shadow?: {
    color: string;
    offsetX: number;
    offsetY: number;
    blur: number;
  };
  opacity?: number; // 0-1
}
```

#### TextWatermarkOptions

```typescript
interface TextWatermarkOptions {
  text: string;
  position: Position;
  customPosition?: Point;
  style: TextStyle;
  rotation?: number; // degrees
  margin?: Point;
}
```

#### ImageWatermarkOptions

```typescript
interface ImageWatermarkOptions {
  watermarkImage: HTMLImageElement;
  position: Position;
  customPosition?: Point;
  scale?: number; // 0-1
  opacity?: number; // 0-1
  rotation?: number; // degrees
  margin?: Point;
  blendMode?: GlobalCompositeOperation;
}
```

#### Layer

```typescript
interface Layer {
  image: HTMLImageElement;
  x: number;
  y: number;
  width?: number;
  height?: number;
  opacity?: number;
  blendMode?: GlobalCompositeOperation;
  rotation?: number;
  visible?: boolean;
}
```

### 결과 타입들

#### ProcessingResult

```typescript
interface ProcessingResult {
  width: number;
  height: number;
  format: ImageFormat;
  size: number;          // bytes
  processingTime: number; // ms
}
```

#### BlobResult

```typescript
interface BlobResult extends ProcessingResult {
  blob: Blob;
}
```

#### DataURLResult

```typescript
interface DataURLResult extends ProcessingResult {
  dataURL: string;
}
```

#### FileResult

```typescript
interface FileResult extends ProcessingResult {
  file: File;
}
```

#### BatchResult

```typescript
interface BatchResult {
  success: boolean;
  index: number;
  blob?: Blob;
  error?: Error;
  processingTime: number;
}
```

### 기능 감지 타입

#### Features

```typescript
interface Features {
  webp: boolean;
  avif: boolean;
  canvas: boolean;
  offscreenCanvas: boolean;
  imageBitmap: boolean;
}
```

---

## 🚨 에러 처리

### ImageProcessError

모든 이미지 처리 관련 에러의 기본 클래스입니다.

```typescript
class ImageProcessError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any)
}
```

### 에러 코드들

```typescript
// 입력 관련 에러
'INVALID_INPUT'           // 잘못된 입력 소스
'UNSUPPORTED_FORMAT'      // 지원하지 않는 포맷
'LOAD_FAILED'            // 이미지 로드 실패

// 처리 관련 에러
'CANVAS_CREATION_FAILED'  // Canvas 생성 실패
'PROCESSING_FAILED'       // 처리 과정 실패
'MEMORY_LIMIT_EXCEEDED'   // 메모리 제한 초과

// 출력 관련 에러
'OUTPUT_FAILED'          // 출력 변환 실패
'UNSUPPORTED_OUTPUT'     // 지원하지 않는 출력 형식
```

### 에러 처리 예제

```typescript
import { processImage, ImageProcessError } from '@cp949/web-image-util';

try {
  const result = await processImage(source)
    .resize(300, 200)
    .toBlob();

  console.log('처리 완료:', result);
} catch (error) {
  if (error instanceof ImageProcessError) {
    switch (error.code) {
      case 'INVALID_INPUT':
        console.error('잘못된 이미지 파일입니다:', error.message);
        break;
      case 'MEMORY_LIMIT_EXCEEDED':
        console.error('이미지가 너무 큽니다:', error.message);
        break;
      case 'PROCESSING_FAILED':
        console.error('처리 중 오류가 발생했습니다:', error.message);
        break;
      default:
        console.error('알 수 없는 오류:', error.message);
    }

    // 상세 정보가 있다면 출력
    if (error.details) {
      console.log('상세 정보:', error.details);
    }
  } else {
    console.error('예상치 못한 오류:', error);
  }
}
```

### 브라우저 호환성 확인

```typescript
import { features } from '@cp949/web-image-util';

// 기능 지원 여부 확인
if (!features.canvas) {
  console.error('Canvas API를 지원하지 않는 브라우저입니다');
  return;
}

if (!features.webp) {
  console.warn('WebP를 지원하지 않아 JPEG로 대체됩니다');
}

// 조건부 기능 사용
const format = features.webp ? 'webp' : 'jpeg';
const result = await processImage(source)
  .resize(300, 200)
  .toBlob({ format });
```

---

## 📚 추가 정보

### 버전 정보

```typescript
import { version } from '@cp949/web-image-util';
console.log('라이브러리 버전:', version);
```

### 기본 설정

```typescript
import { defaults } from '@cp949/web-image-util';

// 기본 설정 확인
console.log('기본 품질:', defaults.quality);      // 0.8
console.log('기본 포맷:', defaults.format);       // 'webp'
console.log('기본 fit 모드:', defaults.fit);      // 'cover'
```

### 성능 최적화 팁

```typescript
// Canvas 풀 크기 조정 (메모리 사용량 vs 성능)
import { CanvasPool } from '@cp949/web-image-util/advanced';

CanvasPool.configure({
  maxSize: 5,  // 동시 처리량에 따라 조정
  maxCanvasSize: { width: 2048, height: 2048 }  // 최대 이미지 크기에 따라 조정
});
```

---

<div align="center">

**더 많은 정보가 필요하신가요?**

[🏠 메인 가이드](./README.md) • [🚀 고급 기능](./README-ADVANCED.md) • [💡 예제 보기](../../apps/exam/)

</div>