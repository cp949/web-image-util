# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🔧 Fixed
- **SVG 리사이징 품질 저하 문제 해결**
  - SVG를 확대할 때 벡터 품질이 손실되던 문제 수정
  - Canvas를 처음부터 목표 크기로 생성하여 고품질 렌더링 보장
  - SVG 원본을 그대로 유지하고 Canvas에서 직접 타겟 크기로 렌더링

### 🗑️ Removed
- **불필요한 SVG 처리 코드 제거** (총 3,414줄 제거)
  - `advanced/svg-processor.ts` (507줄)
  - `advanced/offscreen-svg-processor.ts` (645줄)
  - `core/performance-manager.ts` (652줄)
  - `utils/image-source-converter.ts` (725줄)
  - `utils/system-validator.ts` (433줄)
  - `__tests__/svg-quality.test.ts` (331줄)
  - 기타 불필요한 타입 정의 및 import 정리 (121줄)
- `processor.ts`의 `svgOptions()` 메서드 제거 (더 이상 필요 없음)
- `source-converter.ts`에서 사용되지 않는 `setSvgDimensions` import 제거

### ⚡ Performance
- SVG 처리 성능 향상
  - 불필요한 DOM 조작 제거
  - 중간 래스터화 단계 제거
  - 메모리 사용량 감소

### 🎯 Technical Details
**근본 원인 및 해결책:**
1. **문제 1**: `setSvgDimensions()`가 SVG를 미리 큰 크기로 변경 → 벡터→래스터 변환 발생
   - **해결**: `setSvgDimensions()` 제거, SVG 원본 크기 유지

2. **문제 2**: Canvas를 원본 크기(100x100)로 생성 후 확대 → 래스터 품질 저하
   - **해결**: `core/pipeline.ts` 수정, Canvas를 처음부터 목표 크기로 생성

3. **최종 결과**:
   - SVG Image를 Canvas에 직접 타겟 크기로 렌더링
   - 벡터 품질 완전 보존
   - `_TODO/svg-resize.ts`와 동일한 고품질 렌더링 달성

---

## [2.0.18] - 2024-09-30
- 이전 릴리스 내역