# resize() 제약사항 사용 가이드

## 📌 핵심 규칙: resize()는 한 번만 호출 가능

`resize()` 메서드는 **한 번만 호출**할 수 있습니다. 이는 이미지 품질, 특히 SVG 품질을 보장하기 위한 설계 결정입니다.

## ✅ 올바른 사용법

### 기본 사용
```typescript
import { processImage } from '@cp949/web-image-util';

// ✅ 올바름: resize() 한 번만 호출
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .blur(2)
  .toBlob();
```

### 다양한 fit 모드
```typescript
// ✅ cover: 비율 유지하며 전체 영역 채움 (기본값)
const cover = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .toBlob();

// ✅ contain: 비율 유지하며 전체 이미지가 영역에 들어가도록
const contain = await processImage(source)
  .resize({
    fit: 'contain',
    width: 300,
    height: 200,
    background: '#ffffff'
  })
  .toBlob();

// ✅ fill: 비율 무시하고 정확히 맞춤
const fill = await processImage(source)
  .resize({ fit: 'fill', width: 300, height: 200 })
  .toBlob();

// ✅ maxFit: 축소만 허용 (확대 안함)
const maxFit = await processImage(source)
  .resize({ fit: 'maxFit', width: 300, height: 200 })
  .toBlob();

// ✅ minFit: 확대만 허용 (축소 안함)
const minFit = await processImage(source)
  .resize({ fit: 'minFit', width: 300, height: 200 })
  .toBlob();
```

### 다른 효과와 함께 사용
```typescript
// ✅ resize() + blur() + 출력 옵션
const advanced = await processImage(source)
  .resize({ fit: 'cover', width: 800, height: 600 })
  .blur(3)
  .toBlob({ format: 'webp', quality: 0.85 });
```

## ❌ 잘못된 사용법

### resize() 중복 호출
```typescript
// ❌ 에러 발생: resize()를 두 번 호출
const processor = processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })
  .resize({ fit: 'contain', width: 400, height: 300 }); // 💥 ImageProcessError

// 에러 메시지:
// "resize()는 한 번만 호출할 수 있습니다.
//  이미지 품질을 위해 모든 크기 조정을 한 번에 처리합니다."
```

## 🔧 사용 가이드

### 올바른 API 사용법

```typescript
// 최종 크기를 직접 지정
const result = await processImage(source)
  .resize({ fit: 'cover', width: 300, height: 200 })  // 한 번에 최종 크기
  .toBlob();
```

### 단계별 리사이징이 필요한 경우
```typescript
// ❌ 이렇게 하지 마세요
// const step1 = await processImage(source).resize({...}).toBlob();
// const step2 = await processImage(step1).resize({...}).toBlob();

// ✅ 이렇게 하세요: 최종 크기를 직접 계산
const finalWidth = 300;
const finalHeight = 200;
const result = await processImage(source)
  .resize({ fit: 'cover', width: finalWidth, height: finalHeight })
  .toBlob();
```

## 🎯 왜 이런 제약이 생겼나요?

### 1. 이미지 품질 향상
- **SVG 품질**: 여러 번 리사이징하면 벡터 그래픽이 래스터화되어 품질 저하
- **중간 Canvas 제거**: 불필요한 Canvas 생성과 픽셀 조작 최소화
- **단일 렌더링**: "계산은 미리, 렌더링은 한 번" 철학 적용

### 2. 성능 최적화
- **메모리 사용량 감소**: 중간 Canvas 객체 생성 최소화
- **처리 속도 향상**: 단일 drawImage 호출로 모든 변형 적용
- **CPU 사용률 감소**: 여러 번의 픽셀 조작 대신 한 번의 최적화된 렌더링

### 3. 일관성 보장
- **예측 가능한 결과**: 항상 동일한 렌더링 파이프라인 사용
- **타입 안전성**: 컴파일 타임에 잘못된 사용법 감지
- **에러 방지**: 의도치 않은 다중 리사이징 방지

## 🚨 에러 해결

### ImageProcessError: MULTIPLE_RESIZE_NOT_ALLOWED
```typescript
// 에러가 발생한 경우
try {
  const result = await processImage(source)
    .resize({ fit: 'cover', width: 300, height: 200 })
    .resize({ fit: 'contain', width: 400, height: 300 }); // 에러!
} catch (error) {
  if (error.code === 'MULTIPLE_RESIZE_NOT_ALLOWED') {
    console.log('해결책: resize()를 한 번만 호출하세요');

    // 올바른 방법
    const fixed = await processImage(source)
      .resize({ fit: 'contain', width: 400, height: 300 }) // 최종 크기 직접 지정
      .toBlob();
  }
}
```

## 📚 실제 사용 예제

### 프로필 이미지 생성
```typescript
// 정사각형 프로필 이미지 (아바타)
const avatar = await processImage(userPhoto)
  .resize({
    fit: 'cover',
    width: 150,
    height: 150,
    position: 'center'
  })
  .toBlob({ format: 'webp', quality: 0.9 });
```

### 썸네일 생성
```typescript
// 16:9 비율 썸네일
const thumbnail = await processImage(originalImage)
  .resize({
    fit: 'cover',
    width: 320,
    height: 180,
    background: '#f0f0f0'
  })
  .toBlob({ format: 'jpeg', quality: 0.8 });
```

### 소셜 미디어 이미지
```typescript
// Instagram 정사각형 포스트
const instagramPost = await processImage(photo)
  .resize({
    fit: 'contain',
    width: 1080,
    height: 1080,
    background: '#ffffff'
  })
  .toBlob({ format: 'jpeg', quality: 0.95 });
```

## 🔍 고급 팁

### 1. 종횡비 계산
```typescript
// 원본 비율 유지하며 최대 크기 제한
const maxWidth = 800;
const maxHeight = 600;

// maxFit 사용으로 확대 방지
const result = await processImage(source)
  .resize({
    fit: 'maxFit',
    width: maxWidth,
    height: maxHeight
  })
  .toBlob();
```

### 2. 배경색 지정
```typescript
// 투명 PNG를 JPEG로 변환 시 배경색 지정
const withBackground = await processImage(pngWithTransparency)
  .resize({
    fit: 'contain',
    width: 400,
    height: 300,
    background: '#ffffff'  // 흰색 배경
  })
  .toBlob({ format: 'jpeg' });
```

### 3. 위치 조정
```typescript
// 중심이 아닌 특정 위치로 크롭
const topCrop = await processImage(source)
  .resize({
    fit: 'cover',
    width: 300,
    height: 200,
    position: 'top'  // 상단 중심으로 크롭
  })
  .toBlob();
```

---

**중요**: 이 제약사항은 이미지 품질 향상을 위한 의도적인 설계 결정입니다. 불편할 수 있지만, 더 나은 결과물을 위한 선택입니다.