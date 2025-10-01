/**
 * 자동 메모리 관리자 - 투명한 메모리 최적화
 *
 * @description 사용자가 메모리 관리를 신경 쓸 필요 없도록
 * 자동으로 메모리 상황을 체크하고 최적화합니다.
 */

import { CanvasPool } from '../base/canvas-pool';
import { debugLog, productionLog } from '../utils/debug';

/**
 * 메모리 상태 정보
 */
interface MemoryInfo {
  /** 메모리 압박 정도 (0-1) */
  pressure: number;
  /** 사용 가능한 메모리 (MB) */
  availableMB: number;
  /** 사용 중인 메모리 (MB) */
  usedMB: number;
  /** 전체 메모리 한계 (MB) */
  limitMB: number;
}

/**
 * 자동 메모리 관리자 - 싱글톤 패턴
 *
 * 사용자가 메모리 관리를 신경 쓸 필요 없도록
 * 내부에서 자동으로 최적화합니다.
 */
export class AutoMemoryManager {
  private static instance: AutoMemoryManager;
  private lastOptimizationTime = 0;
  private optimizationCount = 0;

  static getInstance(): AutoMemoryManager {
    if (!this.instance) {
      this.instance = new AutoMemoryManager();
    }
    return this.instance;
  }

  /**
   * 메모리 상황 자동 체크 및 대응
   * 높은 압박 상황에서 자동으로 최적화 수행
   */
  async checkAndOptimize(): Promise<void> {
    const memoryInfo = this.getMemoryInfo();

    // 메모리 압박이 80% 이상인 경우 자동 최적화
    if (memoryInfo.pressure > 0.8) {
      await this.performOptimization(memoryInfo);
    }
  }

  /**
   * 메모리 최적화 수행
   */
  private async performOptimization(memoryInfo: MemoryInfo): Promise<void> {
    const now = Date.now();

    // 최근 5초 이내에 최적화를 수행했다면 스킵 (너무 빈번한 실행 방지)
    if (now - this.lastOptimizationTime < 5000) {
      return;
    }

    this.lastOptimizationTime = now;
    this.optimizationCount++;

    try {
      // 1. Canvas Pool 정리
      const canvasPool = CanvasPool.getInstance();
      // Canvas Pool이 비어있지 않으면 정리 (내부 pool 배열에 접근)
      canvasPool.clear();
      debugLog.debug('[AutoMemoryManager] Canvas pool cleared due to memory pressure');

      // 2. 가비지 컬렉션 유도 (Node.js 환경에서)
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        debugLog.debug('[AutoMemoryManager] Garbage collection triggered');
      }

      // 3. 브라우저 환경에서 메모리 압박 상황 로깅
      if (typeof console !== 'undefined' && memoryInfo.pressure > 0.9) {
        productionLog.warn(
          `[AutoMemoryManager] High memory pressure: ${Math.round(memoryInfo.pressure * 100)}% ` +
            `(${memoryInfo.usedMB}MB / ${memoryInfo.limitMB}MB)`
        );
      }
    } catch (error) {
      productionLog.error('[AutoMemoryManager] Optimization failed:', error);
    }
  }

  /**
   * 현재 메모리 정보 조회
   */
  getMemoryInfo(): MemoryInfo {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      const availableMB = limitMB - usedMB;

      return {
        pressure: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        availableMB: Math.round(availableMB),
        usedMB: Math.round(usedMB),
        limitMB: Math.round(limitMB),
      };
    }

    // 기본값 (메모리 정보를 얻을 수 없는 환경)
    return {
      pressure: 0.5,
      availableMB: 256,
      usedMB: 128,
      limitMB: 512,
    };
  }

  /**
   * 이미지 처리에 적합한 메모리 상태인지 확인
   */
  canProcessLargeImage(estimatedUsageMB: number): boolean {
    const memoryInfo = this.getMemoryInfo();

    // 현재 압박 상황 + 예상 사용량이 90%를 넘지 않도록
    const projectedPressure = (memoryInfo.usedMB + estimatedUsageMB) / memoryInfo.limitMB;

    return projectedPressure < 0.9;
  }

  /**
   * 이미지 크기에 따른 예상 메모리 사용량 계산
   */
  estimateImageMemoryUsage(width: number, height: number): number {
    // 4채널(RGBA) * 4바이트 + 약간의 오버헤드
    const baseUsage = (width * height * 4) / (1024 * 1024);

    // Canvas 처리 오버헤드 (대략 2배)
    return Math.round(baseUsage * 2);
  }

  /**
   * 적절한 처리 전략 추천
   */
  recommendProcessingStrategy(
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): 'direct' | 'chunked' | 'tiled' | 'memory-efficient' {
    const memoryInfo = this.getMemoryInfo();
    const estimatedUsage = this.estimateImageMemoryUsage(originalWidth, originalHeight);

    // 메모리 압박 상황
    if (memoryInfo.pressure > 0.7 || !this.canProcessLargeImage(estimatedUsage)) {
      return 'memory-efficient';
    }

    // 이미지 크기 기반 전략
    const pixelCount = originalWidth * originalHeight;

    if (pixelCount > 16_000_000) {
      return 'tiled';
    } else if (pixelCount > 4_000_000) {
      return 'chunked';
    } else {
      return 'direct';
    }
  }

  /**
   * 최적화 통계 조회 (디버깅용)
   */
  getOptimizationStats() {
    return {
      optimizationCount: this.optimizationCount,
      lastOptimizationTime: this.lastOptimizationTime,
      memoryInfo: this.getMemoryInfo(),
    };
  }

  /**
   * 메모리 관리자 리셋 (테스트용)
   */
  reset(): void {
    this.optimizationCount = 0;
    this.lastOptimizationTime = 0;
  }
}
