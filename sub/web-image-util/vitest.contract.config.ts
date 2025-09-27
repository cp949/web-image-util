import { defineConfig } from 'vitest/config'
import { mergeConfig, sharedConfig, testTypeConfigs } from './tests/vitest.shared.config'

/**
 * 계약 테스트 전용 Vitest 설정
 *
 * 목적: Node.js 환경에서 브라우저 API 계약 검증
 * 특징: 실제 브라우저 API 없이 모킹을 통한 계약 테스트
 * 범위: API 호출 패턴, 매개변수 검증, 표준 준수
 */
export default defineConfig(
  mergeConfig(sharedConfig, {
    ...testTypeConfigs.contract,
    test: {
      ...testTypeConfigs.contract.test,

      // 계약 테스트 특화 설정
      exclude: [
        ...sharedConfig.test?.exclude || [],
        'tests/integration/**', // 통합 테스트 제외 (브라우저 필요)
        'tests/unit/**', // 단위 테스트 제외 (별도 실행)
        'tests/performance/**' // 성능 테스트 제외
      ],

      // 리포터 설정 (계약 테스트 결과 추적)
      reporter: ['verbose', 'json'],
      outputFile: {
        json: 'test-results/contract-test-results.json',
      },

      // 커버리지 리포터에 HTML 추가 (상세 분석용)
      coverage: {
        ...testTypeConfigs.contract.test?.coverage,
        reporter: ['text', 'json', 'html']
      }
    }
  })
)