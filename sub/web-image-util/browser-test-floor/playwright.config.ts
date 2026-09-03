import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const PREVIEW_PORT = 4510;

// Chrome83(Podman) floor-validation 전용 게이트다. CHROME83_FLOOR가 없으면
// webServer/project를 정의하지 않는다 — 무조건 정의해두면 호스트(컨테이너 밖)
// 에서 이 config로 playwright test를 돌릴 때 launchOptions.executablePath가
// 가리키는 컨테이너 전용 경로(/usr/bin/chromium)를 찾지 못해 실패한다.
const chrome83Gate = Boolean(process.env.CHROME83_FLOOR);

export default defineConfig({
  testDir: here,
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  webServer: chrome83Gate
    ? {
        command:
          'pnpm exec vite build --config browser-test-floor/vite.chrome83.config.ts && ' +
          `pnpm exec vite preview --config browser-test-floor/vite.chrome83.config.ts --port ${PREVIEW_PORT} --strictPort --host 127.0.0.1`,
        cwd: packageRoot,
        url: `http://127.0.0.1:${PREVIEW_PORT}/virtual-dist.html`,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
  projects: chrome83Gate
    ? [
        {
          name: 'chrome83-floor',
          use: {
            ...devices['Desktop Chrome'],
            baseURL: `http://127.0.0.1:${PREVIEW_PORT}`,
            launchOptions: {
              executablePath: '/usr/bin/chromium',
              args: ['--no-sandbox'],
            },
          },
        },
      ]
    : [],
});
