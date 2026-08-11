/**
 * 통일 실행 환경 감지(utils/environment.internal.ts) 단위 테스트.
 *
 * 기존 스택별 사본(inspect-svg-source / prefix-svg-ids)에 산재하던
 * 멤버십 단언을 이 파일 하나로 대체한다(replace-don't-layer).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { detectRuntimeEnvironment } from '../../../src/utils/environment.internal';

describe('detectRuntimeEnvironment', () => {
  afterEach(() => {
    delete (globalThis as unknown as Record<string, unknown>).happyDOM;
  });

  // 테스트 셋업(jsdom) 의존: window/document/DOMParser가 존재하는 환경을 전제한다.
  it('jsdom 셋업(window/document/DOMParser 존재)에서는 browser로 판정한다', () => {
    expect(detectRuntimeEnvironment()).toBe('browser');
  });

  it('globalThis.happyDOM이 있으면 window/document가 있어도 happy-dom이 우선한다', () => {
    (globalThis as unknown as Record<string, unknown>).happyDOM = {};
    expect(detectRuntimeEnvironment()).toBe('happy-dom');
  });
});
