/**
 * OffscreenCanvas + Web Worker 기반 고성능 SVG 처리기
 *
 * @description Phase 3 Step 2: OffscreenCanvas 지원 구현
 * 브라우저 호환성 체크 → Worker 기반 처리 → 안전한 폴백 시스템
 */

import { BrowserCapabilityDetector } from '../utils/browser-capabilities';
import { SVGProcessor } from '../advanced/svg-processor';
import type { SvgProcessingOptions, SvgProcessingResult } from '../advanced/svg-processor';

// ============================================================================
// TYPES - Worker 메시지 및 응답 타입들
// ============================================================================

/** Worker로 전송할 메시지 타입 */
interface WorkerMessage {
  /** SVG XML 문자열 */
  svgString: string;
  /** 처리 옵션 */
  options: SvgProcessingOptions;
  /** 요청 ID (여러 요청 구분용) */
  requestId: string;
}

/** Worker에서 받을 응답 타입 */
interface WorkerResponse {
  /** 요청 ID */
  requestId: string;
  /** 성공 시 처리 결과 */
  result?: SvgProcessingResult;
  /** 실패 시 에러 메시지 */
  error?: string;
  /** 에러 코드 */
  errorCode?: 'TIMEOUT' | 'PROCESSING_ERROR' | 'CAPABILITY_ERROR';
}

/** Worker 상태 */
type WorkerState = 'idle' | 'processing' | 'terminated';

// ============================================================================
// WORKER SCRIPT - OffscreenCanvas SVG 처리 Worker 스크립트
// ============================================================================

/**
 * Web Worker 내부에서 실행될 OffscreenCanvas SVG 처리 로직
 * Worker 스크립트를 문자열로 생성하여 Blob URL로 동적 로드
 */
const OFFSCREEN_SVG_WORKER_SCRIPT = `
// Worker 내부: OffscreenCanvas를 사용한 고성능 SVG 렌더링

/**
 * Worker에서 메시지 수신 처리
 */
self.addEventListener('message', async (event) => {
  const { svgString, options, requestId } = event.data;

  try {
    // OffscreenCanvas 호환성 재확인
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      throw new Error('OffscreenCanvas 또는 ImageBitmap이 지원되지 않습니다');
    }

    const result = await processOffscreenSvg(svgString, options);

    // 성공 응답
    self.postMessage({
      requestId,
      result
    });

  } catch (error) {
    // 실패 응답
    self.postMessage({
      requestId,
      error: error.message || '알 수 없는 오류',
      errorCode: 'PROCESSING_ERROR'
    });
  }
});

/**
 * OffscreenCanvas를 사용한 SVG 처리 메인 함수
 */
async function processOffscreenSvg(svgString, options) {
  const startTime = performance.now();

  // 1. 품질 레벨 결정
  const actualQuality = determineActualQuality(svgString, options.quality);
  const scaleFactor = getScaleFactor(actualQuality);

  // 2. 렌더링 크기 계산
  const renderWidth = options.targetWidth * scaleFactor;
  const renderHeight = options.targetHeight * scaleFactor;

  // 3. OffscreenCanvas 생성 (고해상도)
  const offscreenCanvas = new OffscreenCanvas(renderWidth, renderHeight);
  const context = offscreenCanvas.getContext('2d');

  if (!context) {
    throw new Error('OffscreenCanvas 2D context 생성 실패');
  }

  // 4. 고품질 렌더링 설정
  setupHighQualityOffscreenContext(context, scaleFactor);

  // 5. 배경색 설정 (투명도 처리)
  if (options.backgroundColor && !options.preserveTransparency) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, renderWidth, renderHeight);
  }

  // 6. SVG를 ImageBitmap으로 변환하여 렌더링
  const imageBitmap = await createImageBitmapFromSvg(svgString, renderWidth, renderHeight);

  // 7. 다운샘플링을 통한 고품질 렌더링
  context.scale(1/scaleFactor, 1/scaleFactor);
  context.drawImage(imageBitmap, 0, 0, renderWidth, renderHeight);

  // 8. 최종 Canvas 크기 조정
  const finalCanvas = new OffscreenCanvas(options.targetWidth, options.targetHeight);
  const finalContext = finalCanvas.getContext('2d');

  if (!finalContext) {
    throw new Error('최종 OffscreenCanvas context 생성 실패');
  }

  setupHighQualityOffscreenContext(finalContext, 1);
  finalContext.drawImage(offscreenCanvas, 0, 0, options.targetWidth, options.targetHeight);

  // 9. Blob 생성
  const blob = await finalCanvas.convertToBlob({
    type: getMimeType(options.format),
    quality: options.format === 'jpeg' ? options.jpegQuality : undefined
  });

  // 10. 성능 메트릭 수집
  const processingTime = performance.now() - startTime;
  const memorySize = estimateMemoryUsage(renderWidth, renderHeight);

  return {
    blob,
    actualQuality,
    processingTimeMs: processingTime,
    memorySizeMB: memorySize,
    scaleFactor
  };
}

/**
 * SVG를 ImageBitmap으로 변환
 */
async function createImageBitmapFromSvg(svgString, width, height) {
  // SVG 크기 설정
  const enhancedSvg = setSvgDimensions(svgString, width, height);

  // Blob 생성
  const blob = new Blob([enhancedSvg], { type: 'image/svg+xml;charset=utf-8' });

  // ImageBitmap 생성 (고품질 옵션)
  return createImageBitmap(blob, {
    premultiplyAlpha: 'default',
    colorSpaceConversion: 'default',
    resizeQuality: 'high'
  });
}

/**
 * OffscreenCanvas 2D Context 고품질 설정
 */
function setupHighQualityOffscreenContext(context, scaleFactor) {
  // 고품질 이미지 스무딩 설정
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // 텍스트 렌더링 품질 설정
  context.textBaseline = 'top';
  context.textAlign = 'start';

  // 스케일링 적용
  if (scaleFactor > 1) {
    context.scale(scaleFactor, scaleFactor);
  }
}

/**
 * SVG에 크기 정보 설정 (단순 버전)
 */
function setSvgDimensions(svgString, width, height) {
  // 기본적인 viewBox 및 크기 설정
  if (!svgString.includes('<svg')) {
    return \`<svg xmlns="http://www.w3.org/2000/svg" width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">\${svgString}</svg>\`;
  }

  // 기존 SVG 태그에 크기 정보 추가/수정
  return svgString.replace(
    /<svg([^>]*)>/,
    \`<svg$1 width="\${width}" height="\${height}" viewBox="0 0 \${width} \${height}">\`
  );
}

/**
 * 품질 레벨 결정 (단순 버전)
 */
function determineActualQuality(svgString, requestedQuality) {
  if (requestedQuality !== 'auto') {
    return requestedQuality;
  }

  // 복잡도 기반 자동 결정 (단순 휴리스틱)
  const elementCount = (svgString.match(/<[^/][^>]*>/g) || []).length;
  const hasGradients = svgString.includes('gradient');
  const hasFilters = svgString.includes('filter');

  if (hasFilters || elementCount > 100) {
    return 'ultra';
  } else if (hasGradients || elementCount > 50) {
    return 'high';
  } else if (elementCount > 20) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * 품질별 스케일링 팩터
 */
function getScaleFactor(quality) {
  const scaleMap = {
    low: 1,
    medium: 2,
    high: 3,
    ultra: 4
  };
  return scaleMap[quality] || 2;
}

/**
 * 포맷을 MIME 타입으로 변환
 */
function getMimeType(format) {
  switch (format) {
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

/**
 * 메모리 사용량 추정
 */
function estimateMemoryUsage(width, height) {
  const pixelCount = width * height;
  const bytesPerPixel = 4;
  const totalBytes = pixelCount * bytesPerPixel;
  const overheadFactor = 1.5;

  return (totalBytes * overheadFactor) / (1024 * 1024);
}
`;

// ============================================================================
// OFFSCREEN SVG PROCESSOR CLASS - 메인 클래스
// ============================================================================

/**
 * OffscreenCanvas + Web Worker 기반 고성능 SVG 처리기
 *
 * @description 브라우저 호환성을 체크하고 OffscreenCanvas를 지원하는 경우
 * Web Worker에서 고성능 SVG 처리를 수행. 미지원시 기존 SVGProcessor로 폴백
 */
export class OffscreenSVGProcessor {
  /** 브라우저 기능 감지기 인스턴스 */
  private static detector = BrowserCapabilityDetector.getInstance();

  /** Worker 풀 (재사용을 위한 캐시) */
  private static workerPool: Map<string, { worker: Worker; state: WorkerState; lastUsed: number }> = new Map();

  /** 최대 Worker 수 */
  private static readonly MAX_WORKERS = 2;

  /** Worker 타임아웃 (30초) */
  private static readonly WORKER_TIMEOUT_MS = 30000;

  /** Worker 재사용 타임아웃 (5분) */
  private static readonly WORKER_REUSE_TIMEOUT_MS = 5 * 60 * 1000;

  /**
   * OffscreenCanvas를 사용한 고성능 SVG 처리
   * 호환성 체크 후 Worker 기반 처리 또는 폴백
   *
   * @param svgString SVG XML 문자열
   * @param options 처리 옵션
   * @returns 처리 결과 (이미지 Blob 포함)
   */
  static async processWithOffscreenCanvas(
    svgString: string,
    options: SvgProcessingOptions
  ): Promise<SvgProcessingResult> {
    try {
      // 1. 브라우저 호환성 체크
      const capabilities = await this.detector.detectCapabilities({ timeout: 1000 });

      if (!this.isOffscreenCapable(capabilities)) {
        // 호환성 부족 시 기존 프로세서로 폴백
        return this.fallbackToStandardProcessor(svgString, options);
      }

      // 2. Worker 기반 고성능 처리 시도
      return await this.processWithWorker(svgString, options);

    } catch (error) {
      // 3. 에러 발생 시 안전한 폴백
      console.warn('[OffscreenSVGProcessor] Worker 처리 실패, 표준 프로세서로 폴백:', error);
      return this.fallbackToStandardProcessor(svgString, options);
    }
  }

  /**
   * OffscreenCanvas 사용 가능 여부 체크
   *
   * @param capabilities 브라우저 기능 감지 결과
   * @returns OffscreenCanvas 사용 가능 여부
   */
  private static isOffscreenCapable(capabilities: any): boolean {
    return capabilities.offscreenCanvas &&
           capabilities.webWorkers &&
           capabilities.imageBitmap &&
           capabilities.transferableObjects;
  }

  /**
   * Web Worker를 사용한 OffscreenCanvas 처리
   */
  private static async processWithWorker(
    svgString: string,
    options: SvgProcessingOptions
  ): Promise<SvgProcessingResult> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let worker: Worker | null = null;

    try {
      // 1. Worker 가져오기 또는 생성
      worker = await this.getOrCreateWorker();

      // 2. Worker 상태 업데이트
      this.updateWorkerState(worker, 'processing');

      // 3. Worker로 작업 전송 및 응답 대기
      const result = await this.executeWorkerTask(worker, {
        svgString,
        options,
        requestId
      });

      // 4. Worker 상태 초기화
      this.updateWorkerState(worker, 'idle');

      return result;

    } catch (error) {
      // Worker 에러 시 정리
      if (worker) {
        this.terminateWorker(worker);
      }
      throw error;
    }
  }

  /**
   * Worker 가져오기 또는 새로 생성
   */
  private static async getOrCreateWorker(): Promise<Worker> {
    // 기존 idle Worker 찾기
    for (const [workerId, workerInfo] of this.workerPool) {
      if (workerInfo.state === 'idle') {
        workerInfo.lastUsed = Date.now();
        return workerInfo.worker;
      }
    }

    // 풀 크기 제한 체크
    if (this.workerPool.size >= this.MAX_WORKERS) {
      // 가장 오래된 Worker 정리
      this.cleanupOldestWorker();
    }

    // 새 Worker 생성
    return this.createNewWorker();
  }

  /**
   * 새 Worker 생성
   */
  private static createNewWorker(): Worker {
    // Worker 스크립트를 Blob URL로 생성
    const blob = new Blob([OFFSCREEN_SVG_WORKER_SCRIPT], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    try {
      const worker = new Worker(workerUrl);
      const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Worker 풀에 추가
      this.workerPool.set(workerId, {
        worker,
        state: 'idle',
        lastUsed: Date.now()
      });

      // Worker 종료 시 정리
      worker.addEventListener('error', () => {
        this.workerPool.delete(workerId);
        URL.revokeObjectURL(workerUrl);
      });

      return worker;

    } catch (error) {
      URL.revokeObjectURL(workerUrl);
      throw new Error(`Worker 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  /**
   * Worker 작업 실행 및 타임아웃 처리
   */
  private static async executeWorkerTask(
    worker: Worker,
    message: WorkerMessage
  ): Promise<SvgProcessingResult> {
    return new Promise((resolve, reject) => {
      // 타임아웃 설정
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Worker 처리 타임아웃 (${this.WORKER_TIMEOUT_MS}ms)`));
      }, this.WORKER_TIMEOUT_MS);

      // 메시지 핸들러
      const messageHandler = (event: MessageEvent) => {
        const response = event.data as WorkerResponse;

        if (response.requestId === message.requestId) {
          cleanup();

          if (response.error) {
            reject(new Error(`Worker 처리 오류: ${response.error}`));
          } else if (response.result) {
            resolve(response.result);
          } else {
            reject(new Error('Worker에서 올바르지 않은 응답을 받았습니다'));
          }
        }
      };

      // 에러 핸들러
      const errorHandler = (error: ErrorEvent) => {
        cleanup();
        reject(new Error(`Worker 에러: ${error.message}`));
      };

      // 이벤트 리스너 정리 함수
      const cleanup = () => {
        clearTimeout(timeoutId);
        worker.removeEventListener('message', messageHandler);
        worker.removeEventListener('error', errorHandler);
      };

      // 이벤트 리스너 등록
      worker.addEventListener('message', messageHandler);
      worker.addEventListener('error', errorHandler);

      // 작업 전송
      worker.postMessage(message);
    });
  }

  /**
   * Worker 상태 업데이트
   */
  private static updateWorkerState(worker: Worker, state: WorkerState): void {
    for (const workerInfo of this.workerPool.values()) {
      if (workerInfo.worker === worker) {
        workerInfo.state = state;
        workerInfo.lastUsed = Date.now();
        break;
      }
    }
  }

  /**
   * Worker 종료 및 정리
   */
  private static terminateWorker(worker: Worker): void {
    // 풀에서 제거
    for (const [workerId, workerInfo] of this.workerPool) {
      if (workerInfo.worker === worker) {
        workerInfo.state = 'terminated';
        this.workerPool.delete(workerId);
        break;
      }
    }

    // Worker 종료
    try {
      worker.terminate();
    } catch (error) {
      console.warn('[OffscreenSVGProcessor] Worker 종료 중 오류:', error);
    }
  }

  /**
   * 가장 오래된 Worker 정리
   */
  private static cleanupOldestWorker(): void {
    let oldestWorkerId: string | null = null;
    let oldestTime = Date.now();

    for (const [workerId, workerInfo] of this.workerPool) {
      if (workerInfo.state === 'idle' && workerInfo.lastUsed < oldestTime) {
        oldestTime = workerInfo.lastUsed;
        oldestWorkerId = workerId;
      }
    }

    if (oldestWorkerId) {
      const workerInfo = this.workerPool.get(oldestWorkerId);
      if (workerInfo) {
        this.terminateWorker(workerInfo.worker);
      }
    }
  }

  /**
   * 기존 SVGProcessor로 폴백 처리
   */
  private static async fallbackToStandardProcessor(
    svgString: string,
    options: SvgProcessingOptions
  ): Promise<SvgProcessingResult> {
    return SVGProcessor.processWithQuality(svgString, options);
  }

  /**
   * 모든 Worker 정리 (애플리케이션 종료 시 호출)
   */
  static cleanup(): void {
    for (const workerInfo of this.workerPool.values()) {
      this.terminateWorker(workerInfo.worker);
    }
    this.workerPool.clear();
  }

  /**
   * Worker 풀 상태 조회 (디버깅용)
   */
  static getWorkerPoolStatus(): { total: number; idle: number; processing: number; terminated: number } {
    let idle = 0, processing = 0, terminated = 0;

    for (const workerInfo of this.workerPool.values()) {
      switch (workerInfo.state) {
        case 'idle': idle++; break;
        case 'processing': processing++; break;
        case 'terminated': terminated++; break;
      }
    }

    return {
      total: this.workerPool.size,
      idle,
      processing,
      terminated
    };
  }

  /**
   * 오래된 Worker들 주기적 정리
   */
  static startPeriodicCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const workersToCleanup: string[] = [];

      for (const [workerId, workerInfo] of this.workerPool) {
        if (workerInfo.state === 'idle' &&
            (now - workerInfo.lastUsed) > this.WORKER_REUSE_TIMEOUT_MS) {
          workersToCleanup.push(workerId);
        }
      }

      for (const workerId of workersToCleanup) {
        const workerInfo = this.workerPool.get(workerId);
        if (workerInfo) {
          this.terminateWorker(workerInfo.worker);
        }
      }
    }, 60000); // 1분마다 정리
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS - 편의 함수들
// ============================================================================

/**
 * OffscreenCanvas 지원 여부 빠른 체크
 */
export async function isOffscreenCanvasSupported(): Promise<boolean> {
  const detector = BrowserCapabilityDetector.getInstance();
  const capabilities = await detector.detectCapabilities({ timeout: 1000 });

  return capabilities.offscreenCanvas &&
         capabilities.webWorkers &&
         capabilities.imageBitmap &&
         capabilities.transferableObjects;
}

/**
 * 스마트 SVG 처리 (자동 모드 선택)
 * OffscreenCanvas 지원 시 고성능 처리, 미지원 시 표준 처리
 */
export async function processSmartSvg(
  svgString: string,
  options: SvgProcessingOptions
): Promise<SvgProcessingResult> {
  const isSupported = await isOffscreenCanvasSupported();

  if (isSupported) {
    return OffscreenSVGProcessor.processWithOffscreenCanvas(svgString, options);
  } else {
    return SVGProcessor.processWithQuality(svgString, options);
  }
}

// 전역 정리를 위한 이벤트 리스너 등록
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    OffscreenSVGProcessor.cleanup();
  });

  // 주기적 정리 시작
  OffscreenSVGProcessor.startPeriodicCleanup();
}