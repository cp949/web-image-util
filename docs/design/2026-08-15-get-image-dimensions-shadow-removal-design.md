# 죽은 getImageDimensions 그림자 구현 제거 설계

## 배경

`getImageDimensions`라는 이름의 함수가 두 곳에 독립 구현돼 있다.

**`src/core/source-converter/index.ts:104-113`** — `convertToImageElement()`로 로드한 뒤 `naturalWidth || width` 폴백만 적용하는 얇은 구현이다.

```ts
export async function getImageDimensions(source: ImageSource): Promise<{
  width: number;
  height: number;
}> {
  const element = await convertToImageElement(source);
  return {
    width: element.naturalWidth || element.width,
    height: element.naturalHeight || element.height,
  };
}
```

**`src/utils/image-info/dimensions.internal.ts:68-89`** — 캔버스/완료된 이미지 요소는 변환 없이 즉시 읽고, SVG 문자열·SVG Blob은 전용 파서를 쓰며, 그 외 입력만 `convertToImageElement()` 경로로 보낸 뒤 같은 `naturalWidth || width` 폴백(`dimensionsFromElement`)을 적용한다.

`src/index.ts:218-227`의 공개 export는 `image-info` 쪽만 재노출한다(`export { ..., getImageDimensions, ... } from './utils/image-info/index'`). `source-converter/index.ts`의 구현은 이 배럴에 닿지 않는다.

adapter count: `source-converter`판 `getImageDimensions`를 소비하는 곳은 자기 자신을 검증하는 전용 jsdom 테스트 하나뿐이다(`tests/unit/core/source-converter-failure-jsdom.test.ts:303-335`, `describe('getImageDimensions — index.ts 폴백 분기', ...)`). grep으로 확인한 프로덕션 호출자는 0건이고, `package.json`의 `exports` 필드에도 `source-converter` 서브패스가 없어 외부에서 이 심볼에 닿을 경로가 없다. 두 구현이 갈라지는 유일한 지점(문자열 소스 경로)도 동작이 동치다 — `image-info` 쪽은 `convertToImageElement(source)` 호출 후 같은 `naturalWidth || width` 폴백을 거치므로, 삭제 대상 함수가 검증하던 분기("naturalWidth 0이면 width로 폴백")는 `image-info` 쪽 코드에도 그대로 남는다.

`docs/architecture.md:53`은 이 모듈을 `convertToImageElement` / `getImageDimensions` 오케스트레이션이라고 기술한다 — 삭제 후에는 부정확해진다.

## 결정

`source-converter/index.ts`의 그림자 구현과 전용 테스트를 삭제한다. 대안(스모크 테스트로 축소)은 고려하지 않는다 — 이 함수는 애초에 공개 표면에 닿지 않고 로직도 `image-info` 쪽과 완전히 동치라, 남겨둘 이유가 없다.

- `source-converter/index.ts`에서 `getImageDimensions` 함수(JSDoc 포함, 97-113행)를 삭제한다. `convertToImageElement`만 이 모듈의 공개 표면으로 남는다.
- 전용 테스트 describe 블록(`tests/unit/core/source-converter-failure-jsdom.test.ts:303-335`)을 삭제한다. 같은 파일 1-14행 모듈 doc comment의 대상 목록에서 `getImageDimensions` 언급을 뗀다.
- `docs/architecture.md:53` 표 행에서 `getImageDimensions` 오케스트레이션 언급을 뗀다.

**deletion test:** 삭제 후 `pnpm typecheck`를 돌리면 어떤 파일에서도 `getImageDimensions is not exported from './core/source-converter/index'` 같은 에러가 나지 않아야 한다 — 이 심볼을 import하는 곳이 삭제 대상 테스트 하나뿐이라는 가설의 실측 증거다.

**행동 변화:** 없음. 공개 API(`getImageDimensions`, `getImageAspectRatio`, `getImageOrientation`)의 구현·계약·반환값은 전혀 바뀌지 않는다. 이 카드는 순수 내부 정리다 — CHANGELOG 항목을 추가하지 않는다(선례: `2026-08-14-processor-interface-parity-design.md` — 관측 가능한 동작 변화가 없는 정정은 CHANGELOG에 적지 않는다).

## 변경 상세

**`src/core/source-converter/index.ts`**

- 95행(`convertDetectedBlobToElement` 닫는 `}`) 다음의 96-113행(빈 줄 + JSDoc + `getImageDimensions` 함수 전체)을 삭제한다. 파일은 95행 `}`로 끝난다.
- `import type { ImageSource, ... }`(8행)은 `convertToImageElement`의 시그니처가 계속 쓰므로 그대로 둔다.

**`tests/unit/core/source-converter-failure-jsdom.test.ts`**

- 1-14행 모듈 doc comment의 "- src/core/source-converter/index.ts (convertToImageElement / getImageDimensions)"를 "- src/core/source-converter/index.ts (convertToImageElement)"로 바꾼다.
- 303-336행(`describe('getImageDimensions — index.ts 폴백 분기', ...)` 블록 전체 + 다음 블록과의 구분용 빈 줄 1개)을 삭제한다. 이 블록이 참조하는 최상단 공유 변수(`originalDocumentCreateElement` 등)는 다른 describe 블록이 계속 쓰므로 건드리지 않는다.

**`docs/architecture.md`**

- 53행 표 행 설명 "`convertToImageElement` / `getImageDimensions` 오케스트레이션"을 "`convertToImageElement` 오케스트레이션"으로 바꾼다.

## 테스트 계약

**삭제:**

- `naturalWidth/Height가 0이면 width/height 속성으로 폴백한다`(source-converter-failure-jsdom.test.ts) — 삭제 대상 함수 전용 테스트는 지우고, 아래 공개 API 테스트로 계약을 이관한다.
- `naturalWidth/Height가 양수면 그 값을 사용한다`(같은 파일) — 위와 동일.

**이관:** 두 테스트가 검증하던 `naturalWidth || width` / `naturalHeight || height` 계약은 `image-info/dimensions.internal.ts`의 `dimensionsFromElement`에도 남아 있다. `tests/unit/utils/image-info/dimensions.test.ts`의 공개 `getImageDimensions()` 경로로 두 케이스를 이관해, 삭제 대상 구현과 무관하게 남은 계약의 회귀를 검증한다.

**최종 테스트 개수:** `tests/unit/core/source-converter-failure-jsdom.test.ts` 파일 내 describe 블록 1개(테스트 2개) 삭제. `tests/unit/utils/image-info/dimensions.test.ts`에 동일 계약의 공개 API 테스트 2개 추가.

## 문서 계약

- `docs/architecture.md:53` — 위 변경 상세대로 갱신한다.
- `docs/design/README.md` — 이 설계 문서를 색인에 추가한다.
- `CHANGELOG.md` — 갱신하지 않는다(행동 변화 없음, 위 "결정" 절 참고).
- `docs/maintenance-risks.md` — 이 그림자 구현은 애초에 리스크로 등재된 적이 없어 갱신하지 않는다.

## 비범위

- `image-info/dimensions.internal.ts`의 `getImageDimensions` 자체 동작 변경.
- 같은 리뷰 문서의 다른 카드(카드 5 `BrowserCapabilityDetector`, 카드 7 `ResizePerformanceOptions` 유령 필드 등).
