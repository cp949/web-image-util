/**
 * 원격 응답에 적용하는 본문 가드를 단일 소유하는 모듈이다.
 *
 * 담당 범위는 abort/타임아웃 결합, 선언된 본문 크기 사전 차단, 스트리밍 바이트 상한과
 * 본문 취소다. 프로토콜 허용 판정은 policy.internal.ts가 소유한다.
 *
 * 디코드 방식만 어댑터로 갈라진다 — 바이너리는 이 모듈의 `readCheckedBlobResponse`,
 * 텍스트는 svg/safety.internal.ts가 `readGuardedResponseStream` 위에 얹는다.
 * 상한 값과 오류 코드는 호출자가 주입하므로 SVG 경로와 일반 소스 경로가 같은 가드를 공유한다.
 *
 * 상한 초과 처리는 두 갈래다. **거부 읽기**(`readGuardedResponseStream` 계열)는 오류를 던지고,
 * **절단 읽기**(`readTruncatedResponsePrefix`)는 상한까지만 읽고 스트림을 취소한다.
 * 앞부분 바이트만 필요한 스니핑 경로가 후자를 쓴다.
 */

import { ImageProcessError } from '../../../types';

/** fetch 중단 핸들 — signal과 리소스 정리 함수를 함께 반환한다. */
export interface FetchAbortHandle {
  signal: AbortSignal | undefined;
  dispose: () => void;
}

/** 본문 크기 상한 초과 시 던질 오류를 만드는 팩토리다. */
export type ExceededErrorFactory = (actualBytes: number) => ImageProcessError;

/** 본문 읽기 실패를 도메인 오류로 감싸는 함수다. 반드시 throw해야 한다. */
export type ReadErrorWrapper = (error: unknown) => never;

/** 가드가 적용된 본문 읽기 옵션이다. */
export interface GuardedBodyOptions {
  /** 최대 허용 바이트 수. 0이면 무제한. */
  maxBytes: number;
  /** 상한 초과 오류 팩토리. */
  createExceededError: ExceededErrorFactory;
  /** 본문 읽기 실패 래퍼. 지정하지 않으면 원본 오류를 그대로 전파한다. */
  wrapReadError?: ReadErrorWrapper;
}

/** 상한 검증을 통과한 본문 바이트다. */
export interface GuardedBodyBytes {
  /** 읽은 순서대로의 본문 청크. */
  chunks: Uint8Array[];
  /** 실제로 읽은 총 바이트 수. */
  bytes: number;
}

/** Blob 어댑터가 받을 수 있는 추가 옵션이다. */
export interface ReadCheckedResponseOptions {
  /** 본문 읽기 실패를 도메인 오류로 감싼다. 지정하지 않으면 원본 오류를 그대로 전파한다. */
  wrapReadError?: ReadErrorWrapper;
}

/** 크기 검증을 통과한 Blob과 실제 바이트 수다. */
export interface CheckedBlobResponse {
  blob: Blob;
  bytes: number;
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

/** 표준 SOURCE_BYTES_EXCEEDED 오류를 만든다. */
function createBytesExceededError(actualBytes: number, maxBytes: number, label: string): ImageProcessError {
  return new ImageProcessError(
    `${label} response size (${actualBytes} bytes) exceeds the maximum allowed (${maxBytes} bytes)`,
    'SOURCE_BYTES_EXCEEDED',
    { details: { actualBytes, maxBytes, label } }
  );
}

/** 스트림 정리 실패가 상한 초과 오류를 가리지 않도록 취소 오류를 삼킨다. */
async function cancelBodyQuietly(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // 크기 초과 오류가 공개 error code로 안정적으로 전달되도록 cancel 실패는 삼킨다.
  }
}

/** reader 취소 실패도 같은 이유로 삼킨다. */
async function cancelReaderQuietly(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // 크기 초과 오류가 공개 error code로 안정적으로 전달되도록 cancel 실패는 삼킨다.
  }
}

/**
 * 응답이 선언한 Content-Length가 상한을 넘으면 본문을 취소하고 오류를 던진다.
 *
 * Content-Length는 힌트일 뿐이므로 헤더가 없거나 숫자가 아니면 검사를 건너뛴다.
 * 실제 상한은 `readGuardedResponseStream`의 누적 바이트 검사가 강제한다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param createExceededError 상한 초과 오류 팩토리
 */
export async function assertDeclaredSizeWithinLimit(
  response: Response,
  maxBytes: number,
  createExceededError: ExceededErrorFactory
): Promise<void> {
  if (maxBytes === 0) return;

  const contentLengthHeader = response.headers.get('content-length');
  if (!contentLengthHeader) return;

  // Number()는 "999999999x" 같은 숫자 접두사+비숫자 접미사에서 NaN을 반환해 검사를
  // 건너뛴다(fail-open). parseInt로 숫자 접두사를 살려 fail-closed를 유지한다.
  const contentLength = Number.parseInt(contentLengthHeader, 10);
  if (!Number.isFinite(contentLength)) return;
  if (contentLength <= maxBytes) return;

  await cancelBodyQuietly(response);
  throw createExceededError(contentLength);
}

/**
 * 응답 Content-Length 헤더가 최대 허용 크기를 초과하면 SOURCE_BYTES_EXCEEDED 오류를 던진다.
 *
 * 초과가 확인되면 본문 스트림을 취소해 남은 바이트를 받지 않는다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 */
export async function checkResponseSize(response: Response, maxBytes: number, label: string): Promise<void> {
  await assertDeclaredSizeWithinLimit(response, maxBytes, (actualBytes) =>
    createBytesExceededError(actualBytes, maxBytes, label)
  );
}

/**
 * 스트림이 없는 응답의 본문을 통째로 읽고, 실패를 어댑터가 지정한 오류로 감싼다.
 *
 * 디코드 API(`response.blob()` / `response.text()`)는 어댑터가 고르므로 읽기 함수를 주입받는다.
 *
 * @param read 본문 전체를 읽는 함수
 * @param wrapReadError 읽기 실패 래퍼. 지정하지 않으면 원본 오류를 그대로 전파한다.
 * @returns 읽은 본문
 */
export async function readWholeBody<T>(read: () => Promise<T>, wrapReadError?: ReadErrorWrapper): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (wrapReadError) wrapReadError(error);
    throw error;
  }
}

/**
 * 응답 본문 스트림을 읽으면서 누적 바이트가 상한을 넘지 않는지 검증한다.
 *
 * 상한을 넘으면 스트림을 취소하고 `createExceededError`가 만든 오류를 던진다.
 * 디코드는 하지 않는다 — 호출자가 Blob 조립이나 텍스트 디코드를 선택한다.
 *
 * @param body 응답 본문 스트림
 * @param options 상한과 오류 조립 방식
 * @returns 상한 검증을 통과한 본문 청크와 실제 바이트 수
 */
export async function readGuardedResponseStream(
  body: ReadableStream<Uint8Array>,
  options: GuardedBodyOptions
): Promise<GuardedBodyBytes> {
  const { maxBytes, createExceededError, wrapReadError } = options;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytes += value.byteLength;
      if (maxBytes > 0 && bytes > maxBytes) {
        await cancelReaderQuietly(reader);
        throw createExceededError(bytes);
      }

      chunks.push(new Uint8Array(value));
    }
  } catch (error) {
    // 상한 초과 오류는 공개 계약이므로 래핑 대상에서 제외한다.
    if (error instanceof ImageProcessError) {
      throw error;
    }
    if (wrapReadError) wrapReadError(error);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return { chunks, bytes };
}

/** 읽은 순서대로의 청크를 하나의 버퍼로 합친다. */
function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

/**
 * 응답 본문 앞부분만 읽고 상한에 도달하면 스트림을 취소한다.
 *
 * 절단 읽기다 — 상한 초과를 오류로 올리지 않는다. 포맷 스니핑처럼 앞부분 바이트만
 * 필요한 경로가 쓴다. 스트림이 없는 응답은 절단할 방법이 없으므로 빈 결과를 반환한다.
 * 본문 전체를 메모리에 올린 뒤 자르면 상한이 의미를 잃기 때문이다.
 *
 * @param response fetch 응답 객체
 * @param byteLimit 읽을 최대 바이트 수. 0 이하면 읽지 않는다.
 * @returns 상한까지만 읽은 본문 앞부분
 */
export async function readTruncatedResponsePrefix(response: Response, byteLimit: number): Promise<Uint8Array> {
  const limit = Math.max(0, byteLimit);
  if (limit === 0 || !response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;

  try {
    while (bytes < limit) {
      const { done, value } = await reader.read();
      if (done) break;

      const remaining = limit - bytes;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : new Uint8Array(value);
      chunks.push(chunk);
      bytes += chunk.byteLength;
    }

    // 상한에 도달했다면 남은 바이트를 받지 않도록 스트림을 끊는다.
    if (bytes >= limit) {
      await cancelReaderQuietly(reader);
    }
  } finally {
    reader.releaseLock();
  }

  return concatChunks(chunks, bytes);
}

/**
 * 원격 바이너리 응답 본문을 읽으면서 실제 바이트 수가 한도를 넘지 않는지 검증한다.
 *
 * @param response fetch 응답 객체
 * @param maxBytes 최대 허용 바이트 수. 0이면 무제한.
 * @param label 오류 메시지에 사용할 레이블
 * @param options 본문 읽기 실패 래핑 방식
 * @returns 크기 검증을 통과한 Blob과 실제 바이트 수
 */
export async function readCheckedBlobResponse(
  response: Response,
  maxBytes: number,
  label: string,
  options: ReadCheckedResponseOptions = {}
): Promise<CheckedBlobResponse> {
  const createExceededError: ExceededErrorFactory = (actualBytes) =>
    createBytesExceededError(actualBytes, maxBytes, label);

  await assertDeclaredSizeWithinLimit(response, maxBytes, createExceededError);

  // 스트림이 없는 응답은 Blob으로 한 번에 읽고 같은 상한을 적용한다.
  if (!response.body) {
    const blob = await readWholeBody(() => response.blob(), options.wrapReadError);
    if (maxBytes > 0 && blob.size > maxBytes) {
      throw createExceededError(blob.size);
    }

    return { blob, bytes: blob.size };
  }

  const { chunks, bytes } = await readGuardedResponseStream(response.body, {
    maxBytes,
    createExceededError,
    wrapReadError: options.wrapReadError,
  });

  const contentType = response.headers.get('content-type') ?? '';
  return { blob: new Blob(chunks as BlobPart[], { type: contentType }), bytes };
}
