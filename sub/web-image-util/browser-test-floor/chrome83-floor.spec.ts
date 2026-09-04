import { expect, test } from '@playwright/test';

/**
 * Chrome83(Podman) floor validation smoke다. "최신 Chromium에서 소스가
 * 동작하는가"가 아니라 "tsdown.config.ts의 target: 'chrome75'로 다운레벨된
 * 실제 dist/index.js가 Chrome83에서 동작하는가"를 검증한다
 * (docs/testing/browser-floor-validation.md 참고).
 */

declare global {
  interface Window {
    __CHROME83_FLOOR_RESULT__?: {
      resizeWidth: number;
      resizeHeight: number;
      resizeBlobSize: number;
      svgFormat: string | undefined;
      svgBlobSize: number;
    };
    __CHROME83_FLOOR_ERROR__?: string;
  }
}

test('다운레벨된 dist에서 processImage().resize().toBlob()가 동작한다', async ({ page }) => {
  await page.goto('/virtual-dist.html');
  await expect
    .poll(() => page.evaluate(() => window.__CHROME83_FLOOR_RESULT__ ?? window.__CHROME83_FLOOR_ERROR__))
    .not.toBeUndefined();

  const error = await page.evaluate(() => window.__CHROME83_FLOOR_ERROR__);
  expect(error, `fixture 실행 중 오류: ${error}`).toBeUndefined();

  const result = await page.evaluate(() => window.__CHROME83_FLOOR_RESULT__);
  expect(result?.resizeWidth).toBe(4);
  expect(result?.resizeHeight).toBe(4);
  expect(result?.resizeBlobSize).toBeGreaterThan(0);
  expect(result?.svgBlobSize).toBeGreaterThan(0);
});
