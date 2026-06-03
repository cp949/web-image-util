/** sample 토큰 최대 길이. 모든 고정 토큰은 32자 이하이며 동적 식별자는 잘라낸다. */
export const MAX_SAMPLE_LENGTH = 32;
/** stage/finding 당 sample 배열 최대 길이. */
export const MAX_SAMPLES_PER_STAGE = 3;

/**
 * sample 토큰을 정규화해 누적한다.
 *
 * 32자를 넘는 토큰은 잘라내고, 이미 담긴 토큰은 중복 추가하지 않으며, 최대 3개까지만 보존한다.
 * dom/css 신호 수집기와 inspectSvg finding 수집이 동일 규칙으로 공유한다.
 */
export function pushCappedSample(samples: string[], sample: string): void {
  if (samples.length >= MAX_SAMPLES_PER_STAGE) return;
  const normalized = sample.length > MAX_SAMPLE_LENGTH ? sample.slice(0, MAX_SAMPLE_LENGTH) : sample;
  if (samples.includes(normalized)) return;
  samples.push(normalized);
}
