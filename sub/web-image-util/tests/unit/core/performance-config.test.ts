import { describe, expect, it } from 'vitest';
import { getPerformanceConfig, RESIZE_PROFILES } from '../../../src/core/performance-config';

describe('RESIZE_PROFILES', () => {
  it('fast 프로파일은 고속 처리 기본값을 가진다', () => {
    const fastProfile = RESIZE_PROFILES.fast;

    expect(fastProfile.concurrency).toBe(4);
    expect(fastProfile.timeout).toBe(15);
  });

  it('balanced 프로파일은 균형 처리 기본값을 가진다', () => {
    const balancedProfile = RESIZE_PROFILES.balanced;

    expect(balancedProfile.concurrency).toBe(2);
    expect(balancedProfile.timeout).toBe(30);
  });

  it('quality 프로파일은 고품질 처리 기본값을 가진다', () => {
    const qualityProfile = RESIZE_PROFILES.quality;

    expect(qualityProfile.concurrency).toBe(1);
    expect(qualityProfile.timeout).toBe(60);
  });
});

describe('getPerformanceConfig()', () => {
  it('인자 없이 호출하면 balanced 프로파일을 반환한다', () => {
    const config = getPerformanceConfig();

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(30);
  });

  it('fast 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('fast');

    expect(config.concurrency).toBe(4);
    expect(config.timeout).toBe(15);
  });

  it('balanced 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('balanced');

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(30);
  });

  it('quality 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('quality');

    expect(config.concurrency).toBe(1);
    expect(config.timeout).toBe(60);
  });

  it('override가 기본 프로파일 값에 병합된다', () => {
    const config = getPerformanceConfig('balanced', {
      concurrency: 8,
      timeout: 45,
    });

    expect(config.concurrency).toBe(8);
    expect(config.timeout).toBe(45);
  });

  it('override는 지정한 키만 덮어쓰고 나머지는 유지된다', () => {
    const config = getPerformanceConfig('fast', {
      timeout: 45,
    });

    expect(config.concurrency).toBe(4);
    expect(config.timeout).toBe(45);
  });

  it('빈 override 객체는 프로파일 값을 그대로 반환한다', () => {
    const config = getPerformanceConfig('quality', {});

    expect(config.concurrency).toBe(1);
    expect(config.timeout).toBe(60);
  });

  it('반환값은 원본 RESIZE_PROFILES 객체의 얕은 복사다', () => {
    const config = getPerformanceConfig('balanced');

    // 반환된 config를 수정한다
    config.concurrency = 999;
    config.timeout = 999;

    // 원본은 영향을 받지 않는다
    expect(RESIZE_PROFILES.balanced.concurrency).toBe(2);
    expect(RESIZE_PROFILES.balanced.timeout).toBe(30);
  });

  it('여러 번 호출한 결과는 서로 독립적이다', () => {
    const config1 = getPerformanceConfig('fast');
    const config2 = getPerformanceConfig('fast');

    config1.concurrency = 10;

    expect(config2.concurrency).toBe(4);
  });

  it('quality 프로파일에 override를 적용한다', () => {
    const config = getPerformanceConfig('quality', {
      concurrency: 2,
      timeout: 45,
    });

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(45);
  });

  it('balanced 프로파일이 default 프로파일인지 검증한다', () => {
    const defaultConfig = getPerformanceConfig();
    const explicitBalancedConfig = getPerformanceConfig('balanced');

    expect(defaultConfig.concurrency).toBe(explicitBalancedConfig.concurrency);
    expect(defaultConfig.timeout).toBe(explicitBalancedConfig.timeout);
  });
});
