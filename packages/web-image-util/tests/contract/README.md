# Phase 3: 계약 테스트 (Contract Tests)

Node.js 환경에서 실행되는 브라우저 API 계약 검증 테스트 모음입니다.

## 개요

계약 테스트는 실제 브라우저 API의 기능 구현 대신, **API 호출 패턴과 계약을 검증**하는 테스트입니다. Node.js 환경에서 모킹을 통해 브라우저 API들의 표준 준수성과 호환성을 확인합니다.

## 테스트 범위

### 1. Browser API 계약 테스트 (`browser-api-contracts.test.ts`)
- **Canvas API**: Canvas 생성, Context 획득, 출력 메서드 호출 패턴
- **Image 로딩**: HTMLImageElement 생성, 이벤트 리스너, crossOrigin 설정
- **FileReader API**: 인스턴스 생성, 파일 읽기 메서드, 이벤트 핸들러
- **URL 생명주기**: createObjectURL/revokeObjectURL 호출 패턴
- **Canvas Context 메서드**: drawImage, getImageData, 상태 관리 패턴

### 2. Web Standards 호환성 테스트 (`web-standards-contracts.test.ts`)
- **HTML5 Canvas 표준**: Context 메서드/속성, 기본값, MIME 타입 지원
- **File API 표준**: File/FileReader/Blob 생성자, 상수, 메서드
- **MIME 타입 표준**: 이미지 포맷, 품질 매개변수 범위
- **URL API 표준**: createObjectURL 반환값 형식, 표준 사용 패턴
- **DOM 이벤트 시스템**: addEventListener/removeEventListener 표준

### 3. 메모리 관리 계약 테스트 (`memory-management-contracts.test.ts`)
- **Canvas 메모리 관리**: 생성/정리/풀링 패턴
- **URL 객체 생명주기**: 메모리 할당/해제 추적
- **Blob 메모리 관리**: 크기별 할당, slice 작업 영향
- **리소스 누수 방지**: 이벤트 리스너 정리, 임계점 모니터링
- **메모리 사용량 모니터링**: 전체 추적, 누수 감지

### 4. 크로스 플랫폼 호환성 테스트 (`cross-platform-contracts.test.ts`)
- **브라우저별 구현**: Chrome, Firefox, Safari, Edge 차이점
- **ImageSmoothing 속성**: 브라우저별 접두사 (webkit-, moz-, ms-)
- **포맷 지원 차이**: WebP, AVIF 지원 여부
- **User Agent 감지**: 브라우저 식별 패턴
- **Fallback 처리**: 미지원 기능에 대한 대체 처리

### 5. 성능 계약 테스트 (`performance-contracts.test.ts`)
- **처리 시간 임계값**: Canvas 생성, Context 획득, 이미지 처리 시간
- **메모리 사용량 제한**: Canvas 크기별, 동시 객체 개수 제한
- **처리량 보장**: 초당 최소 작업 수, 메모리 증가율 제한
- **성능 회귀 감지**: 연속 작업 성능 저하, 메모리 누수 감지
- **부하 테스트**: 고부하 안정성, 리소스 제한 시 우아한 실패

## 실행 방법

```bash
# 계약 테스트만 실행
pnpm test:contract

# 커버리지 포함 실행
pnpm test:coverage:contract

# 일반 Node.js 테스트에 포함해서 실행 (기본)
pnpm test:node
```

## 설정 파일

### `vitest.contract.config.ts`
계약 테스트 전용 Vitest 설정:
- Node.js 환경에서 실행
- `tests/contract/**/*.test.ts` 파일들만 포함
- 브라우저 API 모킹 설정 로드
- JSON 리포터로 결과 출력

### `tests/contract/setup/contract-mocks.ts`
공통 브라우저 API 모킹 설정:
- HTMLCanvasElement, HTMLImageElement 모킹
- File, FileReader, Blob API 모킹
- URL, navigator, performance 객체 모킹
- 일관된 모킹 환경 제공

## 테스트 철학

### 실제 기능 vs 계약 검증
- ❌ 실제 이미지 처리나 Canvas 렌더링 테스트
- ✅ API 호출 패턴과 매개변수 검증
- ✅ 브라우저 표준 준수성 확인
- ✅ 호환성 패턴 검증

### Node.js 환경 제약
- 실제 DOM이나 Canvas API 없음
- 모킹을 통한 API 계약 검증
- 메서드 호출 패턴 추적
- 반환값 형식 검증

## 성공 기준

### 전체 테스트: **106개**
- Browser API 계약: 17개
- Web Standards: 12개
- 메모리 관리: 18개
- 크로스 플랫폼: 35개
- 성능 계약: 24개

### 성능 임계값
- Canvas 생성: 10ms 이내
- Context 획득: 5ms 이내
- 작은 이미지 처리: 50ms 이내
- 메모리 사용량: 각 크기별 제한 준수

## CI/CD 통합

GitHub Actions에서 자동 실행:
```yaml
- name: Run Contract Tests
  run: pnpm test:contract
```

계약 테스트는 Node.js 환경에서 빠르게 실행되므로 CI 파이프라인의 초기 단계에서 실행하여 기본적인 API 계약 위반을 빠르게 감지할 수 있습니다.

## 확장 가이드

새로운 계약 테스트 추가 시:
1. 해당 카테고리의 테스트 파일에 추가
2. 필요한 API 모킹을 `setup/contract-mocks.ts`에 추가
3. 실제 기능이 아닌 **호출 패턴**에 집중
4. 브라우저 표준 문서 참조하여 정확한 계약 정의

이 계약 테스트 시스템을 통해 web-image-util 라이브러리가 다양한 브라우저 환경에서 예상대로 동작할 수 있도록 API 계약을 보장합니다.