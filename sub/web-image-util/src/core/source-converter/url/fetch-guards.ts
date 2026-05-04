/**
 * fetch 호출에 공통으로 적용되는 abort/타임아웃/응답 크기 가드 헬퍼다.
 *
 * 본 모듈은 텍스트(SVG) 응답이 아닌 일반 바이너리 응답 처리에만 책임진다.
 * SVG 응답 검증은 svg/safety.ts를 사용한다.
 */

import { ImageProcessError } from '../../../types';

/** fetch 중단 핸들 — signal과 리소스 정리 함수를 함께 반환한다. */
export interface FetchAbortHandle {
  signal: AbortSignal | undefined;
  dispose: () => void;
}

/**
 * 타임아웃과 사용자 제공 AbortSignal을 결합한 FetchAbortHandle을 반환한다.
 *
 * fetch 완료 후 반드시 handle.dispose()를 호출해 타이머와 이벤트 리스너를 정리해야 한다.
 *
 * @param timeoutMs 타임아웃 밀리초. 0이면 타임아웃을 설정하지 않는다.
 * @param userSignal 사용자가 전달한 외부 AbortSignal (선택)
 * @returns FetchAbortHandle
 */
export function createFetchAbortHandle(timeoutMs: number, userSignal?: AbortSignal): FetchAbortHandle {
  const cleanups: Array<() => void> = [];
  const signals: AbortSignal[] = [];

  if (timeoutMs > 0) {
    // AbortSignal.timeout이 지원되면 사용하고, 그렇지 않으면 직접 구현한다
    if (typeof AbortSignal.timeout === 'function') {
      signals.push(AbortSignal.timeout(timeoutMs));
    } else {
      const controller = new AbortController();
      const timerId = setTimeout(
        () => controller.abort(new DOMException('fetch timed out', 'TimeoutError')),
        timeoutMs
      );
      // fetch 완료 후 타이머 누수를 막기 위해 정리 함수에 등록한다
      cleanups.push(() => clearTimeout(timerId));
      signals.push(controller.signal);
    }
  }

  if (userSignal) {
    signals.push(userSignal);
  }

  const runCleanups = () => {
    for (const fn of cleanups) fn();
  };

  if (signals.length === 0) {
    return { signal: undefined, dispose: runCleanups };
  }
  if (signals.length === 1) {
    return { signal: signals[0], dispose: runCleanups };
  }

  // 여러 신호를 결합한다 — AbortSignal.any가 지원되면 사용한다
  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any(signals), dispose: runCleanups };
  }

  // 폴백: 수동으로 결합한다 — addEventListener 리스너도 정리 대상에 포함한다
  const controller = new AbortController();
  const listenerEntries: Array<{ signal: AbortSignal; listener: () => void }> = [];
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      break;
    }
    const listener = () => controller.abort(sig.reason);
    sig.addEventListener('abort', listener, { once: true });
    listenerEntries.push({ signal: sig, listener });
  }
  cleanups.push(() => {
    for (const { signal: sig, listener } of listenerEntries) {
      sig.removeEventListener('abort', listener);
    }
  });

  return { signal: controller.signal, dispose: runCleanups };
}

/**
 * 응답 Content-Length 헤더가 최대 허용 크기를 초과하면 SOURCE_LOAD_FAILED 오류를 던진다.
 * Content-Length 헤더가 없으면 검사를 건너뛴다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 */
export function checkResponseSize(response: Response, maxBytes: number, label: string): void {
  if (maxBytes === 0) return;

  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) return;

  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength)) return;

  if (contentLength > maxBytes) {
    throw new ImageProcessError(
      `${label} 응답 크기(${contentLength} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
      'SOURCE_LOAD_FAILED'
    );
  }
}

/**
 * 원격 바이너리 응답 본문을 읽으면서 실제 바이트 수가 한도를 넘지 않는지 검증한다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 * @returns 크기 검증을 통과한 Blob
 */
export async function readCheckedBlobResponse(response: Response, maxBytes: number, label: string): Promise<Blob> {
  checkResponseSize(response, maxBytes, label);

  if (!response.body) {
    const blob = await response.blob();
    if (maxBytes > 0 && blob.size > maxBytes) {
      throw new ImageProcessError(
        `${label} 응답 크기(${blob.size} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
        'SOURCE_LOAD_FAILED'
      );
    }

    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (maxBytes > 0 && totalBytes > maxBytes) {
        await reader.cancel();
        throw new ImageProcessError(
          `${label} 응답 크기(${totalBytes} bytes)가 최대 허용 크기(${maxBytes} bytes)를 초과합니다`,
          'SOURCE_LOAD_FAILED'
        );
      }

      chunks.push(new Uint8Array(value));
    }

    const contentType = response.headers.get('content-type') ?? '';
    return new Blob(chunks, { type: contentType });
  } finally {
    reader.releaseLock();
  }
}
