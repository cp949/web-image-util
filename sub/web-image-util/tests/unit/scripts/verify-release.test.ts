import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// 루트 릴리스 검증 스크립트의 단계 정의를 직접 검증한다.
// @ts-expect-error 테스트에서 루트 .mjs 스크립트를 직접 import한다.
import { getReleaseVerificationSteps } from '../../../../../scripts/verify-release.mjs';

describe('릴리스 검증 스크립트', () => {
  test('verify:release는 전용 스크립트를 실행한다', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), '../../package.json'), 'utf8'));

    expect(rootPackageJson.scripts['verify:release']).toBe('node ./scripts/verify-release.mjs');
  });

  test('릴리스 검증 단계를 순서대로 정의한다', () => {
    const steps = getReleaseVerificationSteps();

    expect(steps).toEqual([
      {
        label: '기본 CI 검증',
        command: 'pnpm',
        args: ['verify:ci'],
        cwd: expect.stringMatching(/web-image-util$/),
      },
      {
        label: '브라우저 smoke test',
        command: 'pnpm',
        args: ['--filter', '@cp949/web-image-util', 'test:browser'],
        cwd: expect.stringMatching(/web-image-util$/),
      },
      {
        label: 'npm pack dry-run',
        command: 'npm',
        args: ['pack', '--dry-run'],
        cwd: expect.stringMatching(/web-image-util\/sub\/web-image-util$/),
      },
    ]);
  });
});
