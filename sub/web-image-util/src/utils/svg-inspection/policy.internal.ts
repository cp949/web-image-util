/**
 * svg-inspection 신호 수집기의 참조 판정 정책.
 *
 * lightweight는 렌더링 guard가 실제로 제거/치환하는 명시적 외부 URL만 센다.
 * strict는 내부 fragment(`#id`)와 단계 위임 대상(`data:`)을 제외한 모든 참조를 제거 대상으로 센다.
 */
export type SvgInspectionPolicy = 'lightweight' | 'strict';
