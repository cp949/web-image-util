/**
 * Canvas 풀 관리 클래스
 * Canvas 객체를 재사용하여 성능을 최적화한다.
 * Fabric.js 패턴을 참고한 동적 메모리 관리 시스템.
 */

import { debugLog } from '../utils/debug';
export class CanvasPool {
  private static instance: CanvasPool;
  private pool: HTMLCanvasElement[] = [];
  private maxPoolSize: number;
  private memoryThreshold = 256 * 1024 * 1024; // 256MB

  // 성능 통계
  private stats = {
    totalCreated: 0,
    totalAcquired: 0,
    totalReleased: 0,
    poolHits: 0,
    memoryOptimizations: 0,
  };

  private constructor() {
    this.maxPoolSize = this.getOptimalPoolSize();
  }

  /**
   * 싱글톤 인스턴스를 반환한다.
   */
  static getInstance(): CanvasPool {
    if (!CanvasPool.instance) {
      CanvasPool.instance = new CanvasPool();
    }
    return CanvasPool.instance;
  }

  /**
   * 시스템 메모리 기준으로 최적 풀 크기를 계산한다.
   */
  private getOptimalPoolSize(): number {
    const memory = this.getAvailableMemory();
    if (memory > 1024) return 15; // 1GB 이상
    if (memory > 512) return 12; // 512MB 이상
    if (memory > 256) return 10; // 256MB 이상
    return 8; // 기본값
  }

  /**
   * 사용 가능한 메모리를 추정한다 (MB 단위).
   */
  private getAvailableMemory(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return (memory.jsHeapSizeLimit - memory.usedJSHeapSize) / (1024 * 1024);
    }
    return 512; // 기본값 (512MB)
  }

  /**
   * 풀에서 Canvas를 가져오거나 새로 생성한다.
   * @param width - Canvas 너비 (선택)
   * @param height - Canvas 높이 (선택)
   * @returns 재사용 가능한 Canvas 요소
   */
  acquire(width?: number, height?: number): HTMLCanvasElement {
    this.stats.totalAcquired++;

    // 메모리 압박 감지 및 처리
    this.checkMemoryPressure();

    let canvas: HTMLCanvasElement;

    if (this.pool.length > 0) {
      canvas = this.pool.pop()!;
      this.stats.poolHits++;
    } else {
      canvas = document.createElement('canvas');
      this.stats.totalCreated++;
    }

    // 크기 설정
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Canvas 초기화 (Fabric.js 패턴 참고)
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 성능을 위해 필수 속성만 초기화
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.filter = 'none'; // 필터 초기화
    }

    return canvas;
  }

  /**
   * 메모리 압박을 감지하고 처리한다 (Fabric.js 최적화 패턴 적용).
   */
  private checkMemoryPressure(): void {
    const currentUsage = this.getEstimatedMemoryUsage();

    if (currentUsage > this.memoryThreshold) {
      // 메모리 압박 시 풀 크기 축소
      const targetReduction = Math.ceil(this.pool.length * 0.3); // 30% 감소
      this.reducePoolSize(targetReduction);
      this.stats.memoryOptimizations++;
    }
  }

  /**
   * 풀 크기를 줄인다.
   */
  private reducePoolSize(count: number = 1): void {
    for (let i = 0; i < count && this.pool.length > 0; i++) {
      const canvas = this.pool.pop();
      if (canvas) {
        this.disposeCanvas(canvas);
      }
    }
  }

  /**
   * Canvas를 풀에 반환한다 (Fabric.js dispose 패턴 적용).
   * @param canvas - 반환할 Canvas 요소
   */
  release(canvas: HTMLCanvasElement): void {
    this.stats.totalReleased++;

    if (this.pool.length < this.maxPoolSize) {
      // 대형 Canvas는 메모리 절약을 위해 풀에 보관하지 않음
      const maxSize = 2048 * 2048;
      if (canvas.width * canvas.height <= maxSize) {
        // Canvas 상태를 정리하고 풀에 반환
        this.cleanCanvas(canvas);
        this.pool.push(canvas);
        return;
      }
    }

    // 풀이 가득 찼거나 Canvas가 너무 크면 완전히 dispose
    this.disposeCanvas(canvas);
  }

  /**
   * Canvas 상태를 정리한다 (재사용을 위한 초기화).
   */
  private cleanCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 컨텍스트 상태만 초기화 (크기 유지)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // 변환 행렬 초기화
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.filter = 'none';
    }
  }

  /**
   * Canvas를 완전히 해제한다 (Fabric.js dispose 패턴).
   */
  private disposeCanvas(canvas: HTMLCanvasElement): void {
    // 메모리 해제를 위해 크기를 0으로 초기화
    canvas.width = 0;
    canvas.height = 0;
  }

  /**
   * 풀 최대 크기를 조정한다.
   * @param size - 최대 풀 크기
   */
  setMaxPoolSize(size: number): void {
    this.maxPoolSize = size;

    // 초과 Canvas 객체 제거
    while (this.pool.length > this.maxPoolSize) {
      const canvas = this.pool.pop();
      if (canvas) {
        this.disposeCanvas(canvas);
      }
    }
  }

  /**
   * 풀 전체를 초기화한다 (Fabric.js dispose 패턴).
   * 메모리 정리가 필요할 때 호출한다.
   */
  clear(): void {
    // 모든 Canvas 메모리 정리
    this.pool.forEach((canvas) => {
      this.disposeCanvas(canvas);
    });

    this.pool = [];
    this.resetStats();
  }

  /**
   * 통계를 초기화한다.
   */
  private resetStats(): void {
    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      poolHits: 0,
      memoryOptimizations: 0,
    };
  }

  /**
   * Canvas Pool 복잡도를 측정한다 (Fabric.js complexity 패턴).
   * @returns 풀 복잡도 지수 (0-1)
   */
  complexity(): number {
    const memoryUsage = this.getEstimatedMemoryUsage() / this.memoryThreshold;
    const poolUtilization = this.pool.length / this.maxPoolSize;
    const hitRatio = this.stats.totalAcquired > 0 ? this.stats.poolHits / this.stats.totalAcquired : 0;

    // 복잡도 = 메모리 사용률 * 0.5 + 풀 점유율 * 0.3 + (1 - 히트율) * 0.2
    return Math.min(1, memoryUsage * 0.5 + poolUtilization * 0.3 + (1 - hitRatio) * 0.2);
  }

  /**
   * 현재 풀 상태 정보를 반환한다 (확장 통계).
   */
  getStats(): {
    poolSize: number;
    maxPoolSize: number;
    totalCreated: number;
    totalAcquired: number;
    totalReleased: number;
    poolHits: number;
    hitRatio: number;
    memoryUsageMB: number;
    memoryOptimizations: number;
    complexity: number;
  } {
    const hitRatio = this.stats.totalAcquired > 0 ? this.stats.poolHits / this.stats.totalAcquired : 0;

    return {
      poolSize: this.pool.length,
      maxPoolSize: this.maxPoolSize,
      totalCreated: this.stats.totalCreated,
      totalAcquired: this.stats.totalAcquired,
      totalReleased: this.stats.totalReleased,
      poolHits: this.stats.poolHits,
      hitRatio: Math.round(hitRatio * 100) / 100, // 소수점 2자리
      memoryUsageMB: Math.round((this.getEstimatedMemoryUsage() / (1024 * 1024)) * 100) / 100,
      memoryOptimizations: this.stats.memoryOptimizations,
      complexity: Math.round(this.complexity() * 100) / 100,
    };
  }

  /**
   * 메모리 사용량을 추정한다 (바이트 단위).
   */
  getEstimatedMemoryUsage(): number {
    return this.pool.reduce((total, canvas) => {
      // RGBA 4바이트 * 픽셀 수
      return total + canvas.width * canvas.height * 4;
    }, 0);
  }

  /**
   * Canvas Pool 상태 정보를 출력한다 (디버깅용).
   */
  logStats(): void {
    const stats = this.getStats();
    debugLog.log('Canvas Pool Stats:', {
      'Pool Size': `${stats.poolSize}/${stats.maxPoolSize}`,
      'Hit Ratio': `${(stats.hitRatio * 100).toFixed(1)}%`,
      'Memory Usage': `${stats.memoryUsageMB}MB`,
      'Total Created': stats.totalCreated,
      Complexity: stats.complexity,
    });
  }
}
