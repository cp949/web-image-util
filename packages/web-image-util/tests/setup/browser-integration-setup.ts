/**
 * 브라우저 환경용 통합 테스트 셋업
 * Playwright 브라우저 모드에서 실행되므로 실제 브라우저 API 사용
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// 브라우저 환경에서는 실제 API를 사용하므로 모킹이 필요하지 않음
// Canvas, Image, FileReader 등의 네이티브 API가 직접 사용 가능

beforeAll(() => {
  // 브라우저 환경 초기화
  console.log('브라우저 통합 테스트 환경 초기화');
});

afterAll(() => {
  // 정리 작업
  console.log('브라우저 통합 테스트 환경 정리');
});

beforeEach(() => {
  // 각 테스트 전 초기화
  // 메모리 정리를 위한 가비지 컬렉션 힌트
  if (globalThis.gc) {
    globalThis.gc();
  }
});

afterEach(() => {
  // 각 테스트 후 정리
  // DOM 정리 (필요시)
});