# ensure 변환 API 설계

## 배경

기존 `convertToDataURL()`은 입력이 `Blob`이면 `FileReader.readAsDataURL()` 경로를 바로 사용한다. 이 경로는 원본 Blob을 Data URL로 감싸는 동작이라서 `{ format, quality }` 출력 옵션을 적용하지 않는다. 함수 이름과 옵션 시그니처만 보면 사용자는 포맷 변환이나 품질 조정이 일어난다고 기대할 수 있으므로, 현재 계약은 모호하다.

기존 `convertXxx()` 계열은 이미 공개 API로 사용처가 있으므로 제거하거나 의미를 급격히 바꾸지 않는다. 대신 목표 타입을 보장하고, 변환이 필요한 경우 출력 옵션을 명확히 적용하는 `ensureXxx()` 계열을 추가한다.

## 목표

- `convertXxx()` 계열은 호환성을 위해 유지한다.
- `ensureXxx()` 계열을 새 공개 API로 추가한다.
- `isDataURLString()`을 공개 API로 제공한다.
- 새 API는 "이미 목표 형태이면 보존하고, 변환이 필요하면 명시한 옵션으로 인코딩한다"는 계약을 가진다.
- `quality: 0`은 유효한 명시값으로 유지한다.

## 공개 API

```typescript
export function isDataURLString(value: unknown): value is string;

export async function ensureDataURL(
  source: ImageSource | HTMLCanvasElement,
  options?: EnsureDataURLOptions
): Promise<string>;

export async function ensureDataURLDetailed(
  source: ImageSource | HTMLCanvasElement,
  options?: EnsureDataURLDetailedOptions
): Promise<ResultDataURL>;

export async function ensureBlob(
  source: ImageSource | HTMLCanvasElement,
  options?: EnsureBlobOptions
): Promise<Blob>;

export async function ensureBlobDetailed(
  source: ImageSource | HTMLCanvasElement,
  options?: EnsureBlobDetailedOptions
): Promise<ResultBlob>;

export async function ensureFile(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options?: EnsureFileOptions
): Promise<File>;

export async function ensureFileDetailed(
  source: ImageSource | HTMLCanvasElement,
  filename: string,
  options?: EnsureFileDetailedOptions
): Promise<ResultFile>;
```

옵션 타입은 기존 `ConvertToXxxOptions`와 같은 구조를 따른다. 기존 타입을 그대로 재사용할 수 있으면 alias로 시작하고, 문서상 의미만 새 계약에 맞게 설명한다.

## 동작 계약

### `isDataURLString()`

입력값이 문자열이고 Data URL 형태이면 `true`를 반환한다. 첫 구현은 `data:` 스킴 검사에 집중한다. 이 함수는 이미지 Data URL뿐 아니라 일반 Data URL도 판정할 수 있다. `ensureDataURL()`의 보존 조건과 같은 기준을 사용한다.

### `ensureDataURL()`

입력이 이미 Data URL 문자열이면 옵션이 있어도 원본 문자열을 그대로 반환한다. 사용자의 의도는 "현재 Data URL이 필요하고, 이미 Data URL이면 변경하지 않는다"이기 때문이다.

입력이 Data URL이 아니면 이미지 요소로 디코딩한 뒤 Canvas에서 `toDataURL(mimeType, quality)`로 인코딩한다. Blob 입력도 `FileReader.readAsDataURL()` 빠른 경로를 사용하지 않는다. 그 경로는 옵션 기반 인코딩이 아니라 원본 Blob 래핑이기 때문이다.

기본 `format`은 기존 Canvas 경로와 동일하게 `png`로 둔다. 기본 `quality`는 기존처럼 `0.8`로 둔다. `quality: 0`은 `0` 그대로 전달한다.

### `ensureBlob()`

입력이 Blob이고 출력 옵션 적용이 필요 없으면 원본 Blob을 반환한다.

다음 경우에는 Canvas 인코딩 경로를 사용한다.

- `format`이 명시되었고 원본 MIME 타입과 다르다.
- `quality`가 명시되었다.
- 향후 출력 인코딩에 영향을 주는 옵션이 추가되어 명시되었다.

`quality`만 명시된 경우 같은 포맷이어도 재인코딩한다. 이는 "품질 변경 요청이 passthrough로 무시된다"는 문제를 피하기 위한 핵심 계약이다.

### `ensureFile()`

결과가 `File`임을 보장한다. 반환 파일명은 `filename` 인자를 따른다. 입력이 이미 `File`이어도 `filename`과 결과 파일의 이름이 다르거나, `format`, `quality`, `autoExtension` 같은 출력 옵션 적용이 필요하면 새 `File`을 생성한다.

입력이 이미 `File`이고 아래 조건을 모두 만족하면 원본을 반환할 수 있다.

- `source.name === filename`
- 출력 옵션 적용이 필요 없다.
- `autoExtension`이 파일명을 바꿀 필요가 없다.

그 외에는 `ensureBlob()`으로 Blob을 보장한 뒤 `File`을 생성한다. `autoExtension` 기본값은 기존 `convertToFile()`과 같이 `true`로 유지한다.

## 내부 구조

중복 판단을 줄이기 위해 작은 헬퍼를 추가한다.

```typescript
function hasExplicitEncodingOptions(options: OutputOptions): boolean;
function shouldReencodeBlob(blob: Blob, options: OutputOptions): boolean;
function shouldReuseFile(file: File, filename: string, options: EnsureFileOptions): boolean;
```

`ensureDataURL()`은 기존 `convertToDataURL()`을 감싸지 않는다. 기존 함수에 옵션 무시 경로가 있기 때문에 새 함수는 직접 Data URL 보장 경로를 가져야 한다.

`convertXxx()` 계열은 이번 변경에서 제거하지 않는다. 필요하면 나중에 문서에 "호환 API"로 표시할 수 있지만, 이번 범위에서는 동작 변경을 최소화한다.

## 테스트

다음 단위 테스트를 추가한다.

- `isDataURLString()`이 Data URL 문자열을 `true`, 일반 URL과 SVG 문자열과 비문자 값을 `false`로 판정한다.
- `ensureDataURL()`이 Data URL 문자열 입력을 옵션과 무관하게 그대로 반환한다.
- `ensureDataURL()`이 Blob 입력에서 `canvas.toDataURL('image/jpeg', 0.95)`를 호출한다.
- `ensureDataURL()`이 Blob 입력에서 `quality: 0`을 보존한다.
- `ensureBlob()`이 Blob 입력에서 옵션이 없으면 원본을 반환한다.
- `ensureBlob()`이 Blob 입력에서 `quality`만 명시되어도 Canvas `toBlob()` 경로를 사용한다.
- `ensureBlob()`이 같은 MIME의 `format`만 명시되고 `quality`가 없으면 원본을 반환한다.
- `ensureFile()`이 재사용 조건을 만족하는 File은 원본을 반환한다.
- `ensureFile()`이 `filename`, `format`, `quality`, `autoExtension` 요구에 따라 새 File을 생성한다.

## 비범위

- 기존 `convertXxx()` 함수 제거 또는 deprecated 처리
- `processImage()` 체이닝 API 변경
- 출력 포맷 지원 범위 확장
- Data URL 내용의 완전한 RFC 검증
