import { CanvasPool } from './canvas-pool.internal';

type CanvasLeaseConsumeResult<T> = T extends HTMLCanvasElement ? never : T;

/**
 * CanvasPool에서 빌린 canvas의 소유권을 표현하는 handle.
 *
 * 렌더러가 pool에서 획득한 canvas를 이 handle에 담아 반환하면,
 * 소비자는 두 가지 방법으로만 canvas를 사용할 수 있다:
 *
 * - {@link consume}: canvas에서 파생물(Blob, DataURL 등)을 만든 뒤 pool로 반환한다.
 * - {@link detach}: canvas 소유권을 호출자에게 이전한다. pool로 돌아가지 않는다
 *   (toCanvas() 계열 — 반환된 canvas는 사용자 소유).
 *
 * 상태 전이는 한 번만 가능하다. consume/detach/release 이후의 접근은 오류이며,
 * 이중 release는 무시된다(멱등). 이 규칙으로 use-after-release와
 * 이중 반환이 코드 리뷰가 아닌 실행 시점에 걸린다.
 */
export class CanvasLease {
  private state: 'active' | 'released' | 'detached' = 'active';

  constructor(private readonly leasedCanvas: HTMLCanvasElement) {}

  /** 임대 중인 canvas. active 상태에서만 접근할 수 있다. */
  get canvas(): HTMLCanvasElement {
    this.assertActive('canvas 접근');
    return this.leasedCanvas;
  }

  /**
   * canvas에서 파생물을 만들고 pool로 반환한다.
   * 콜백이 실패해도 canvas는 pool로 돌아간다.
   */
  async consume<T>(
    fn: (canvas: HTMLCanvasElement) => Promise<CanvasLeaseConsumeResult<T>> | CanvasLeaseConsumeResult<T>
  ): Promise<CanvasLeaseConsumeResult<T>> {
    this.assertActive('consume');
    try {
      return await fn(this.leasedCanvas);
    } finally {
      this.state = 'released';
      CanvasPool.getInstance().release(this.leasedCanvas);
    }
  }

  /**
   * canvas 소유권을 호출자에게 이전한다. pool로 돌아가지 않으며,
   * 이후 이 lease로는 canvas에 접근할 수 없다.
   */
  detach(): HTMLCanvasElement {
    this.assertActive('detach');
    this.state = 'detached';
    return this.leasedCanvas;
  }

  /**
   * canvas를 pool로 반환한다. 오류 경로 정리용.
   * 이미 consume/detach/release된 lease에는 아무 일도 하지 않는다(멱등).
   */
  release(): void {
    if (this.state !== 'active') {
      return;
    }
    this.state = 'released';
    CanvasPool.getInstance().release(this.leasedCanvas);
  }

  private assertActive(action: string): void {
    if (this.state !== 'active') {
      throw new Error(`CanvasLease: ${this.state} 상태에서는 ${action}이(가) 불가능하다`);
    }
  }
}

/**
 * CanvasPool에서 canvas를 빌려 {@link CanvasLease}로 감싼다.
 *
 * pool을 거치는 유일한 획득 경로다 — 호출자는 pool을 직접 만지지 않고
 * lease의 consume/detach만으로 canvas 수명을 끝낸다.
 * 결과 canvas를 호출자에게 그대로 넘겨야 하면 pool 대신
 * `createOwnedCanvas`(owned canvas)를 쓴다.
 */
export function leaseCanvas(width: number, height: number): CanvasLease {
  return new CanvasLease(CanvasPool.getInstance().acquire(width, height));
}
