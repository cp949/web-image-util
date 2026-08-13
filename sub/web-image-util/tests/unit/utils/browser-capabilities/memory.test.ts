/**
 * 메모리 예산 모듈의 characterization 테스트다.
 *
 * probe 주입/해제, fallback 적용, GC 요청 가드를 다룬다. 실제 Chromium
 * performance.memory 값 자체는 jsdom에 없어 여기서 검증하지 않는다 — 소비자
 * 이관 후 각 소비자 테스트(performance-utils 등)가 실제 주입 경로를 덮는다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readMemoryBudget,
  requestMemoryRelief,
  resetMemoryProbe,
  setMemoryProbe,
} from '../../../../src/utils/browser-capabilities/memory.internal';

describe('readMemoryBudget', () => {
  afterEach(() => {
    resetMemoryProbe();
  });

  it('probe가 값을 반환하면 그 값을 그대로 돌려준다', () => {
    setMemoryProbe({
      read: () => ({ usedMB: 100, limitMB: 400, availableMB: 300, pressure: 0.25 }),
    });

    expect(readMemoryBudget()).toEqual({ usedMB: 100, limitMB: 400, availableMB: 300, pressure: 0.25 });
  });

  it('probe가 undefined를 반환하면 단일 fallback 값을 돌려준다', () => {
    setMemoryProbe({ read: () => undefined });

    expect(readMemoryBudget()).toEqual({ usedMB: 128, limitMB: 512, availableMB: 384, pressure: 0.25 });
  });

  it('resetMemoryProbe 이후에는 기본 Chromium probe로 돌아간다', () => {
    setMemoryProbe({ read: () => ({ usedMB: 1, limitMB: 2, availableMB: 1, pressure: 0.5 }) });
    resetMemoryProbe();

    // jsdom에는 performance.memory가 없으므로 기본 probe는 undefined를 반환해 fallback으로 떨어진다
    expect(readMemoryBudget()).toEqual({ usedMB: 128, limitMB: 512, availableMB: 384, pressure: 0.25 });
  });
});

describe('requestMemoryRelief', () => {
  afterEach(() => {
    delete (global as any).gc;
  });

  it('global.gc가 있으면 호출하고 true를 반환한다', () => {
    const gcSpy = vi.fn();
    (global as any).gc = gcSpy;

    expect(requestMemoryRelief()).toBe(true);
    expect(gcSpy).toHaveBeenCalledOnce();
  });

  it('global.gc가 없으면 예외 없이 false를 반환한다', () => {
    delete (global as any).gc;

    expect(() => requestMemoryRelief()).not.toThrow();
    expect(requestMemoryRelief()).toBe(false);
  });
});
