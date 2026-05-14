/**
 * getCachedBrowserCapabilities / getCachedFormatSupport / getOptimalProcessingMode /
 * analyzePerformanceFeatures 캐시 표면 행동을 검증한다.
 *
 * 결정 트리 순수 함수(determineOptimalProcessingMode, analyzePerformanceFeaturesInternal)는
 * 합성 입력으로 각 분기를 직접 검증한다.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  analyzePerformanceFeatures,
  BrowserCapabilityDetector,
  detectBrowserCapabilities,
  detectFormatSupport,
  getCachedBrowserCapabilities,
  getCachedFormatSupport,
  getOptimalProcessingMode,
} from '../../../../src/utils/browser-capabilities';
import {
  analyzePerformanceFeaturesInternal,
  determineOptimalProcessingMode,
} from '../../../../src/utils/browser-capabilities/performance';
import type { BrowserCapabilities } from '../../../../src/utils/browser-capabilities/types';

// 테스트용 BrowserCapabilities 기본값 생성 헬퍼 (모든 플래그 false)
function makeCapabilities(overrides: Partial<BrowserCapabilities> = {}): BrowserCapabilities {
  return {
    offscreenCanvas: false,
    webWorkers: false,
    imageBitmap: false,
    webp: false,
    avif: false,
    transferableObjects: false,
    sharedArrayBuffer: false,
    devicePixelRatio: 1,
    ...overrides,
  };
}

// branch 1 진입에 필요한 4개 플래그 전부 true인 기본값
const ALL_ON = makeCapabilities({
  offscreenCanvas: true,
  webWorkers: true,
  imageBitmap: true,
  transferableObjects: true,
});

describe('determineOptimalProcessingMode — 결정 트리', () => {
  describe('분기 1: offscreen (4개 플래그 모두 true)', () => {
    it('4개 플래그 모두 true이면 offscreen을 반환한다', () => {
      expect(determineOptimalProcessingMode(ALL_ON)).toBe('offscreen');
    });

    it('offscreenCanvas가 false이면 offscreen이 아니고 web-worker가 된다', () => {
      const caps = makeCapabilities({ webWorkers: true, imageBitmap: true, transferableObjects: true });
      // webWorkers && transferableObjects 는 여전히 true → branch 2
      expect(determineOptimalProcessingMode(caps)).toBe('web-worker');
    });

    it('webWorkers가 false이면 main-thread가 된다', () => {
      const caps = makeCapabilities({ offscreenCanvas: true, imageBitmap: true, transferableObjects: true });
      // webWorkers 없으므로 branch 2도 실패
      expect(determineOptimalProcessingMode(caps)).toBe('main-thread');
    });

    it('imageBitmap이 false이면 offscreen이 아니고 web-worker가 된다', () => {
      const caps = makeCapabilities({ offscreenCanvas: true, webWorkers: true, transferableObjects: true });
      // webWorkers && transferableObjects 는 여전히 true → branch 2
      expect(determineOptimalProcessingMode(caps)).toBe('web-worker');
    });

    it('transferableObjects가 false이면 main-thread가 된다', () => {
      const caps = makeCapabilities({ offscreenCanvas: true, webWorkers: true, imageBitmap: true });
      // branch 2도 transferableObjects 없으므로 실패
      expect(determineOptimalProcessingMode(caps)).toBe('main-thread');
    });
  });

  describe('분기 2: web-worker (webWorkers + transferableObjects)', () => {
    it('webWorkers와 transferableObjects만 true이면 web-worker를 반환한다', () => {
      const caps = makeCapabilities({ webWorkers: true, transferableObjects: true });
      expect(determineOptimalProcessingMode(caps)).toBe('web-worker');
    });

    it('webWorkers가 false이면 main-thread가 된다', () => {
      const caps = makeCapabilities({ transferableObjects: true });
      expect(determineOptimalProcessingMode(caps)).toBe('main-thread');
    });

    it('transferableObjects가 false이면 main-thread가 된다', () => {
      const caps = makeCapabilities({ webWorkers: true });
      expect(determineOptimalProcessingMode(caps)).toBe('main-thread');
    });
  });

  describe('분기 3: main-thread (기본값)', () => {
    it('모든 플래그가 false이면 main-thread를 반환한다', () => {
      expect(determineOptimalProcessingMode(makeCapabilities())).toBe('main-thread');
    });
  });
});

describe('analyzePerformanceFeaturesInternal — 필드 파생', () => {
  describe('canUseOffscreenCanvas (offscreenCanvas && webWorkers)', () => {
    it('두 플래그 모두 true이면 true다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ offscreenCanvas: true, webWorkers: true }));
      expect(result.canUseOffscreenCanvas).toBe(true);
    });

    it('offscreenCanvas가 false이면 false다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ webWorkers: true }));
      expect(result.canUseOffscreenCanvas).toBe(false);
    });

    it('webWorkers가 false이면 false다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ offscreenCanvas: true }));
      expect(result.canUseOffscreenCanvas).toBe(false);
    });
  });

  describe('canUseWebWorkers (webWorkers && transferableObjects)', () => {
    it('두 플래그 모두 true이면 true다', () => {
      const result = analyzePerformanceFeaturesInternal(
        makeCapabilities({ webWorkers: true, transferableObjects: true })
      );
      expect(result.canUseWebWorkers).toBe(true);
    });

    it('webWorkers가 false이면 false다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ transferableObjects: true }));
      expect(result.canUseWebWorkers).toBe(false);
    });

    it('transferableObjects가 false이면 false다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ webWorkers: true }));
      expect(result.canUseWebWorkers).toBe(false);
    });
  });

  describe('canUseImageBitmap (imageBitmap 직접 매핑)', () => {
    it('imageBitmap이 true이면 true다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities({ imageBitmap: true }));
      expect(result.canUseImageBitmap).toBe(true);
    });

    it('imageBitmap이 false이면 false다', () => {
      const result = analyzePerformanceFeaturesInternal(makeCapabilities());
      expect(result.canUseImageBitmap).toBe(false);
    });
  });

  describe('recommendedProcessingMode — determineOptimalProcessingMode와 일치', () => {
    it('4개 플래그 모두 true이면 offscreen이다', () => {
      expect(analyzePerformanceFeaturesInternal(ALL_ON).recommendedProcessingMode).toBe('offscreen');
    });

    it('webWorkers + transferableObjects만 true이면 web-worker다', () => {
      const caps = makeCapabilities({ webWorkers: true, transferableObjects: true });
      expect(analyzePerformanceFeaturesInternal(caps).recommendedProcessingMode).toBe('web-worker');
    });

    it('모든 플래그 false이면 main-thread다', () => {
      expect(analyzePerformanceFeaturesInternal(makeCapabilities()).recommendedProcessingMode).toBe('main-thread');
    });
  });
});

describe('캐시 표면 행동', () => {
  // 매 테스트마다 싱글턴 캐시를 초기화해 테스트 간 누수를 막는다
  beforeEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  afterEach(() => {
    BrowserCapabilityDetector.getInstance().clearCache();
  });

  describe('getCachedBrowserCapabilities', () => {
    it('캐시 클리어 직후에는 undefined를 반환한다', () => {
      expect(getCachedBrowserCapabilities()).toBeUndefined();
    });

    it('detectBrowserCapabilities 완료 후에는 BrowserCapabilities 객체를 반환한다', async () => {
      const detected = await detectBrowserCapabilities();
      const cached = getCachedBrowserCapabilities();

      expect(cached).toBeDefined();
      // 비동기 감지 결과와 동일한 필드를 포함해야 한다
      expect(cached).toHaveProperty('offscreenCanvas');
      expect(cached).toHaveProperty('webWorkers');
      expect(cached).toHaveProperty('imageBitmap');
      expect(cached).toHaveProperty('webp');
      expect(cached).toHaveProperty('avif');
      // 감지 결과와 값이 일치해야 한다
      expect(cached).toEqual(detected);
    });

    it('캐시 워밍 후 clearCache 하면 다시 undefined가 된다', async () => {
      await detectBrowserCapabilities();
      expect(getCachedBrowserCapabilities()).toBeDefined();

      BrowserCapabilityDetector.getInstance().clearCache();
      expect(getCachedBrowserCapabilities()).toBeUndefined();
    });
  });

  describe('getCachedFormatSupport', () => {
    it('캐시 클리어 직후에는 두 필드가 존재하고 값이 undefined다', () => {
      const result = getCachedFormatSupport();

      // 반환 객체에 두 키가 항상 존재해야 한다
      expect(result).toHaveProperty('webp');
      expect(result).toHaveProperty('avif');
      expect(result.webp).toBeUndefined();
      expect(result.avif).toBeUndefined();
    });

    it('detectFormatSupport 완료 후에는 두 필드가 boolean으로 채워진다', async () => {
      await detectFormatSupport();
      const result = getCachedFormatSupport();

      // jsdom에서는 실제 디코딩이 실패하므로 값이 아닌 타입만 단정한다
      expect(typeof result.webp).toBe('boolean');
      expect(typeof result.avif).toBe('boolean');
    });
  });

  describe('analyzePerformanceFeatures', () => {
    it('4개 필드를 포함한 PerformanceFeatures 객체를 반환한다', async () => {
      const result = await analyzePerformanceFeatures();

      expect(result).toHaveProperty('canUseOffscreenCanvas');
      expect(result).toHaveProperty('canUseWebWorkers');
      expect(result).toHaveProperty('canUseImageBitmap');
      expect(result).toHaveProperty('recommendedProcessingMode');
    });

    it('처음 3개 필드는 boolean이다', async () => {
      const result = await analyzePerformanceFeatures();

      expect(typeof result.canUseOffscreenCanvas).toBe('boolean');
      expect(typeof result.canUseWebWorkers).toBe('boolean');
      expect(typeof result.canUseImageBitmap).toBe('boolean');
    });

    it('recommendedProcessingMode는 3개 유니온 리터럴 중 하나다', async () => {
      const result = await analyzePerformanceFeatures();

      const VALID_PROCESSING_MODES = new Set(['main-thread', 'web-worker', 'offscreen']);
      expect(VALID_PROCESSING_MODES.has(result.recommendedProcessingMode)).toBe(true);
    });

    it('캐시 워밍 이후 두 번째 호출은 캐시된 capabilities를 재사용한다', async () => {
      await analyzePerformanceFeatures();
      // 1차 호출 후 캐시 객체 참조를 잡아둔다
      const capsBefore = getCachedBrowserCapabilities();
      expect(capsBefore).toBeDefined();

      await analyzePerformanceFeatures();
      // 캐시를 재사용하면 동일 참조를 반환해야 한다.
      // 캐시 읽기 로직이 제거되면 재감지 후 새 객체로 덮어써 참조가 달라져 실패한다.
      expect(getCachedBrowserCapabilities()).toBe(capsBefore);
    });

    it('감지된 capabilities를 내부 매핑 함수에 실제로 넘긴다 (wiring 검증)', async () => {
      // 공개 함수가 감지 결과를 analyzePerformanceFeaturesInternal에 올바르게 전달하는지 확인
      const result = await analyzePerformanceFeatures();
      const cached = getCachedBrowserCapabilities();

      // 캐시에 감지 결과가 있어야 wiring 검증이 의미 있다
      expect(cached).toBeDefined();
      // 공개 함수 출력이 내부 순수 함수에 감지 결과를 직접 넘긴 것과 toEqual이어야 한다
      expect(result).toEqual(analyzePerformanceFeaturesInternal(cached!));
    });
  });

  describe('getOptimalProcessingMode', () => {
    it('3개 유니온 리터럴 중 하나를 반환한다', async () => {
      const mode = await getOptimalProcessingMode();

      const VALID_PROCESSING_MODES = new Set(['main-thread', 'web-worker', 'offscreen']);
      expect(VALID_PROCESSING_MODES.has(mode)).toBe(true);
    });

    it('analyzePerformanceFeatures의 recommendedProcessingMode와 일치한다', async () => {
      // 캐시 워밍 후 두 함수 모두 동일 기반 결과를 사용한다
      const perf = await analyzePerformanceFeatures();
      const mode = await getOptimalProcessingMode();

      expect(mode).toBe(perf.recommendedProcessingMode);
    });
  });
});
