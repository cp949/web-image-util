import { describe, expect, test } from 'vitest';

import { processImage } from '../../src';

/**
 * 계약 테스트 설정이 비어 있더라도 테스트 러너와 기본 공개 API가
 * 정상적으로 연결되는지 확인하는 최소 스모크 테스트다.
 */
describe('계약 테스트 설정 스모크', () => {
  test('공개 processImage API를 로드할 수 있다', () => {
    expect(processImage).toBeTypeOf('function');
  });
});
