import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

// 루트 릴리스 검증 스크립트의 단계 정의를 직접 검증한다.
// @ts-expect-error 테스트에서 루트 .mjs 스크립트를 직접 import한다.
import { getReleaseVerificationSteps, runReleaseVerification } from '../../../scripts/verify-release.mjs';

type ReleaseVerificationStep = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

describe('릴리스 검증 스크립트', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('verify:release는 전용 스크립트를 실행한다', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

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
        env: expect.objectContaining({
          npm_config_user_agent: expect.any(String),
        }),
      },
    ]);
  });

  test('npm pack 단계는 npm 11 경고를 만드는 pnpm 전용 env config를 제거한다', () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      npm_config_verify_deps_before_run: 'false',
      NPM_CONFIG_HOIST: 'true',
      npm_config__jsr_registry: 'https://example.test',
      npm_config_user_agent: 'pnpm/10.17.1 npm/? node/v24.12.0 linux x64',
    };

    try {
      const npmPackStep = getReleaseVerificationSteps().find((step) => step.label === 'npm pack dry-run');

      expect(npmPackStep?.env).toBeDefined();
      expect(npmPackStep?.env?.npm_config_verify_deps_before_run).toBeUndefined();
      expect(npmPackStep?.env?.NPM_CONFIG_HOIST).toBeUndefined();
      expect(npmPackStep?.env?.npm_config__jsr_registry).toBeUndefined();
      expect(npmPackStep?.env?.npm_config_user_agent).toBe('pnpm/10.17.1 npm/? node/v24.12.0 linux x64');
    } finally {
      process.env = originalEnv;
    }
  });

  test('모든 단계가 성공하면 0을 반환한다', () => {
    const steps = [
      { label: '첫 번째 단계', command: 'pnpm', args: ['alpha'], cwd: '/repo' },
      { label: '두 번째 단계', command: 'npm', args: ['beta'], cwd: '/repo/package' },
    ];
    const executedCommands: string[] = [];

    const exitCode = runReleaseVerification(steps, (step: ReleaseVerificationStep) => {
      executedCommands.push([step.command, ...step.args].join(' '));
      return { status: 0 };
    });

    expect(exitCode).toBe(0);
    expect(executedCommands).toEqual(['pnpm alpha', 'npm beta']);
  });

  test('중간 단계가 실패하면 이후 단계를 실행하지 않고 해당 exit code를 반환한다', () => {
    const steps = [
      { label: '성공 단계', command: 'pnpm', args: ['ok'], cwd: '/repo' },
      { label: '실패 단계', command: 'pnpm', args: ['fail'], cwd: '/repo' },
      { label: '건너뛸 단계', command: 'npm', args: ['pack'], cwd: '/repo/package' },
    ];
    const executedLabels: string[] = [];

    const exitCode = runReleaseVerification(steps, (step: ReleaseVerificationStep) => {
      executedLabels.push(step.label);
      return { status: step.label === '실패 단계' ? 27 : 0 };
    });

    expect(exitCode).toBe(27);
    expect(executedLabels).toEqual(['성공 단계', '실패 단계']);
  });

  test('실행 에러가 있으면 1을 반환한다', () => {
    const steps = [{ label: '실행 에러 단계', command: 'pnpm', args: ['boom'], cwd: '/repo' }];

    const exitCode = runReleaseVerification(steps, () => ({
      error: new Error('spawn failed'),
      status: null,
    }));

    expect(exitCode).toBe(1);
  });

  test('단계가 실패하면 실패한 단계와 exit code를 에러 로그로 남긴다', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const steps = [{ label: '실패 로그 단계', command: 'pnpm', args: ['fail'], cwd: '/repo' }];

    const exitCode = runReleaseVerification(steps, () => ({ status: 27 }));

    expect(exitCode).toBe(27);
    expect(errorSpy).toHaveBeenCalledWith('\n[verify:release] 단계 실패: 실패 로그 단계 (exit code 27)');
  });
});
