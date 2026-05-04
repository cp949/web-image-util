/**
 * 모듈 내부에서 공유하는 보조 함수다.
 */

/** 임의의 throw 값을 사람이 읽을 수 있는 메시지로 변환한다. */
export function toMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
