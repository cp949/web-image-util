import {
  HighResolutionManager,
  type HighResolutionOptions,
  type HighResolutionProgress,
  type ProcessingResult,
} from '../../base/high-res-manager';

export type { HighResolutionOptions, HighResolutionProgress, ProcessingResult };

/**
 * 내부 고해상도 처리기 호환 래퍼.
 *
 * 실제 구현은 공개 고해상도 처리기와 동일하게 유지해 중복 전략 로직이
 * 서로 갈라지는 회귀를 막는다. 동일 객체로 재수출해 기존 테스트와 호출자가
 * static 메서드를 spy/mock 할 때도 같은 구현 지점을 바라보게 한다.
 *
 * @internal 이 값은 공개 API가 아니며 SmartProcessor 내부 경로에서 사용한다.
 */
export { HighResolutionManager as InternalHighResProcessor };
