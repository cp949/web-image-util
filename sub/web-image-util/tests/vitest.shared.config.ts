import type { ViteUserConfig } from 'vitest/config';

/**
 * Vitest 공통 설정
 *
 * 이 파일은 모든 Vitest 설정 파일에서 공유되는 기본 설정을 제공합니다.
 */

// 기본 공통 설정
export const sharedConfig: ViteUserConfig = {
  test: {
    // 기본 환경 설정
    globals: true,

    // 타임아웃 설정
    testTimeout: 10000,
    hookTimeout: 5000,

    // 기본 리포터
    reporters: ['verbose'],

    // 기본 제외 패턴
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],

    // 에러 발생 시 상세 정보 표시
    printConsoleTrace: true,

    // 파일 변경 감지는 vitest watch 모드에서 자동 처리됨
  },

  // 모듈 해상도 설정
  resolve: {
    alias: {
      '@': './src',
      '@tests': './tests',
    },
  },
};

// 테스트 타입별 기본 설정
export const testTypeConfigs = {
  // 단위 테스트 기본 설정
  unit: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },

  // 계약 테스트 기본 설정
  contract: {
    environment: 'node',
    include: ['tests/contract/**/*.test.ts'],
    setupFiles: ['tests/setup/wsl-mocks.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  },

  // 통합 테스트 기본 설정
  integration: {
    environment: 'happy-dom',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup/wsl-mocks.ts'],
    testTimeout: 15000,
  },

  // 성능 테스트 기본 설정
  performance: {
    environment: 'node',
    include: ['tests/performance/**/*.test.ts'],
    testTimeout: 30000,
  },

  // WSL 환경 설정
  wsl: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/contract/**/*.test.ts'],
    setupFiles: ['tests/setup/wsl-mocks.ts'],
    threads: false, // WSL에서 안정성을 위해
    testTimeout: 15000,
  },
};

// 설정 병합 유틸리티
export function mergeConfig(base: ViteUserConfig, override: ViteUserConfig): ViteUserConfig {
  return {
    ...base,
    test: {
      ...base.test,
      ...override.test,
      // 배열 속성들은 덮어쓰기가 아닌 병합
      include: override.test?.include || base.test?.include,
      exclude: [...(base.test?.exclude || []), ...(override.test?.exclude || [])],
      setupFiles: [...(base.test?.setupFiles || []), ...(override.test?.setupFiles || [])],
      // 커버리지 설정 병합
      coverage: override.test?.coverage || base.test?.coverage,
    },
    resolve: {
      ...base.resolve,
      ...override.resolve,
      alias: {
        ...base.resolve?.alias,
        ...override.resolve?.alias,
      },
    },
  };
}

// 기본 내보내기
export default sharedConfig;
