/**
 * 브라우저 기능 감지 결과를 메모리에 캐시한다.
 *
 * @description 동기/비동기 감지 함수들이 공유하는 단일 캐시 인스턴스를 제공한다.
 * SSR 환경에서는 저장과 조회를 모두 무시해서 정적 분석 단계에서 결과가 굳지 않도록 한다.
 */

/** 기능 감지 결과 캐시다. */
class CapabilityCache {
  private cache = new Map<string, unknown>();

  /** 캐시에서 값을 읽는다. */
  get<T>(key: string): T | undefined {
    if (this.isServerSide) return undefined;
    return this.cache.get(key) as T | undefined;
  }

  /** 캐시에 값을 저장한다. */
  set<T>(key: string, value: T): void {
    if (this.isServerSide) return;
    this.cache.set(key, value);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Whether SSR environment
   */
  get isServerSide(): boolean {
    return typeof window === 'undefined' || typeof globalThis.document === 'undefined';
  }
}

/** 모듈 내에서 공유하는 단일 캐시 인스턴스. */
export const capabilityCache = new CapabilityCache();
