/**
 * Canvas 풀링 관리 클래스
 * Canvas 객체를 재사용하여 성능을 최적화합니다.
 */
export class CanvasPool {
  private static instance: CanvasPool;
  private pool: HTMLCanvasElement[] = [];
  private maxPoolSize = 10;
  private currentSize = 0;

  private constructor() {}

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): CanvasPool {
    if (!CanvasPool.instance) {
      CanvasPool.instance = new CanvasPool();
    }
    return CanvasPool.instance;
  }

  /**
   * 풀에서 Canvas 가져오기 또는 새로 생성
   * @param width - Canvas 너비 (선택사항)
   * @param height - Canvas 높이 (선택사항)
   * @returns 재사용 가능한 Canvas 요소
   */
  acquire(width?: number, height?: number): HTMLCanvasElement {
    let canvas: HTMLCanvasElement;

    if (this.pool.length > 0) {
      canvas = this.pool.pop()!;
    } else {
      canvas = document.createElement('canvas');
      this.currentSize++;
    }

    // 크기 설정
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Canvas 초기화
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 기본 설정 초기화
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
    }

    return canvas;
  }

  /**
   * Canvas를 풀로 반환
   * @param canvas - 반환할 Canvas 요소
   */
  release(canvas: HTMLCanvasElement): void {
    if (this.pool.length < this.maxPoolSize) {
      // 큰 Canvas는 풀로 반환하지 않음 (메모리 절약)
      const maxSize = 2048 * 2048;
      if (canvas.width * canvas.height <= maxSize) {
        this.pool.push(canvas);
        return;
      }
    }

    // 풀이 가득 차거나 Canvas가 너무 클 경우 메모리에서 제거
    this.currentSize--;
    canvas.width = 0;
    canvas.height = 0;
  }

  /**
   * 풀 크기 조정
   * @param size - 최대 풀 크기
   */
  setMaxPoolSize(size: number): void {
    this.maxPoolSize = size;

    // 초과하는 Canvas 제거
    while (this.pool.length > this.maxPoolSize) {
      const canvas = this.pool.pop();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        this.currentSize--;
      }
    }
  }

  /**
   * 풀 완전 정리
   * 메모리 정리가 필요할 때 호출
   */
  clear(): void {
    // 모든 Canvas 메모리 정리
    this.pool.forEach((canvas) => {
      canvas.width = 0;
      canvas.height = 0;
    });

    this.pool = [];
    this.currentSize = 0;
  }

  /**
   * 현재 풀 상태 정보
   * @returns 풀 크기와 총 생성된 Canvas 수
   */
  getStats(): { poolSize: number; totalCreated: number; maxPoolSize: number } {
    return {
      poolSize: this.pool.length,
      totalCreated: this.currentSize,
      maxPoolSize: this.maxPoolSize,
    };
  }

  /**
   * 메모리 사용량 추정
   * @returns 예상 메모리 사용량 (바이트)
   */
  getEstimatedMemoryUsage(): number {
    return this.pool.reduce((total, canvas) => {
      // RGBA 4바이트 * 픽셀 수
      return total + canvas.width * canvas.height * 4;
    }, 0);
  }
}
