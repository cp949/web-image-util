/**
 * 필터 적용 결과를 원본 픽셀과 합성하는 순수 helper다.
 */

import { BlendMode } from './filter-blend-mode';

/** 블렌드 모드에 따라 원본과 필터 결과를 합성한다. */
export function applyBlendMode(original: ImageData, filtered: ImageData, blendMode: BlendMode): ImageData {
  const result = new Uint8ClampedArray(original.data.length);
  const origData = original.data;
  const filtData = filtered.data;

  for (let i = 0; i < origData.length; i += 4) {
    const [r1, g1, b1] = [origData[i] / 255, origData[i + 1] / 255, origData[i + 2] / 255];
    const [r2, g2, b2] = [filtData[i] / 255, filtData[i + 1] / 255, filtData[i + 2] / 255];

    let [rResult, gResult, bResult] = [r2, g2, b2];

    switch (blendMode) {
      case BlendMode.MULTIPLY:
        rResult = r1 * r2;
        gResult = g1 * g2;
        bResult = b1 * b2;
        break;
      case BlendMode.SCREEN:
        rResult = 1 - (1 - r1) * (1 - r2);
        gResult = 1 - (1 - g1) * (1 - g2);
        bResult = 1 - (1 - b1) * (1 - b2);
        break;
      case BlendMode.OVERLAY:
        rResult = r1 < 0.5 ? 2 * r1 * r2 : 1 - 2 * (1 - r1) * (1 - r2);
        gResult = g1 < 0.5 ? 2 * g1 * g2 : 1 - 2 * (1 - g1) * (1 - g2);
        bResult = b1 < 0.5 ? 2 * b1 * b2 : 1 - 2 * (1 - b1) * (1 - b2);
        break;
    }

    result[i] = Math.round(rResult * 255);
    result[i + 1] = Math.round(gResult * 255);
    result[i + 2] = Math.round(bResult * 255);
    result[i + 3] = origData[i + 3];
  }

  return new ImageData(result, original.width, original.height);
}

/** opacity 값으로 원본과 필터 결과를 선형 보간한다. */
export function applyOpacity(original: ImageData, filtered: ImageData, opacity: number): ImageData {
  const result = new Uint8ClampedArray(original.data.length);
  const origData = original.data;
  const filtData = filtered.data;

  for (let i = 0; i < origData.length; i += 4) {
    result[i] = origData[i] + opacity * (filtData[i] - origData[i]);
    result[i + 1] = origData[i + 1] + opacity * (filtData[i + 1] - origData[i + 1]);
    result[i + 2] = origData[i + 2] + opacity * (filtData[i + 2] - origData[i + 2]);
    result[i + 3] = origData[i + 3];
  }

  return new ImageData(result, original.width, original.height);
}
