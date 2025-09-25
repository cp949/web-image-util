import { beforeAll, beforeEach } from 'vitest'
import { configureToMatchImageSnapshot } from 'jest-image-snapshot'

// Jest Image Snapshot 설정
const toMatchImageSnapshot = configureToMatchImageSnapshot({
  // 기본 threshold - 픽셀 차이 허용 범위
  threshold: 0.1,

  // 스냅샷 디렉토리 설정
  customSnapshotsDir: './tests/__image_snapshots__',

  // 스냅샷 파일명 형식
  customSnapshotIdentifier: ({ testName, counter }) => {
    return `${testName}-${counter}`
  },

  // 차이점 하이라이트 색상
  customDiffConfig: {
    threshold: 0.1,
    includeAA: false
  },

  // 실패시 diff 이미지 생성
  storeReceivedOnFailure: true,

  // 업데이트 모드 (환경변수로 제어)
  updateSnapshot: process.env.UPDATE_SNAPSHOTS === 'true'
})

// Vitest expect에 이미지 스냅샷 matcher 추가
expect.extend({ toMatchImageSnapshot })

// 타입 정의 확장
declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(options?: any): R
    }
  }
}

// 전역 설정
beforeAll(() => {
  // Canvas API 모킹 (비브라우저 환경용)
  if (typeof window === 'undefined') {
    // Node.js 환경에서는 canvas 모킹
    global.HTMLCanvasElement = class HTMLCanvasElement {
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(),
          putImageData: vi.fn(),
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          // ... 필요한 Canvas 2D API 메서드들
        }
      }
      toDataURL = vi.fn()
      toBlob = vi.fn()
    } as any
  }

  // 테스트용 이미지 로더 함수들 전역 등록
  global.loadTestImage = async (filename: string): Promise<HTMLImageElement> => {
    const img = new Image()
    img.src = `/tests/fixtures/${filename}`

    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = (error) => reject(error)
    })
  }

  // Performance API 모킹 (메모리 테스트용)
  if (typeof performance !== 'undefined' && !(performance as any).memory) {
    ;(performance as any).memory = {
      usedJSHeapSize: Math.random() * 50000000, // 50MB 랜덤값
      totalJSHeapSize: Math.random() * 100000000, // 100MB 랜덤값
      jsHeapSizeLimit: 2147483648 // 2GB
    }
  }
})

beforeEach(() => {
  // 각 테스트 전에 콘솔 경고 초기화
  vi.clearAllMocks()

  // 메모리 사용량 초기 상태 설정 (성능 테스트용)
  if ((performance as any).memory) {
    (performance as any).memory.usedJSHeapSize = Math.random() * 50000000
  }
})

// 테스트 유틸리티 함수들
export const createTestBlob = (type: string = 'image/png'): Blob => {
  // 1x1 투명 PNG의 base64 데이터
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type })
}

export const createTestDataUrl = (): string => {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
}

export const createTestSvg = (width: number = 100, height: number = 100): string => {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ff0000"/>
  </svg>`
}