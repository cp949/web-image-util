# advanced 공개 API 종단 경로 스모크 테스트 설계

## 배경

`_tmp/arch-review/02.html` 카드 8("advanced 공개 API 종단 경로에 스모크 테스트를 추가한다")과 `docs/maintenance-risks.md`의 "advanced/high-res 테스트 공백"(Medium) 항목이 같은 지점을 가리킨다.

현재 계층(카드 1·2가 이미 병합되어 `SmartProcessor`는 삭제된 뒤 기준):

```
AutoHighResProcessor.smartResize()      (advanced-index.ts 재노출 — 실제 공개 표면)
  └─ HighResolutionManager.smartResize() (advanced-index.ts에서도 "수동 제어" 용도로 별도 재노출)
       └─ resize-strategy.internal.ts의 adapter(direct/stepped/tiled)
            └─ SteppedProcessor.resizeWithSteps() / TiledProcessor.resizeInTiles()
```

코드 조사로 확인한 실제 상태:

- `tests/unit/core/auto-high-res.smart-resize.test.ts`는 `'경로 분기'` describe 블록의 `beforeEach`에서 `vi.spyOn(HighResolutionManager, 'smartResize').mockResolvedValue(...)`를 걸어, `AutoHighResProcessor.smartResize()`가 실제로 `HighResolutionManager`를 통과하는 케이스가 하나도 없다.
- `tests/unit/core/high-res-manager-smart-resize-strategy-jsdom.test.ts`는 반대로 `TiledProcessor.resizeInTiles`/`SteppedProcessor.resizeWithSteps`를 `mockResolvedValue(stubCanvas)`로 걷어내고 "호출 인자가 맞는가"만 검증한다.
- `tests/unit/base/tiled-processor.resize-jsdom.test.ts`는 모킹 없이 `TiledProcessor.resizeInTiles()`를 직접 호출하는 유일한 real-leaf 테스트다. 이것이 카드가 말하는 "leaf 테스트만 여기 도달"이다.
- `SteppedProcessor`는 이보다도 못하다 — `tests/unit/base/stepped-processor.test.ts`의 모든 테스트가 `directResize`/`performSteppedResize`/`imageToCanvas`/`canvasToCanvas` 같은 자기 자신의 private 메서드까지 spy로 걷어낸다. 실제 `drawImage` 경로를 통과하는 테스트가 저장소 전체에 **하나도 없다**.
- 카드 원문이 언급한 `tests/unit/core/smart-processor.test.ts`는 카드 2(완료, `refactor/high-res-wrapper-consolidation`)에서 `SmartProcessor`와 함께 이미 삭제됐다 — 카드의 파일 목록은 작성 시점 기준이며 현재 코드와 어긋난다.

## 결정

`tests/integration/advanced-strategy-smoke-jsdom.test.ts`를 새로 추가한다. `tests/integration/`은 `svg-quality-fix.test.ts`가 이미 "레이어를 모킹으로 끊지 않고 관통 검증"하는 용도로 쓰고 있는 디렉터리다 — 같은 관례를 따른다.

- **진입점은 `AutoHighResProcessor.smartResize()` 하나만 쓴다.** `advanced-index.ts`가 재노출하는 실제 공개 표면이고, 이 경로가 내부적으로 `HighResolutionManager.smartResize()`를 그대로 통과하므로 그 계층도 같은 테스트로 함께 검증된다. `HighResolutionManager`를 겨냥한 별도 진입점 테스트는 중복이라 추가하지 않는다.
- **고해상도 게이트는 `scaleRatio`로 연다.** `AutoHighResProcessor.smartResize()`는 `totalPixels`나 `scaleRatio`(source/target 중 큰 축의 축소 배율) 중 하나가 임계값을 넘어야 `HighResolutionManager` 경로로 들어간다(`shouldUseHighResolutionPath`, 카드 1에서 이미 단일 게이트로 합류됨). `thresholds` 옵션으로 내부 상수를 오버라이드하는 대신, 소스 32×32 → 타깃 4×4(배율 8 > 기본 임계값 4)로 자연스럽게 게이트를 연다. 내부 숫자 상수에 테스트가 결합되지 않는다.
- **leaf는 `forceStrategy: 'tiled' | 'stepped'`로 결정적으로 고정한다.** 카드가 제안한 그대로다 — quality 기반 자동 선택에 기대면 내부 임계값이 바뀔 때 테스트가 어느 leaf를 도달하는지 흔들린다.
- **"모킹 없음"은 pass-through spy로 강제한다.** `vi.spyOn(TiledProcessor, 'resizeInTiles')` / `vi.spyOn(SteppedProcessor, 'resizeWithSteps')`를 **`mockImplementation`/`mockResolvedValue` 없이** 사용한다 — 원본 구현을 그대로 호출하면서 "실제로 호출됐는가"만 관찰한다. 기존 계약 테스트들이 쓰는 `mockResolvedValue(stubCanvas)` 패턴과 정확히 대비되는 지점이라, 이 차이 자체가 "모킹 없이 leaf까지 관통했다"는 증거다.
- **크기 검증만으로는 부족하다.** 레이어 배선이 끊겨도 크기만 맞는 빈 canvas를 돌려주면 크기 assertion은 통과한다. `getImageData(0, 0, 1, 1)`로 픽셀 alpha가 0이 아님을 추가로 확인해 이 회귀를 잡는다.
- **파일명에 `-jsdom` 접미사를 붙인다.** `tiled-processor.resize-jsdom.test.ts`/`high-res-manager-smart-resize-strategy-jsdom.test.ts`와 동일하게, 실제 `drawImage`/canvas 렌더링에 의존하는 테스트라는 표시다.

스파이크로 실동작을 확인했다(구현 계획 수립 중, 코드 변경 없이 임시 파일로 실행 후 삭제): 32×32 단색(`#3399ff`) canvas를 소스로, `forceStrategy: 'tiled'`/`'stepped'` 각각 7ms/2ms 내 실행 완료, 결과 canvas의 (0,0) 픽셀이 `[51, 153, 255, 255]`로 원본과 정확히 일치했다(다운스케일이어도 단색이라 값이 보존됨 — 실제 drawImage 파이프라인이 동작했다는 직접 증거). `node-canvas`(`canvas@^3.2.3`) 기반이라 `getImageData`가 실제 픽셀을 반환한다.

## 비범위

- **DIRECT 전략의 별도 스모크는 추가하지 않는다.** 고해상도 게이트를 통과하지 못하는 이미지는 `AutoHighResProcessor.standardResize()`가 항상 실제 `drawImage`를 실행한다 — leaf 간접 호출이 없어 카드가 지적하는 "leaf만 도달" 문제 자체가 없다.
- **기존 mock 기반 계약 테스트는 건드리지 않는다.** `auto-high-res.smart-resize.test.ts`/`high-res-manager-smart-resize-strategy-jsdom.test.ts`는 "인자가 정확히 전달되는가"를 빠르게 검증하는 역할이 여전히 유효하다 — 이번에 추가하는 관통 테스트와 대체 관계가 아니라 보완 관계다.
- **production 코드 변경은 없다.** 이 카드의 Solution은 테스트 추가뿐이다. 스파이크에서 기존 구현이 이미 기대대로 동작함을 확인했다.

## 재검토 조건

`resize-strategy.internal.ts`의 `RESIZE_STRATEGY_ADAPTERS`에 새 전략이 추가되면 이 스모크 테스트에도 대응 케이스를 추가한다.
