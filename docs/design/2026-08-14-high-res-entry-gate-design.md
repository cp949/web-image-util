# 고해상도 처리 진입 게이트 통합 설계

## 배경

"고해상도 처리 기계(`HighResolutionManager`)를 켤지, 아니면 그냥 `drawImage()`로 처리할지"를 판정하는 진입 게이트가 두 공개 진입점에 각자 다르게 구현돼 있다.

| 파일 | 함수 | 판정 기준 |
| --- | --- | --- |
| `src/core/auto-high-res.ts:103` | `AutoHighResProcessor.smartResize()`의 `isHighRes` | `analysis.totalPixels > thresholds.highResPixelThreshold`(기본 8,000,000, `options.thresholds`로 공개 커스터마이즈 가능) |
| `src/core/smart-processor.internal.ts:80-91` | `SmartProcessor.shouldUseHighResProcessing()` | `originalPixels > 4,000,000 OR scaleRatio > 4`(하드코딩, 커스터마이즈 불가) |

같은 이미지가 어느 진입점을 타느냐에 따라 다른 처리 강도를 받는다. 실측 예시:

- 5MP 이미지 → `AutoHighResProcessor.smartResize()`: 5MP ≤ 8MP → 표준 경로(`standardResize()`, 단순 `drawImage()`).
- 같은 5MP 이미지 → `SmartProcessor.process()`(`fastResize()`/`qualityResize()`/`autoResize()`/`ResizePerformance.*Batch`가 내부적으로 씀): 5MP > 4MP → 고해상도 경로(`HighResolutionManager.smartResize()` 전체).

`docs/maintenance-risks.md`가 Medium 우선순위로 추적하던 "고해상도 전략 선택 임계값 불일치" 항목의 일부이자, `docs/design/2026-08-14-resize-strategy-seam-design.md`가 명시적으로 비범위 처리하며 남긴 재검토 조건("같은 이미지가 호출 경로에 따라 다른 전략으로 처리됨이 실제 버그로 보고되면 별도 카드로 통합을 다룬다")이 재현된 사례다.

`SmartProcessor`는 `.internal.ts`라 직접 export되지 않지만, `src/core/performance-utils.ts`의 공개 함수(`fastResize`/`qualityResize`/`autoResize`/`ResizePerformance.fastBatch`/`qualityBatch`/`memoryEfficientBatch`)를 통해서만 도달 가능하다 — 이 게이트를 바꾸면 공개 API 소비자가 관찰 가능한 동작 변화가 생긴다.

## 결정

`HighResolutionDetector`(`src/base/high-res-detector.internal.ts`)에 진입 게이트 단일 소유 함수를 신설한다.

```ts
static shouldUseHighResolutionPath(
  totalPixels: number,
  scaleRatio: number = 1,
  pixelThreshold: number = HighResolutionDetector.DEFAULT_HIGH_RES_PIXEL_THRESHOLD,
  scaleRatioThreshold: number = HighResolutionDetector.DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD
): boolean {
  return totalPixels > pixelThreshold || scaleRatio > scaleRatioThreshold;
}
```

판정 공식은 `totalPixels > 8,000,000 OR scaleRatio > 4` — 두 진입점에 동일 적용한다. 원시값(픽셀 수·스케일 비율)을 받고 `ImageAnalysis`는 받지 않는다. `scaleRatio`는 target 치수가 있어야 계산되는데 `ImageAnalysis`는 source 치수만 알기 때문이다.

**행동 변화(의도됨):**

- `SmartProcessor` 경로: 픽셀 임계값이 4,000,000 → 8,000,000으로 상향된다. 4MP 초과 8MP 이하 이미지는 이제 표준 경로를 쓴다.
- `AutoHighResProcessor` 경로: scaleRatio 조건을 새로 얻는다. 픽셀 수가 8MP 미만이어도 요청한 축소 비율이 4배를 초과하면 이제 고해상도 경로를 쓴다. 기존 `tests/unit/core/auto-high-res.smart-resize.test.ts`의 "극단적 종횡비" 테스트 2개가 정확히 이 반대(스케일과 무관하게 표준 경로)를 단언하고 있었다 — 커밋 이력에 이 차이를 설명하는 근거가 없어 우연한 구현 차이로 판단했고, 이 카드가 존재하는 이유("같은 이미지는 같은 처리") 자체가 이 비대칭 해소를 요구하므로 테스트를 새 동작에 맞게 뒤집는다.

**공개 표면 변경 없음.** `SmartResizeOptions`에 `thresholds` 필드를 추가하지 않는다 — `SmartProcessor`는 계속 비-커스터마이즈로 남고 공유 기본값(8,000,000 / 4)만 `AutoHighResProcessor`와 맞춘다. `AutoProcessingThresholds`의 필드명·기본값(`highResPixelThreshold: 8_000_000`)도 그대로다 — 값은 이제 `HighResolutionDetector.DEFAULT_HIGH_RES_PIXEL_THRESHOLD`를 참조해 리터럴 중복을 없앤다.

`AutoHighResProcessor.validateProcessing()`(`auto-high-res.ts:215`)이 같은 `thresholds.highResPixelThreshold`를 읽어 권장 메시지를 만드는 자리는 건드리지 않는다 — 이 함수는 실제 처리 경로를 가르는 라우팅 게이트가 아니라 사전 점검 어드바이저리이고, scaleRatio를 애초에 보지 않았다. 아래 "비범위" 참고.

## 변경 상세

**`src/base/high-res-detector.internal.ts`**

- `BYTES_PER_PIXEL`(52행) 바로 뒤에 공개 정적 상수 2개를 신설한다.
  ```ts
  static readonly DEFAULT_HIGH_RES_PIXEL_THRESHOLD = 8_000_000; // 8MP
  static readonly DEFAULT_HIGH_RES_SCALE_RATIO_THRESHOLD = 4;
  ```
- `analyzeImage()`(60-83행) 바로 뒤에 `shouldUseHighResolutionPath()`를 신설한다(본문은 위 "결정" 참고). JSDoc은 이 파일의 기존 관례(영문)를 따른다.

**`src/core/auto-high-res.ts`**

- `defaultThresholds`(61-66행)의 `highResPixelThreshold: 8_000_000` → `highResPixelThreshold: HighResolutionDetector.DEFAULT_HIGH_RES_PIXEL_THRESHOLD`로 리터럴 중복을 없앤다.
- `smartResize()`(101-103행)의 인라인 판정을 공유 함수 호출로 교체한다.
  ```ts
  // 변경 전
  const analysis = HighResolutionDetector.analyzeImage(img);
  const isHighRes = analysis.totalPixels > thresholds.highResPixelThreshold;

  // 변경 후
  const analysis = HighResolutionDetector.analyzeImage(img);
  const scaleRatio = Math.max(img.width / targetWidth, img.height / targetHeight);
  const isHighRes = HighResolutionDetector.shouldUseHighResolutionPath(
    analysis.totalPixels,
    scaleRatio,
    thresholds.highResPixelThreshold
  );
  ```
  `scaleRatioThreshold` 인자는 생략한다 — `AutoProcessingThresholds`에 대응 필드가 없고(공개 표면 변경 없음 결정), 기본값(4)을 그대로 쓴다.
- `HighResolutionDetector`는 이미 값 import돼 있어(7행) import 변경 없음.

**`src/core/smart-processor.internal.ts`**

- import(10행)를 타입 전용에서 값+타입 병합으로 바꾼다.
  ```ts
  // 변경 전
  import type { ProcessingStrategy } from '../base/high-res-detector.internal';

  // 변경 후
  import { HighResolutionDetector, type ProcessingStrategy } from '../base/high-res-detector.internal';
  ```
- `process()`(54행)의 사설 메서드 호출을 공유 함수 호출로 교체한다.
  ```ts
  // 변경 전
  const shouldUseHighRes = SmartProcessor.shouldUseHighResProcessing(img.width, img.height, width, height);

  // 변경 후
  const scaleRatio = Math.max(img.width / width, img.height / height);
  const shouldUseHighRes = HighResolutionDetector.shouldUseHighResolutionPath(img.width * img.height, scaleRatio);
  ```
- `shouldUseHighResProcessing()` 사설 메서드(76-91행)를 통째로 삭제한다. 패스스루 래퍼를 남기지 않는다(이 아키텍처 리뷰가 다른 카드(`BrowserCapabilityDetector` 위임 파사드)에서 지적한 것과 같은 패턴을 스스로 만들지 않기 위함). 이 메서드는 `targetPixels` 지역변수를 계산만 하고 쓰지 않는 죽은 코드도 갖고 있었다(90행 `return`에서 미참조) — 삭제로 함께 해소된다.
- 파일 상단 클래스 JSDoc(4행)의 "자동 고해상도 분기 결정(shouldUseHighResProcessing)" 문구를 새 구조를 반영해 정정한다.

## 테스트 계약

**신규** — `tests/unit/base/high-res-detector.test.ts`에 `shouldUseHighResolutionPath()` 전용 describe 추가(이 함수의 첫 테스트):

- 픽셀 수가 기본 임계값(8,000,000)을 초과하면 true.
- 픽셀 수가 기본 임계값 이하이고 scaleRatio도 4 이하면 false.
- 픽셀 수는 낮아도 scaleRatio가 4를 초과하면 true.
- scaleRatio를 생략하면 기본값 1로 취급해 픽셀 수만으로 판정.
- 커스텀 `pixelThreshold`를 낮추면 더 작은 픽셀 수도 true.
- 경계값(정확히 임계값과 같음)은 초과가 아니므로 false(both axes).

**기존 4개 테스트 파일 갱신:**

- `tests/unit/core/smart-processor.test.ts`
  - "4MP 초과 이미지는 고해상도 경로를 사용한다"(2001×2001) → 임계값이 8MP로 오르며 이제 표준 경로가 된다. 픽셀 수를 8MP 초과로 올리고(예: 2829×2829 = 8,003,241) 표준 경로 테스트로는 옛 2001×2001 fixture를 재사용해 "4MP 초과 8MP 이하는 표준 경로" 신규 테스트로 잠근다.
  - "auto 전략 + 4MP 초과 이미지면 forceStrategy 가 tiled 다"(2001×2001) → `HighResolutionManager.smartResize`까지 도달하려면 이제 8MP도 넘어야 한다. 같은 2829×2829로 fixture를 올린다(`selectInternalStrategy`의 4MP 내부 경계는 이 카드의 비범위라 그대로 유지 — 2829×2829도 4MP는 넘으므로 'tiled' 기대값은 그대로 유효).
  - 스케일 비율 기반 분기 테스트 3개는 무변경(임계값 4는 그대로).
- `tests/unit/core/auto-high-res.smart-resize.test.ts`
  - "극단적 종횡비" describe의 테스트 2개(10000×100, 100×10000 각각 800×600 목표 — scaleRatio 12.5, 16.67) → 기대값을 "표준 경로" → "고해상도 경로"로 뒤집는다. 이 파일의 나머지 fixture는 대부분 목표 대비 scaleRatio가 4를 넘지 않지만, "커스텀 highResPixelThreshold" 테스트(3000×3000, 원래 target 800×600)는 scaleRatio = max(3000/800, 3000/600) = 5.0으로 4를 초과한다 — 최초 전수 확인에서 세로 축(3000/600) 계산이 누락됐다(이 문서의 "최대 3.75, 전수 확인 완료" 서술은 애초 부정확했다). Task 3 구현 중 발견돼 컨트롤러 승인 하에 이 테스트의 target을 800×600 → 1000×1000(scaleRatio 3.0)으로 조정해 원래 검증 의도(픽셀 임계값 override)를 보존했다.
- `tests/unit/core/auto-high-res.test.ts` — `validateProcessing()`만 테스트하는 파일이라 무변경(비범위).
- `tests/unit/core/auto-high-res.batch.test.ts`, `auto-high-res.convenience.test.ts` — fixture가 모두 scaleRatio ≤ 3.33이라 무변경.

## 문서 계약

- `docs/architecture.md` — 핵심 모듈 표에 `src/base/high-res-detector.internal.ts` 행을 신설(`high-res-manager.ts` 행 바로 앞), `analyzeImage`/`shouldUseHighResolutionPath` 단일 소유를 명시.
- `docs/maintenance-risks.md` — "고해상도 전략 선택 임계값 불일치" 행을 좁힌다: 진입 게이트("고해상도 기계를 켤지")는 이 설계로 해소됨을 명시하고, 기계에 들어간 뒤의 내부 direct/stepped/tiled 선택 경계(`high-res-detector`의 16MB vs `high-res-manager.selectMemoryEfficientStrategy`의 32MB 등)는 여전히 열려 있음을 남긴다.
- `CHANGELOG.md` `[Unreleased]` → `### 수정`(Fixed, 새 섹션 — `### 변경` 다음, 다음 릴리스 헤더 앞에 삽입) — 진입점 간 불일치 수정과 두 방향의 행동 변화(SmartProcessor 임계값 상향, AutoHighResProcessor scaleRatio 조건 신설)를 기재. Breaking 아님(타입 변경 없음).

## 비범위

- 고해상도 기계에 들어간 **뒤** direct/stepped/tiled 중 무엇을 쓸지의 내부 경계 통합(`high-res-detector`의 16MB vs `high-res-manager.selectMemoryEfficientStrategy`의 32MB, `selectFastStrategy`의 64MB, `selectHighQualityStrategy`의 256MB). `high-res-manager.ts`의 이 세 메서드는 `SmartProcessor` 경로에서는 `forceStrategy`가 항상 채워져 도달 불가능하기까지 하다 — 이 죽은 코드 정리는 "AutoHighResProcessor·SmartProcessor 이중 래퍼 통합" 카드(아키텍처 리뷰 후보 2)가 `forceStrategy`를 항상 채울지 자체를 재설계하며 함께 다룬다. 지금 손대면 두 카드가 서로를 되돌리는 diff를 만든다.
- `AutoHighResProcessor.validateProcessing()`의 권장 메시지 로직. 실제 처리 경로를 가르지 않는 사전 점검 전용 함수이고, scaleRatio를 원래 보지 않았다.
- `SmartResizeOptions`/`AutoProcessingThresholds`에 새 공개 필드 추가.

## 재검토 조건

- 위 "비범위"의 내부 경계 불일치가 별도로 재현 가능한 버그로 보고되면 후보 2와 함께든 별도로든 새 카드로 다룬다.
- `scaleRatioThreshold`(4)가 실측 품질 기준으로 부적절하다고 판명되면 별도 설계로 재조정한다.
- 저픽셀+고스케일(예: 10000×100→800×600, scaleRatio 12.5) 이미지가 `AutoHighResProcessor` 경로에서 진입 게이트는 통과하지만, `determineOptimalStrategy()`가 여전히 `forceStrategy: 'direct'`를 반환해 `HighResolutionManager`의 `directAdapter`가 `standardResize()`와 동일한 단순 `drawImage()` 연산을 수행함을 최종 브랜치 리뷰(2026-08-14)에서 확인했다. 진입 게이트 통합은 두 진입점의 라우팅 판정을 일치시키지만, 게이트를 통과한 뒤의 실제 처리 강도까지 일치시키지는 않는다 — `selectHighQualityStrategy`(scaleRatio 기반 stepped 선택)는 `forceStrategy`가 상시 채워져 있어 이 경로에서 도달 불가하다. 후보 2 카드(`forceStrategy` 상시 주입 재설계)가 이 간극을 함께 해소할 대상이다.
