# 이미지 디코드 seam 설계

## 배경

`HTMLImageElement`에 소스를 붙이고 로드 완료를 기다리는 코드가 10곳에 각자 존재한다. 각 사본은 같은 규칙 — `onload`/`onerror` 등록, 결정 시점의 핸들러 해제, objectURL revoke, `ImageProcessError` 래핑 — 을 다시 쓴다.

`src/utils/image-loader.internal.ts`의 `loadImageElement()`가 이 규칙을 이미 담고 있지만 프로덕션 호출처는 `src/types/result-conversion-helpers.internal.ts` 한 곳뿐이다. 모듈은 있고 채택이 안 됐다.

중복의 대가는 이미 드러나 있다.

- `src/core/source-converter/index.ts:43` (element 분기) — `onload`/`onerror`를 해제하지 않는다. 핸들러 누수.
- `src/utils/converters/canvas-bridge.internal.ts:74` (`getBlobDimensions`) — 같은 누수.
- `src/core/source-converter/svg/loader.internal.ts:155` — `img.crossOrigin`을 `img.src` 할당 후 같은 동기 블록에서 설정한다. "이미지 데이터 갱신"은 마이크로태스크로 큐잉되므로 CORS 설정 자체는 fetch 시점에 이미 반영되지만, 이 순서는 갱신을 한 번 더 큐잉시켜 첫 non-CORS 요청이 캐시를 오염시키고 뒤이은 CORS 요청이 실패하는 함정을 유발한다.
- `src/core/source-converter/svg/loader.internal.ts:97` — 디코드를 우회할 seam이 없어 테스트 전용 전역 `globalThis._SVG_MOCK_MODE` 분기가 프로덕션 구현 안에 산다.
- `src/core/source-converter/url/loader.internal.ts` — 전용 테스트가 없다. 디코드가 인라인이라 진입점이 없다.

## 결정

디코드를 단일 소유 모듈로 만들고, 로드 완료까지 img를 구동하는 방식만 주입형 adapter로 가른다. 모든 디코드 호출처는 이 모듈의 인터페이스만 안다.

이 결정은 `src/core/source-converter/url/fetch-guards.internal.ts`가 원격 본문 가드에 대해 취한 형태와 같다. 정책은 모듈이 소유하고, 갈리는 부분만 adapter로 뺀다.

## 모듈 계약

`src/utils/image-loader.internal.ts`를 `src/utils/image-decode.internal.ts`로 옮기고 깊게 만든다. 기존 `loadImageElement()`는 흡수되어 사라진다.

```ts
export interface ImageDecodeOptions {
  /** 로드 실패 시 던질 오류 코드. 기본값을 두지 않는다. */
  errorCode: ImageErrorCodeType;
  /** 오류 메시지. 생략 시 'Image loading failed'. */
  message?: string;
  crossOrigin?: string;
  decoding?: 'async' | 'sync' | 'auto';
  /** Blob 변형에서 createObjectURL 실패 시 쓸 코드. 생략 시 errorCode. */
  objectUrlErrorCode?: ImageErrorCodeType;
}

export function decodeImageFromUrl(src: string, options: ImageDecodeOptions): Promise<HTMLImageElement>;
export function decodeImageFromBlob(blob: Blob, options: ImageDecodeOptions): Promise<HTMLImageElement>;
export function decodeExistingImage(img: HTMLImageElement, options: ImageDecodeOptions): Promise<HTMLImageElement>;
```

`errorCode`에 기본값을 두지 않는 이유는 `loadImageFromUrl()`의 `transport` 매개변수와 같다. 새 호출자가 인자를 빠뜨렸을 때 오류 코드가 조용히 다른 값으로 떨어지는 대신 컴파일 타임에 드러난다.

모듈이 소유하는 것:

- img 생성 — `src/utils/image-element.internal.ts`의 `createImageElement()`를 경유한다.
- `crossOrigin`과 `decoding` 속성 설정. **`src` 할당 전에** 설정한다.
- objectURL 생성과 revoke. 성공·실패와 무관하게 revoke한다.
- 실패를 `ImageProcessError`로 래핑. 코드와 메시지는 호출자가 주입한다.

`decodeExistingImage()`는 `img.complete && img.naturalWidth > 0`이면 대기 없이 즉시 반환한다. 이미 로드된 element에 핸들러를 붙이지 않는다.

## adapter seam

adapter가 소유하는 유일한 책임은 **"img를 로드 완료 상태까지 구동한다"**이다. 핸들러 등록·해제와 `src` 할당이 여기 들어간다.

```ts
export interface ImageDecodeAdapter {
  decode(img: HTMLImageElement, src: string): Promise<void>;
}

export function setImageDecodeAdapter(adapter: ImageDecodeAdapter): void;
export function resetImageDecodeAdapter(): void;
```

기본 adapter는 브라우저 디코드다. 핸들러 해제 규칙은 이 adapter 한 곳에만 있으므로 누수 규칙의 단일 출처는 유지된다.

adapter는 실패 원인만 던진다. `ImageProcessError` 조립은 모듈이 한다. 그래야 `errorCode`와 `message`가 adapter마다 갈리지 않는다.

`setImageDecodeAdapter()`/`resetImageDecodeAdapter()`는 테스트가 쓰는 진입점이며 `.internal` 모듈에만 존재한다. 공개 표면에 export하지 않는다.

## 호출처 이관

10곳을 이관한다. "동작 변화" 열은 각 이관이 만드는 관찰 가능한 차이다.

| 위치 | 호출 | 동작 변화 |
| --- | --- | --- |
| `core/source-converter/loaders/blob.internal.ts:112` | `decodeImageFromBlob` | 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/loaders/canvas.internal.ts:12` | `decodeImageFromUrl` | 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/url/loader.internal.ts:76` | `decodeImageFromBlob` | 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/url/loader.internal.ts:119` | `decodeImageFromUrl` | 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/url/loader.internal.ts:198` | `decodeImageFromBlob` | 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/svg/loader.internal.ts:97` | 삭제 | `_SVG_MOCK_MODE` 분기 제거 |
| `core/source-converter/svg/loader.internal.ts:155` | `decodeImageFromBlob` / `decodeImageFromUrl` | `crossOrigin`을 `src`보다 먼저 설정해 중복 이미지 데이터 갱신을 막는다. 로드 실패 오류에 `cause` 추가 |
| `core/source-converter/index.ts:43` | `decodeExistingImage` | 핸들러 해제 추가 — 누수 수정. 로드 실패 오류에 `cause` 추가 |
| `core/output-pipeline.internal.ts:428` | `decodeImageFromBlob` | `onload` 내부 이중 `try`/`catch` 제거. 로드 실패 오류에 `cause` 추가 |
| `utils/converters/canvas-bridge.internal.ts:74` | `decodeImageFromBlob` | 핸들러 해제 추가 — 누수 수정. `Error` → `ImageProcessError`. 로드 실패 오류에 `cause` 추가 |

오류 메시지는 `message` 옵션으로 현행을 유지한다. `Failed to load image: ${url}`처럼 입력을 담은 메시지가 진단에 쓰이므로 통합하지 않는다.

`canvas-bridge.internal.ts:74`는 메시지 `'Unable to read Blob size information'`을 유지한다. `tests/unit/utils/converters-canvas-bridge-policy.test.ts:400`이 이 문자열을 단언한다. 오류 타입만 `ImageProcessError`로 바뀐다.

`output-pipeline.internal.ts:428`의 `objectUrlErrorCode`는 `'OUTPUT_FAILED'`를 유지한다. 로드 실패는 `'IMAGE_LOAD_FAILED'`로 갈린 채 남는다. `onload` 콜백을 감싼 이중 `try`/`catch`는 제거한다 — 핸들러 해제와 revoke는 throw하지 않는다.

SVG 로더의 Blob URL·Base64 선택(50KB 임계)과 Blob 생성 실패 시 Base64 폴백은 `svg/loader.internal.ts`에 남긴다. 디코드 방식이 아니라 SVG 렌더 정책이다.

## 테스트 계약

- `tests/unit/utils/image-loader.test.ts`를 `image-decode.test.ts`로 재작성한다. 세 진입점의 성공·실패 경로, objectURL revoke 계약, 핸들러 해제 계약, `decodeExistingImage()`의 즉시 반환 분기를 덮는다.
- `_SVG_MOCK_MODE`를 쓰는 두 파일을 adapter 주입으로 바꾼다.
  - `tests/unit/processor/source-converter-timer.test.ts`
  - `tests/unit/core/source-converter-failure-jsdom.test.ts`

  `setImageDecodeAdapter(fake)`를 `beforeEach`에, `resetImageDecodeAdapter()`를 `afterEach`에 둔다.
- `tests/unit/core/source-converter-failure-jsdom.test.ts`의 `stubImgCreation()` 하네스는 adapter로 대체 가능한 케이스부터 줄인다. `document.createElement` 자체를 검증하는 케이스는 남긴다.
- `src/core/source-converter/url/loader.internal.ts` 전용 테스트를 신규 작성한다. 현재 전용 테스트가 0이다.

구현은 TDD로 진행한다. 디코드 모듈 테스트를 먼저 쓰고, 호출처 이관은 기존 테스트가 회귀 검증한다.

## 문서 계약

- `docs/architecture.md` — "이미지 디코드" 절을 신설한다. "SVG 입력 fetch 정책" 절이 `fetch-guards.internal.ts`를 기술한 형식을 따라 단일 소유 모듈과 adapter seam을 적는다.
- `CONTEXT.md` — 도메인 용어에 「이미지 디코드」와 「디코드 어댑터」를 올린다.

## 비범위

- `src/utils/browser-capabilities/format-detection.internal.ts:62`와 `:100`의 포맷 지원 프로브는 이관하지 않는다. 실패 시 reject하지 않고 `resolve(false)`하며 자체 `setTimeout` 상한을 갖는다. 오류 계약이 다르므로 같은 모듈에 넣으면 인터페이스가 두 계약을 동시에 지원해야 한다.
- 공개 API 표면은 바뀌지 않는다. 이관 대상이 전부 `.internal` 모듈이다.
- 디코드 타임아웃은 도입하지 않는다. 현재 어느 호출처도 갖고 있지 않다.
- `svg/loader.internal.ts`의 SVG 렌더 정책(품질 판정, 크기 추출, 호환성 보정)은 건드리지 않는다.

## 재검토 조건

`browser-capabilities`의 프로브가 오류 계약을 reject 방식으로 통일하게 되면 디코드 모듈로 이관할지 다시 본다.

디코드 타임아웃이 필요해지면 `createFetchAbortHandle()`과 같은 형태로 모듈에 추가한다. adapter가 아니라 모듈이 소유해야 한다 — 타임아웃은 정책이고 adapter는 구동 방식만 가른다.
