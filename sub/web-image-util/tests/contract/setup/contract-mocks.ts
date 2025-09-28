/**
 * 계약 테스트 전용 모킹 설정
 *
 * @description API 계약 테스트를 위한 모킹 설정
 * - WSL 모킹을 기반으로 하되, 계약 테스트에 특화된 설정 추가
 * - API 인터페이스 및 타입 검증에 중점
 */

// WSL 모킹 설정을 재사용
export * from '../../setup/wsl-mocks';

// 계약 테스트 특화 설정
import { vi } from 'vitest';

// 계약 테스트에서 사용할 추가 모킹
console.log('계약 테스트 모킹 설정이 로드되었습니다.');

// 성능 측정을 위한 performance 모킹
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  } as any;
}

// fetch API 모킹 (HTTP URL 테스트용)
if (typeof global.fetch === 'undefined') {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['mock-image-data'], { type: 'image/png' })),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response)
  );
}

// requestAnimationFrame 모킹
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    setTimeout(callback, 16); // 60fps 시뮬레이션
    return 1;
  });
}

if (typeof global.cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = vi.fn();
}

// 계약 테스트 전용 유틸리티
/**
 * API 계약 검증을 위한 모킹 리셋
 */
export function resetContractMocks() {
  vi.clearAllMocks();

  // fetch 모킹 리셋
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    (global.fetch as any).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['mock-image-data'], { type: 'image/png' })),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      })
    );
  }
}

/**
 * 에러 시나리오를 위한 fetch 모킹
 */
export function mockFetchError() {
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    (global.fetch as any).mockImplementation(() => Promise.reject(new Error('Network error')));
  }
}

/**
 * Canvas 에러 시나리오 모킹
 */
export function mockCanvasError() {
  const originalCreateElement = global.document?.createElement;
  if (global.document && originalCreateElement) {
    global.document.createElement = vi.fn((tagName: string) => {
      if (tagName.toLowerCase() === 'canvas') {
        throw new Error('Canvas creation failed');
      }
      return originalCreateElement.call(global.document, tagName);
    });
  }
}
