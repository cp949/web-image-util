import { CanvasPool } from './canvas-pool';
import { createImageError } from './error-helpers';

/**
 * Canvas 작업을 자동으로 관리하는 래퍼 클래스
 * Canvas의 생명주기를 관리하고 자동으로 풀에 반환합니다.
 */
export class ManagedCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: CanvasPool;
  private disposed = false;

  constructor(width?: number, height?: number) {
    this.pool = CanvasPool.getInstance();
    this.canvas = this.pool.acquire(width, height);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      this.pool.release(this.canvas);
      throw createImageError('CANVAS_CREATION_FAILED', new Error('CanvasRenderingContext2D 생성 실패'));
    }

    this.ctx = ctx;
  }

  /**
   * Canvas 요소 반환
   * @returns HTMLCanvasElement
   */
  getCanvas(): HTMLCanvasElement {
    this.checkDisposed();
    return this.canvas;
  }

  /**
   * Canvas 2D Context 반환
   * @returns CanvasRenderingContext2D
   */
  getContext(): CanvasRenderingContext2D {
    this.checkDisposed();
    return this.ctx;
  }

  /**
   * Canvas 크기 설정
   * @param width - 너비
   * @param height - 높이
   */
  setSize(width: number, height: number): void {
    this.checkDisposed();
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Canvas 초기화 (모든 픽셀을 투명하게)
   */
  clear(): void {
    this.checkDisposed();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Canvas에 배경색 설정
   * @param color - 배경색 (CSS 색상 문자열)
   */
  setBackgroundColor(color: string): void {
    this.checkDisposed();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Canvas가 이미 해제되었는지 확인
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * 리소스 정리 (자동으로 풀에 반환)
   */
  dispose(): void {
    if (!this.disposed) {
      this.pool.release(this.canvas);
      this.disposed = true;
    }
  }

  /**
   * 해제 상태 확인
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('이미 해제된 ManagedCanvas입니다.');
    }
  }
}

/**
 * Canvas 작업을 자동으로 관리하는 헬퍼 함수
 * 작업 완료 후 자동으로 Canvas를 풀에 반환합니다.
 *
 * @param width - Canvas 너비
 * @param height - Canvas 높이
 * @param operation - 수행할 Canvas 작업
 * @returns 작업 결과
 */
export async function withManagedCanvas<T>(
  width: number,
  height: number,
  operation: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => Promise<T> | T
): Promise<T> {
  const managedCanvas = new ManagedCanvas(width, height);

  try {
    return await operation(managedCanvas.getCanvas(), managedCanvas.getContext());
  } finally {
    managedCanvas.dispose();
  }
}

/**
 * 다중 Canvas 작업을 관리하는 헬퍼 함수
 * 여러 Canvas를 동시에 사용하는 작업에 적합합니다.
 *
 * @param canvasSizes - 각 Canvas의 크기 배열
 * @param operation - 수행할 작업
 * @returns 작업 결과
 */
export async function withMultipleManagedCanvas<T>(
  canvasSizes: Array<{ width: number; height: number }>,
  operation: (canvases: Array<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>) => Promise<T> | T
): Promise<T> {
  const managedCanvases = canvasSizes.map((size) => new ManagedCanvas(size.width, size.height));

  try {
    const canvasData = managedCanvases.map((managed) => ({
      canvas: managed.getCanvas(),
      ctx: managed.getContext(),
    }));

    return await operation(canvasData);
  } finally {
    managedCanvases.forEach((managed) => managed.dispose());
  }
}

/**
 * Canvas 복사 유틸리티
 * 한 Canvas의 내용을 다른 Canvas로 복사합니다.
 *
 * @param source - 소스 Canvas
 * @param targetWidth - 대상 Canvas 너비
 * @param targetHeight - 대상 Canvas 높이
 * @returns 복사된 새 Canvas
 */
export async function copyCanvas(
  source: HTMLCanvasElement,
  targetWidth?: number,
  targetHeight?: number
): Promise<HTMLCanvasElement> {
  const width = targetWidth || source.width;
  const height = targetHeight || source.height;

  return withManagedCanvas(width, height, (canvas, ctx) => {
    if (targetWidth && targetHeight && (targetWidth !== source.width || targetHeight !== source.height)) {
      // 크기가 다르면 스케일링하여 복사
      ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    } else {
      // 같은 크기면 그대로 복사
      ctx.drawImage(source, 0, 0);
    }
    return canvas;
  });
}

/**
 * Canvas를 Blob으로 변환 (관리되는 Canvas용)
 *
 * @param canvas - 변환할 Canvas
 * @param type - MIME 타입
 * @param quality - 품질 (0-1)
 * @returns Blob Promise
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(createImageError('CONVERSION_FAILED', new Error(`Canvas to ${type} conversion failed`)));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Canvas Pool 상태 정보 조회
 * @returns 풀 상태 정보
 */
export function getCanvasPoolStats() {
  return CanvasPool.getInstance().getStats();
}

/**
 * Canvas Pool 정리
 * 메모리 정리가 필요할 때 호출
 */
export function clearCanvasPool(): void {
  CanvasPool.getInstance().clear();
}

/**
 * Canvas Pool 최대 크기 설정
 * @param size - 최대 풀 크기
 */
export function setCanvasPoolMaxSize(size: number): void {
  CanvasPool.getInstance().setMaxPoolSize(size);
}
