# 바이트 시그니처 판정 통합 설계

## 배경

매직바이트로 이미지 포맷을 판정하는 구현이 두 곳에 독립적으로 존재한다.

- `src/core/source-converter/loaders/blob.internal.ts:19` `detectMimeTypeFromBuffer(buffer): string` — MIME 문자열을 반환. PNG/JPEG/WebP/GIF/BMP/TIFF/ICO 시그니처 + SVG 텍스트 스니핑을 검사하고 기본값 `'image/png'`로 떨어진다.
- `src/utils/image-info/format-detection.internal.ts:33` `formatFromBytes(bytes): ImageInfo['format']` — PNG/JPEG/WebP/GIF/AVIF 시그니처를 검사하고 기본값 `'unknown'`으로 떨어진다.

겹치는 4개 포맷(PNG/JPEG/WebP/GIF)도 구현이 다르다. GIF 검사가 한쪽은 `String.fromCharCode(...bytes.slice(0,3))` 문자열 비교, 한쪽은 raw byte 비교다 — 같은 질문에 다른 코드 경로가 다시 쓰였다.

지원 포맷 집합이 갈린다.

| 시그니처 | blob loader | image-info |
| --- | --- | --- |
| PNG/JPEG/WebP/GIF | ✓ | ✓ |
| AVIF | ✗ | ✓ |
| BMP/TIFF/ICO | ✓ | ✗ |

### 확인된 버그: AVIF `ArrayBuffer`/`Uint8Array` 입력이 `image/png`로 오판정된다

`detectMimeTypeFromBuffer`는 `src/core/source-converter/index.ts:54`(`arrayBuffer` 소스 타입)와 `:66`(`uint8Array` 소스 타입)에서만 호출된다. AVIF 바이트는 이 함수의 시그니처 검사 어디에도 걸리지 않고 마지막 `return 'image/png'`로 떨어진다. 이 결과로 만든 `new Blob([...], { type: 'image/png' })`가 실제 디코드 경로에 그대로 들어간다.

`tests/unit/processor/source-converter-blob-jsdom.test.ts:81-166`의 `detectMimeTypeFromBuffer` 특성화 테스트 12개 중 AVIF 케이스는 없다 — 이 경로는 현재 테스트로 보호되지 않는다.

### BMP/TIFF/ICO는 버그가 아니라 타입 경계다

공개 `ImageFormat`(`src/types/base.ts:36`)은 `'jpeg' | 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'svg'`다. BMP/TIFF/ICO가 없다. `formatFromBytes`가 이 셋을 판정하지 못하는 건 결함이 아니라 반환 타입이 애초에 그 값을 표현할 수 없기 때문이다. 시그니처 **표**는 합치되, 표현 불가능한 값을 `'unknown'`으로 접는 투영은 소비자(`format-detection.internal.ts`)에 남긴다.

### SVG 텍스트 스니핑은 이 판정의 대상이 아니다

`blob.internal.ts:82-90`의 SVG 처리는 매직바이트 검사가 아니라 `TextDecoder`로 디코드한 뒤 `isInlineSvg()`로 패턴을 확인하는 텍스트 판정이다. 이미 같은 일을 하는 `sniffSvgFromBlob()`(`src/utils/svg-detection.ts:122`)과 `DEFAULT_SVG_SNIFF_BYTES`(`src/utils/source-utils/source-facts.internal.ts:16`)가 있는데도, `blob.internal.ts`는 `Math.min(bytes.length, 4096)`로 예산을 다시 하드코딩하고 텍스트 디코드를 자체 구현한다. `sniffSvgFromBlob()`은 `Blob`을 받아 `.text()`로 읽으므로 이미 `Uint8Array`로 풀린 `blob.internal.ts`가 그대로 재사용할 수는 없지만, 예산 상수와 `isInlineSvg()`(이미 import 중)는 재사용할 수 있다.

### "4096" 6곳은 실제로 두 그룹이고, 진짜 중복은 그중 한쪽뿐이다

```
grep -rn "4096" src/ | grep -v test
```

| 위치 | 그룹 | 비고 |
| --- | --- | --- |
| `source-utils/source-facts.internal.ts:16` | SVG 스니핑 예산 | `DEFAULT_SVG_SNIFF_BYTES` 정본으로 선언되어 있으나, 정작 자신이 감싸는 `sniffSvgFromBlob()`은 이 상수를 쓰지 않는다 |
| `svg-detection.ts:122` | SVG 스니핑 예산 | `sniffSvgFromBlob(blob, bytes = 4096)` — 위 상수를 쓰지 않고 리터럴을 다시 선언한 진짜 중복 |
| `source-utils/types.ts:58` | SVG 스니핑 예산 | JSDoc, "기본값은 4096" |
| `loaders/blob.internal.ts:83` | SVG 스니핑 예산 | `Math.min(bytes.length, 4096)` — 예산 재구현 |
| `image-info/remote-fetch.internal.ts:34` | 원격 fetch 포맷 스니핑 예산 | `DEFAULT_FORMAT_SNIFF_BYTES` 정본, 유일한 소비자가 이 파일 자신 |
| `image-info/types.ts:24` | 원격 fetch 포맷 스니핑 예산 | JSDoc |

두 그룹은 관심사가 다르다 — 한쪽은 메모리에 이미 있는 바이트/Blob을 얼마나 스니핑할지, 다른 쪽은 네트워크 응답을 얼마나 읽고 끊을지(`MAX_SNIFF_BYTES = 64 * 1024` 상한과 함께)다. 값이 우연히 같을 뿐 합칠 이유가 없다. 정리 대상은 **SVG 스니핑 예산 그룹뿐**이다 — `source-facts.internal.ts`가 상수를 소유하지만 실제로 그 값을 쓰는 함수(`sniffSvgFromBlob`)는 반대 방향에 있어 자기 리터럴을 다시 쓸 수밖에 없었다.

## 결정

바이트 시그니처 판정을 leaf 함수 하나로 올린다. 소비자별 폴백(로더는 `'image/png'`, 진단 API는 `'unknown'` 그대로)은 각자 투영으로 남긴다. `src/utils/source-utils/blob-projection.internal.ts`의 `resolveMimeFirstBlobFormat`이 이미 쓰는 facts/projection 분리를 그대로 따른다.

SVG 텍스트 스니핑은 이 판정과 다른 축이므로 facts 함수 밖에 남기되, 예산 상수의 소유권을 실제로 스니핑을 수행하는 leaf(`svg-detection.ts`)로 옮겨 중복을 없앤다.

## 모듈 계약

새 파일 `src/utils/source-utils/byte-signature.internal.ts`.

```ts
export type ByteSignatureFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'bmp' | 'tiff' | 'ico' | 'unknown';

export function detectFormatFromBytes(bytes: Uint8Array): ByteSignatureFormat;
```

시그니처 판정 로직은 기존 두 함수의 합집합을 raw byte 비교로 통일한다(GIF의 `String.fromCharCode` 제거). 검사 순서: PNG → JPEG → WebP → GIF → AVIF → BMP → TIFF → ICO → `'unknown'`.

이 순서는 결과에 영향을 준다 — AVIF와 ICO 사이에 실제 충돌이 있다. ISO-BMFF `ftyp` 박스의 4바이트 크기 필드가 `0x00000100`(10진수 256, 합법적인 박스 크기)이면 그 파일의 0~3바이트가 `00 00 01 00`이 되어 ICO 시그니처와 그대로 겹친다. 구현은 AVIF를 BMP/TIFF/ICO보다 먼저 검사해 이 충돌에서 AVIF를 올바르게 고른다. 이 순서 의존성은 `tests/unit/utils/byte-signature.test.ts`의 특성화 테스트로 고정되어 있다.

## 소비자 투영

**`format-detection.internal.ts`의 `formatFromBytes`** — `bmp`/`tiff`/`ico`/`unknown`은 `'unknown'`으로 접고, 나머지는 그대로 반환한다(리터럴 값이 `ImageFormat`과 같다). 반환 타입 `ImageInfo['format']`은 바뀌지 않는다.

```ts
export function formatFromBytes(bytes: Uint8Array): ImageInfo['format'] {
  const format = detectFormatFromBytes(bytes);
  switch (format) {
    case 'bmp':
    case 'tiff':
    case 'ico':
    case 'unknown':
      return 'unknown';
    default:
      return format;
  }
}
```

**`blob.internal.ts`의 `detectMimeTypeFromBuffer`** — `bmp`/`tiff`/`ico`는 로컬 맵으로 MIME을 직접 투영하고, 나머지 판정된 포맷은 기존 `formatToMimeType()`(`src/utils/format-utils.ts:45`, `ImageFormat | OutputFormat → string`)을 재사용한다. `formatToMimeType`은 매핑 실패 시 이미 `'image/png'`로 떨어지므로 최종 기본값 정책과도 맞는다. `unknown`이면 SVG 텍스트 스니핑을 시도하고, 그래도 아니면 `'image/png'`.

```ts
export function detectMimeTypeFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const format = detectFormatFromBytes(bytes);

  // bmp/tiff/ico는 공개 ImageFormat이 표현하지 못해 formatToMimeType에 넘길 수 없다 —
  // switch 분기로 좁혀야 default 절의 format이 ImageFormat 부분집합으로 타입체크된다.
  switch (format) {
    case 'bmp':
      return 'image/bmp';
    case 'tiff':
      return 'image/tiff';
    case 'ico':
      return 'image/x-icon';
    case 'unknown':
      break;
    default:
      return formatToMimeType(format);
  }

  // 바이너리 시그니처가 없더라도 실제 SVG XML이면 보안 경로를 타도록 본문 앞부분을 스니핑한다.
  try {
    const sniffLength = Math.min(bytes.length, DEFAULT_SVG_SNIFF_BYTES);
    const decodedHead = new TextDecoder().decode(bytes.subarray(0, sniffLength));
    if (isInlineSvg(decodedHead)) {
      return 'image/svg+xml';
    }
  } catch {
    // 텍스트 디코딩 실패는 비-SVG 후보로 간주하고 기존 기본값으로 폴백한다.
  }

  return 'image/png';
}
```

이 이관이 AVIF 버그를 고친다 — `format`이 `'avif'`면 `default` 분기의 `formatToMimeType('avif')`가 `'image/avif'`를 반환한다. 객체 조회(`map[format]`)로 raw 컨테이너를 갈랐다면 TypeScript가 그 조회로 `format`을 좁히지 못해 `formatToMimeType(format)` 호출이 타입체크를 통과하지 못한다 — `switch`의 리터럴 분기여야 `default` 절에서 `format`이 `'png'|'jpeg'|'webp'|'gif'|'avif'`로 좁혀진다.

## SVG 스니핑 예산 정리

`DEFAULT_SVG_SNIFF_BYTES`의 소유권을 `source-facts.internal.ts`(소비자)에서 `svg-detection.ts`(실제로 스니핑을 수행하는 leaf)로 옮긴다.

이유: `source-facts.internal.ts`는 `sniffSvgFromBlob`을 `svg-detection.ts`에서 import하는 방향이다(`import { isInlineSvg, sniffSvgFromBlob } from '../svg-detection'`). 상수가 지금처럼 소비자 쪽에 있으면 `svg-detection.ts`는 자기 함수의 기본 파라미터 값을 상수 import 없이 리터럴로 다시 쓸 수밖에 없다 — 반대로 import하면 순환 참조가 된다. 상수를 leaf로 옮기고 `sniffSvgFromBlob(blob, bytes = DEFAULT_SVG_SNIFF_BYTES)`로 자기 상수를 쓰게 하면, `source-facts.internal.ts`와 `blob.internal.ts`(이미 `isInlineSvg`를 이 모듈에서 import 중) 둘 다 같은 곳에서 값을 가져온다.

`source-facts.internal.ts`는 기존 소비자(`detect.internal.ts`가 `from './source-facts.internal'`로 import)가 깨지지 않도록 재수출한다.

```ts
export { DEFAULT_SVG_SNIFF_BYTES } from '../svg-detection';
```

## 테스트 계약

- 이관 전 특성화 기준선: `detectMimeTypeFromBuffer` 12개(`tests/unit/processor/source-converter-blob-jsdom.test.ts:81-166`), `formatFromBytes` 5개(`tests/unit/utils/image-info/get-image-format.test.ts:75-105`, `163-176`)가 이관 전후 값 그대로 통과해야 한다.
- 신규 RED 테스트: AVIF `ArrayBuffer`/`Uint8Array`가 `'image/avif'`로 판정된다 — 현재 `'image/png'`로 오판정되는 버그의 회귀 방지선. `detectMimeTypeFromBuffer` 특성화 테스트에 추가한다.
- 신규 facts 테스트: `tests/unit/utils/byte-signature.test.ts` — `detectFormatFromBytes`를 9개 값(8개 포맷 + `unknown`) 전수로 고정한다.
- `source-facts.internal.ts`/`detect.internal.ts`/`svg-detection.ts` 관련 기존 테스트가 재수출 이후에도 그대로 통과해야 한다.

## 문서 계약

- `docs/architecture.md` 핵심 모듈 표에 `source-facts.internal.ts` 행 바로 아래로 행을 추가한다.
- `CONTEXT.md`에 「바이트 시그니처 판정」 도메인 용어를 추가한다.

## 비범위

- **image-info의 Blob 경로가 SVG 본문 텍스트 스니핑을 하지 않는 갭.** `formatFromBytes`는 SVG를 판정하지 않으므로, MIME과 파일명 힌트가 전혀 없는 Blob이 실제로는 SVG 본문이어도 `getImageFormat()`은 `'unknown'`으로 떨어진다(`detectImageFormat()`의 Blob 분기, `format-detection.internal.ts:107-115`). 실사에서 발견했지만 이 카드가 다루는 "표 두 벌이 다른 답을 낸다"와는 다른 문제("답이 아예 없다")라 별도로 다룬다.
- `remote-fetch.internal.ts`의 `DEFAULT_FORMAT_SNIFF_BYTES`/`MAX_SNIFF_BYTES`(네트워크 응답 프리픽스 예산)는 손대지 않는다. 값이 우연히 같을 뿐 관심사가 다르다.
- BMP/TIFF/ICO를 공개 `ImageFormat` 타입에 추가하지 않는다. 타입 확장은 이 설계와 별도로 결정한다.
- 브라우저가 판정된 포맷을 실제로 디코드할 수 있는지는 다루지 않는다. 시그니처 판정과 디코드 가능 여부는 별개다 — AVIF 시그니처가 맞아도 구형 브라우저는 디코드에 실패할 수 있다. 이 갭은 `image-decode.internal.ts`(어댑터가 실패를 던지고 모듈이 `ImageProcessError`로 래핑)가 이미 담당한다.

## 재검토 조건

- 새 facts 테이블이 기존 특성화 테스트(17개) 중 하나라도 다른 답을 내면 등가성 주장이 틀린 것이다 — 테스트가 아니라 구현을 고친다.
- BMP/TIFF/ICO 지원 요청이 실제로 들어오면 `ImageFormat` 타입 확장을 이 설계와 별도로 논의한다.
- image-info Blob 경로의 SVG 텍스트 스니핑 갭을 메울 필요가 생기면, `sniffBlobSvgIfCandidate`를 그 경로에 연결할지 별도 설계로 다룬다.
