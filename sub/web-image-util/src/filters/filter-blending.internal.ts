/**
 * 필터 적용 결과를 원본 픽셀과 합성하는 순수 helper다.
 */

import { BlendMode } from './filter-blend-mode.internal';
import { createUnsupportedBlendModeError } from './filter-errors.internal';

/** COLOR-DODGE 공식이다(CSS Compositing). cb=backdrop(원본), cs=source(필터 결과). */
function colorDodge(cb: number, cs: number): number {
  if (cb === 0) return 0;
  if (cs === 1) return 1;
  return Math.min(1, cb / (1 - cs));
}

/** COLOR-BURN 공식이다(CSS Compositing). */
function colorBurn(cb: number, cs: number): number {
  if (cb === 1) return 1;
  if (cs === 0) return 0;
  return 1 - Math.min(1, (1 - cb) / cs);
}

/** SOFT-LIGHT 공식이 참조하는 D(x) 보조 함수다(CSS Compositing). */
function softLightD(x: number): number {
  return x <= 0.25 ? ((16 * x - 12) * x + 4) * x : Math.sqrt(x);
}

/** SOFT-LIGHT 공식이다(CSS Compositing). */
function softLight(cb: number, cs: number): number {
  return cs <= 0.5 ? cb - (1 - 2 * cs) * cb * (1 - cb) : cb + (2 * cs - 1) * (softLightD(cb) - cb);
}

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
      case BlendMode.NORMAL:
        // rResult/gResult/bResult는 이미 필터 결과(r2/g2/b2)로 초기화돼 있다.
        break;
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
      case BlendMode.DARKEN:
        rResult = Math.min(r1, r2);
        gResult = Math.min(g1, g2);
        bResult = Math.min(b1, b2);
        break;
      case BlendMode.LIGHTEN:
        rResult = Math.max(r1, r2);
        gResult = Math.max(g1, g2);
        bResult = Math.max(b1, b2);
        break;
      case BlendMode.COLOR_DODGE:
        rResult = colorDodge(r1, r2);
        gResult = colorDodge(g1, g2);
        bResult = colorDodge(b1, b2);
        break;
      case BlendMode.COLOR_BURN:
        rResult = colorBurn(r1, r2);
        gResult = colorBurn(g1, g2);
        bResult = colorBurn(b1, b2);
        break;
      case BlendMode.HARD_LIGHT:
        // HardLight(Cb,Cs) = Overlay(Cs,Cb) — OVERLAY와 좌우가 뒤바뀐 관계다.
        rResult = r2 < 0.5 ? 2 * r1 * r2 : 1 - 2 * (1 - r1) * (1 - r2);
        gResult = g2 < 0.5 ? 2 * g1 * g2 : 1 - 2 * (1 - g1) * (1 - g2);
        bResult = b2 < 0.5 ? 2 * b1 * b2 : 1 - 2 * (1 - b1) * (1 - b2);
        break;
      case BlendMode.SOFT_LIGHT:
        rResult = softLight(r1, r2);
        gResult = softLight(g1, g2);
        bResult = softLight(b1, b2);
        break;
      case BlendMode.DIFFERENCE:
        rResult = Math.abs(r1 - r2);
        gResult = Math.abs(g1 - g2);
        bResult = Math.abs(b1 - b2);
        break;
      case BlendMode.EXCLUSION:
        rResult = r1 + r2 - 2 * r1 * r2;
        gResult = g1 + g2 - 2 * g1 * g2;
        bResult = b1 + b2 - 2 * b1 * b2;
        break;
      default: {
        // BlendMode에 값이 추가되면 여기서 컴파일 오류로 드러난다(string.internal.ts와 같은 관례).
        const unhandledMode: never = blendMode;
        throw createUnsupportedBlendModeError(String(unhandledMode));
      }
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
