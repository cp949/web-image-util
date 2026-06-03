/**
 * getDomPurify의 환경 분기를 고정한다.
 *
 * 1. window가 있는 환경: factory로 인스턴스를 만들고 모듈 변수에 캐시한다.
 * 2. window가 없고 DOMPurify가 sanitize를 가지면 그대로 반환한다.
 * 3. window가 없고 factory만 있으면 SVG_DOMPURIFY_INIT_FAILED로 실패한다.
 *
 * 전역 window와 'dompurify' 모듈을 가짜로 바꾸므로 매 테스트 후 복구한다.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../../src/svg-sanitizer/dompurify-instance.internal';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('dompurify');
  vi.resetModules();
});

describe('getDomPurify', () => {
  it('window가 있는 환경에서 인스턴스를 만들고 동일 인스턴스를 캐시한다', async () => {
    vi.resetModules();
    const { getDomPurify } = await import(MODULE_PATH);

    const first = getDomPurify();
    const second = getDomPurify();

    expect(typeof first.sanitize).toBe('function');
    // 두 번째 호출은 모듈 캐시(domPurifyInstance)를 그대로 반환한다.
    expect(second).toBe(first);
  });

  it('window가 없고 DOMPurify가 sanitize를 가지면 그대로 반환한다', async () => {
    vi.resetModules();
    const fakeInstance = { sanitize: (svg: string) => svg };
    vi.doMock('dompurify', () => ({ default: fakeInstance }));
    vi.stubGlobal('window', undefined);

    const { getDomPurify } = await import(MODULE_PATH);

    expect(getDomPurify()).toBe(fakeInstance);
  });

  it('window가 없고 factory만 있으면 SVG_DOMPURIFY_INIT_FAILED로 던진다', async () => {
    vi.resetModules();
    // DOMPurify가 함수(factory)라 `.sanitize` 프로퍼티가 없어 init 실패한다.
    const factory = () => ({ sanitize: (svg: string) => svg });
    vi.doMock('dompurify', () => ({ default: factory }));
    vi.stubGlobal('window', undefined);

    const { getDomPurify } = await import(MODULE_PATH);

    let thrown: unknown;
    try {
      getDomPurify();
    } catch (error) {
      thrown = error;
    }

    // vi.resetModules로 errors 모듈이 새 그래프에 로드되므로 instanceof 대신 code/형태로 검증한다.
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as { code?: string }).code).toBe('SVG_DOMPURIFY_INIT_FAILED');
  });
});
