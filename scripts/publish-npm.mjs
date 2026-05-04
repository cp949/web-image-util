import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNpmPackEnvironment } from './verify-release.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(resolve(scriptDir, '..'), 'sub/web-image-util');

// pnpm 전용 env config를 제거한 환경으로 npm publish를 실행한다.
const result = spawnSync('npm', ['publish', '--access=public'], {
  cwd: packageRoot,
  env: createNpmPackEnvironment(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exitCode = result.status ?? (result.error ? 1 : 0);
