/**
 * 경량(lightweight)·strict sanitizer 동치성 스위트.
 *
 * 같은 코퍼스를 두 sanitizer에 통과시켜, divergence로 문서화된 지점 외에는
 * 같은 위협이 같은 방식으로 제거됨을 고정한다. 위협 정책 변경 시 코퍼스
 * 기대값을 의도적으로 함께 갱신한다.
 */

import { describe, expect, it } from 'vitest';

import { sanitizeSvgStrict } from '../../src/svg-sanitizer';
import { sanitizeSvgForRendering } from '../../src/utils/svg-sanitizer';
import { SANITIZER_EQUIVALENCE_CORPUS, type SanitizerExpectation } from './sanitizer-equivalence.corpus';

function assertExpectation(output: string, expectation: SanitizerExpectation, label: string): void {
  for (const fragment of expectation.preserves ?? []) {
    expect(output, `${label}: "${fragment}" 보존 기대`).toContain(fragment);
  }
  for (const fragment of expectation.removes ?? []) {
    expect(output, `${label}: "${fragment}" 제거 기대`).not.toContain(fragment);
  }
}

describe('sanitizer 동치성 코퍼스', () => {
  for (const testCase of SANITIZER_EQUIVALENCE_CORPUS) {
    it(testCase.name, () => {
      const lightweightOutput = sanitizeSvgForRendering(testCase.svg);
      const strictOutput = sanitizeSvgStrict(testCase.svg);

      assertExpectation(lightweightOutput, testCase.expected.lightweight, 'lightweight');
      assertExpectation(strictOutput, testCase.expected.strict, 'strict');
    });
  }

  it('모드 간 기대가 다른 항목은 전부 divergence 사유를 명시한다', () => {
    for (const testCase of SANITIZER_EQUIVALENCE_CORPUS) {
      const lightweight = JSON.stringify(testCase.expected.lightweight);
      const strict = JSON.stringify(testCase.expected.strict);
      if (lightweight !== strict) {
        expect(testCase.divergence, `"${testCase.name}"는 기대가 다르므로 divergence가 필요하다`).toBeTruthy();
      }
    }
  });
});
