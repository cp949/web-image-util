/**
 * 브라우저 환경용 통합 테스트 헬퍼 함수들
 * 실제 브라우저 API 사용 (모킹 없음)
 */

import { processImage, ImageProcessor } from '../../src/index';
import type { ImageSource } from '../../src/types';

// 테스트용 소스 데이터 (실제 유효한 데이터)
export const TEST_SOURCES = {
  // 실제 작은 이미지 Data URL (1x1 픽셀)
  DATA_URL: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',

  // 실제 SVG
  SVG_STRING: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>',

  // 작은 Blob
  BLOB: new Blob([
    // 작은 PNG 이미지 데이터 (1x1 투명 픽셀)
    new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])
  ], { type: 'image/png' }),

  // 테스트용 URL (실제로는 로드되지 않을 것이지만 유효한 형식)
  HTTP_URL: 'http://via.placeholder.com/10x10.jpg',
  HTTPS_URL: 'https://via.placeholder.com/10x10.jpg'
};

// 모든 소스 타입으로 테스트 실행하는 헬퍼
export function testWithAllSourceTypes(
  testFn: (source: ImageSource, sourceName: string) => void
) {
  const sources: Array<[ImageSource, string]> = [
    [TEST_SOURCES.DATA_URL, 'DATA_URL'],
    [TEST_SOURCES.SVG_STRING, 'SVG_STRING'],
    [TEST_SOURCES.BLOB, 'BLOB']
    // HTTP URL은 실제 네트워크 요청이 필요하므로 제외
  ];

  sources.forEach(([source, name]) => testFn(source, name));
}

// 이미지 로딩 대기 (실제 브라우저 환경)
export function waitForImageLoad(timeout = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

// Canvas 처리 대기
export function waitForCanvasProcessing(timeout = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

// 실제 프로세서 생성 (모킹 없음)
export function createMockProcessor(): ImageProcessor {
  // 실제 브라우저 환경에서는 작은 유효한 이미지 사용
  return processImage(TEST_SOURCES.DATA_URL);
}

// 체이닝 메서드 테스트 헬퍼
export function expectChainableMethod(
  processor: ImageProcessor,
  methodName: keyof ImageProcessor,
  ...args: any[]
) {
  const result = (processor[methodName] as Function)(...args);
  expect(result).toBe(processor); // 같은 인스턴스 반환 확인
  return result;
}

// Promise 메서드 테스트 헬퍼
export async function expectPromiseMethod(
  processor: ImageProcessor,
  methodName: keyof ImageProcessor,
  ...args: any[]
): Promise<any> {
  const result = (processor[methodName] as Function)(...args);
  expect(result).toBeInstanceOf(Promise);
  return await result;
}

// TypeScript 타입 테스트 헬퍼 (컴파일 타임 검증용)
export function expectType<T>(value: T): T {
  return value;
}

// 실제 이미지 로딩을 위한 헬퍼
export function createTestImage(src: string = TEST_SOURCES.DATA_URL): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 빈 함수들 (브라우저 환경에서는 필요 없음)
export function setupSuccessfulCanvasMocking() {
  // 브라우저 환경에서는 실제 Canvas API 사용
}

export function setupSuccessfulImageLoading() {
  // 브라우저 환경에서는 실제 Image API 사용
}