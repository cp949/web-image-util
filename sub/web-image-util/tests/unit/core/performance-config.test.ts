import { describe, expect, it } from 'vitest';
import {
  RESIZE_PROFILES,
  ResizePerformanceOptions,
  ResizeProfile,
  getPerformanceConfig,
} from '../../../src/core/performance-config';

describe('RESIZE_PROFILES', () => {
  it('fast 프로파일은 고속 처리 기본값을 가진다', () => {
    const fastProfile = RESIZE_PROFILES.fast;

    expect(fastProfile.concurrency).toBe(4);
    expect(fastProfile.timeout).toBe(15);
    expect(fastProfile.memoryLimitMB).toBe(128);
    expect(fastProfile.useCanvasPool).toBe(true);
  });

  it('balanced 프로파일은 균형 처리 기본값을 가진다', () => {
    const balancedProfile = RESIZE_PROFILES.balanced;

    expect(balancedProfile.concurrency).toBe(2);
    expect(balancedProfile.timeout).toBe(30);
    expect(balancedProfile.memoryLimitMB).toBe(256);
    expect(balancedProfile.useCanvasPool).toBe(true);
  });

  it('quality 프로파일은 고품질 처리 기본값을 가진다', () => {
    const qualityProfile = RESIZE_PROFILES.quality;

    expect(qualityProfile.concurrency).toBe(1);
    expect(qualityProfile.timeout).toBe(60);
    expect(qualityProfile.memoryLimitMB).toBe(512);
    expect(qualityProfile.useCanvasPool).toBe(true);
  });

  it('모든 프로파일에 useCanvasPool=true가 설정되어 있다', () => {
    const profiles: ResizeProfile[] = ['fast', 'balanced', 'quality'];

    profiles.forEach((profile) => {
      expect(RESIZE_PROFILES[profile].useCanvasPool).toBe(true);
    });
  });

  it('모든 프로파일이 필수 필드를 포함한다', () => {
    const profiles: ResizeProfile[] = ['fast', 'balanced', 'quality'];

    profiles.forEach((profile) => {
      const config = RESIZE_PROFILES[profile];
      expect(config).toHaveProperty('concurrency');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('useCanvasPool');
      expect(config).toHaveProperty('memoryLimitMB');
    });
  });
});

describe('getPerformanceConfig()', () => {
  it('인자 없이 호출하면 balanced 프로파일을 반환한다', () => {
    const config = getPerformanceConfig();

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(30);
    expect(config.memoryLimitMB).toBe(256);
    expect(config.useCanvasPool).toBe(true);
  });

  it('fast 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('fast');

    expect(config.concurrency).toBe(4);
    expect(config.timeout).toBe(15);
    expect(config.memoryLimitMB).toBe(128);
    expect(config.useCanvasPool).toBe(true);
  });

  it('balanced 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('balanced');

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(30);
    expect(config.memoryLimitMB).toBe(256);
    expect(config.useCanvasPool).toBe(true);
  });

  it('quality 프로파일을 명시적으로 반환한다', () => {
    const config = getPerformanceConfig('quality');

    expect(config.concurrency).toBe(1);
    expect(config.timeout).toBe(60);
    expect(config.memoryLimitMB).toBe(512);
    expect(config.useCanvasPool).toBe(true);
  });

  it('override가 기본 프로파일 값에 병합된다', () => {
    const config = getPerformanceConfig('balanced', {
      concurrency: 8,
      timeout: 45,
    });

    expect(config.concurrency).toBe(8);
    expect(config.timeout).toBe(45);
    expect(config.memoryLimitMB).toBe(256);
    expect(config.useCanvasPool).toBe(true);
  });

  it('override는 지정한 키만 덮어쓰고 나머지는 유지된다', () => {
    const config = getPerformanceConfig('fast', {
      memoryLimitMB: 256,
    });

    expect(config.concurrency).toBe(4);
    expect(config.timeout).toBe(15);
    expect(config.memoryLimitMB).toBe(256);
    expect(config.useCanvasPool).toBe(true);
  });

  it('빈 override 객체는 프로파일 값을 그대로 반환한다', () => {
    const config = getPerformanceConfig('quality', {});

    expect(config.concurrency).toBe(1);
    expect(config.timeout).toBe(60);
    expect(config.memoryLimitMB).toBe(512);
    expect(config.useCanvasPool).toBe(true);
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

  it('모든 override 필드를 동시에 덮어쓸 수 있다', () => {
    const overrides: Partial<ResizePerformanceOptions> = {
      concurrency: 5,
      timeout: 25,
      useCanvasPool: false,
      memoryLimitMB: 300,
    };

    const config = getPerformanceConfig('balanced', overrides);

    expect(config.concurrency).toBe(5);
    expect(config.timeout).toBe(25);
    expect(config.useCanvasPool).toBe(false);
    expect(config.memoryLimitMB).toBe(300);
  });

  it('quality 프로파일에 override를 적용한다', () => {
    const config = getPerformanceConfig('quality', {
      concurrency: 2,
      timeout: 45,
    });

    expect(config.concurrency).toBe(2);
    expect(config.timeout).toBe(45);
    expect(config.memoryLimitMB).toBe(512);
    expect(config.useCanvasPool).toBe(true);
  });

  it('balanced 프로파일이 default 프로파일인지 검증한다', () => {
    const defaultConfig = getPerformanceConfig();
    const explicitBalancedConfig = getPerformanceConfig('balanced');

    expect(defaultConfig.concurrency).toBe(explicitBalancedConfig.concurrency);
    expect(defaultConfig.timeout).toBe(explicitBalancedConfig.timeout);
    expect(defaultConfig.memoryLimitMB).toBe(explicitBalancedConfig.memoryLimitMB);
    expect(defaultConfig.useCanvasPool).toBe(explicitBalancedConfig.useCanvasPool);
  });
});
