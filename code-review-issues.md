# SVG Compatibility Code Review Issues

## 🚨 발견된 문제점들

### 1. **Line 425 - polyline/polygon 파싱 버그**
```typescript
pts.split(/[\s]+/).forEach((token) => {
  const pair = token.split(/[,\s]+/).filter(Boolean);
  if (pair.length === 2) {
    // ... 처리
  }
});
```
**문제**: points="10,20 30,40 50,60"에서 첫 번째 split 후 각 토큰이 이미 x,y 쌍인데, 다시 split하면 잘못 파싱됨.

**해결방법**: points 문자열을 한 번에 숫자 배열로 파싱해야 함.

### 2. **Line 330-359 - liveGetBBox 메모리 누수 위험**
```typescript
document.body.appendChild(tmpSvg);
// ...
document.body.removeChild(tmpSvg);
```
**문제**: 예외 발생 시 tmpSvg가 DOM에서 제거되지 않을 가능성.

**해결방법**: try-finally를 사용하거나 더 안전한 정리 로직 필요.

### 3. **Line 97 - DOMParser 타입 검사 불완전**
```typescript
if (typeof DOMParser === 'undefined') {
```
**문제**: DOMParser 생성자는 존재하지만 image/svg+xml을 지원하지 않는 환경도 있음.

### 4. **Line 201 - 단위 정규화 누락**
```typescript
const unit = (m[2] || 'px').toLowerCase();
```
**문제**: 빈 문자열일 때 'px'로 기본값을 주는데, SVG에서는 단위 없는 숫자가 user unit임.

### 5. **Line 348 - getBBox 전에 렌더링 보장 부족**
```typescript
if (!imported.hasAttribute('viewBox')) imported.setAttribute('viewBox', '0 0 100000 100000');
```
**문제**: DOM 추가 직후 getBBox 호출하면 레이아웃이 완료되지 않았을 수 있음.

## ✅ 잘 구현된 부분들

1. **성능 최적화**: innerHTML.includes 제거하고 querySelectorAll 사용
2. **환경 대응**: performance.now() 폴백 처리
3. **기존 속성 보존**: 덮어쓰지 않는 정책
4. **반응형 기본값**: preferResponsive: true
5. **프레이밍 보존**: preserve-framing 모드 기본값
6. **타입 안전성**: 상세한 타입 정의
7. **에러 처리**: 실패 시 원본 반환하는 안전한 정책