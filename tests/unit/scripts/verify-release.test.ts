import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
// @ts-expect-error 테스트에서 루트 .mjs 스크립트를 직접 import한다.
import {
  getMenuItems,
  getReleaseItArguments,
  parsePublishArguments,
  planPublish,
  publishPackage,
  validatePublishLifecycle,
} from '../../../scripts/publish-npm.mjs';
// 루트 릴리스 검증 스크립트의 단계 정의를 직접 검증한다.
// @ts-expect-error 테스트에서 루트 .mjs 스크립트를 직접 import한다.
import { getReleaseVerificationSteps, runReleaseVerification } from '../../../scripts/verify-release.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = join(repositoryRoot, 'sub/web-image-util');

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
    const rootPackageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));

    expect(rootPackageJson.scripts['verify:release']).toBe('node ./scripts/verify-release.mjs');
  });

  test('publish:npm은 메뉴 wrapper를 실행하고 release-it을 개발 의존성으로 고정한다', () => {
    const rootPackageJson = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));

    expect(rootPackageJson.scripts['publish:npm']).toBe('node ./scripts/publish-npm.mjs');
    expect(rootPackageJson.devDependencies['release-it']).toBe('21.0.2');
  });

  test('공개 package는 wrapper marker가 없는 직접 publish를 lifecycle에서 차단한다', () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));

    expect(packageJson.scripts.prepublishOnly).toBe('node ../../scripts/publish-npm.mjs --lifecycle-guard');
  });

  test('릴리스 검증 단계를 순서대로 정의한다', () => {
    const steps = getReleaseVerificationSteps();

    expect(steps).toEqual([
      {
        label: '기본 CI 검증',
        command: 'pnpm',
        args: ['verify:ci'],
        cwd: repositoryRoot,
      },
      {
        label: '패키지 빌드',
        command: 'pnpm',
        args: ['--filter', '@cp949/web-image-util', 'build'],
        cwd: repositoryRoot,
      },
      {
        label: '브라우저 smoke test',
        command: 'pnpm',
        args: ['--filter', '@cp949/web-image-util', 'test:browser'],
        cwd: repositoryRoot,
      },
      {
        label: 'npm pack dry-run',
        command: 'npm',
        args: ['pack', '--dry-run'],
        cwd: packageRoot,
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

describe('npm 배포 스크립트', () => {
  test('인자가 없으면 대화형 메뉴를 선택한다', () => {
    expect(parsePublishArguments([])).toEqual({ menu: true });
  });

  test('명시적 실행은 dry-run을 기본값으로 사용한다', () => {
    expect(parsePublishArguments(['--dry-run'])).toEqual({
      dryRun: true,
      confirmed: false,
    });
  });

  test('실제 publish는 명시적 confirmation을 요구한다', () => {
    expect(() => parsePublishArguments(['--publish'])).toThrow('--confirm-publish');
    expect(parsePublishArguments(['--publish', '--confirm-publish'])).toEqual({
      dryRun: false,
      confirmed: true,
    });
  });

  test('메뉴는 web-image-util의 release 단계를 표시한다', () => {
    expect(getMenuItems()).toEqual([
      ['1', '패키지 빌드'],
      ['2', 'release 전체 검증'],
      ['3', 'dry-run 배포'],
      ['4', '실제 publish'],
      ['5', 'registry 상태 새로고침'],
      ['6', '배포 결과 확인'],
      ['q', '종료'],
    ]);
  });

  test('dry-run은 version bump와 Git 작업 없이 실행하고 실제 경로는 Git 작업을 사용한다', () => {
    expect(getReleaseItArguments(true)).toEqual([
      '--dry-run',
      '--ci',
      '--no-increment',
      '--no-git',
      '--npm.skipChecks',
    ]);
    expect(getReleaseItArguments(false)).toEqual([]);
  });

  test('실제 release-it은 version bump 후 Git commit, tag, push를 담당한다', () => {
    const releaseItConfig = JSON.parse(readFileSync(join(packageRoot, '.release-it.json'), 'utf8'));

    expect(releaseItConfig.git).toEqual({
      commit: true,
      tag: true,
      push: true,
      commitMessage: 'chore: release $' + '{version}',
      tagName: 'v$' + '{version}',
      requireCleanWorkingDir: true,
    });
    expect(releaseItConfig.github).toBe(false);
  });

  test('실제 publish는 현재 버전의 registry 상태와 무관하게 release-it에 다음 버전 선택을 맡긴다', () => {
    expect(planPublish(false, { status: 'published', version: '4.0.0' })).toEqual({ action: 'proceed' });
    expect(planPublish(false, { status: 'missing' })).toEqual({ action: 'proceed' });
    expect(planPublish(false, { status: 'error', reason: 'EAI_AGAIN' })).toEqual({
      action: 'abort',
      reason: 'registry 조회 실패',
    });
  });

  test('검증이 실패하면 release-it을 실행하지 않는다', () => {
    const commands: string[][] = [];
    const succeeded = publishPackage('4.0.0', true, { status: 'missing' }, (command: string, args: string[]) => {
      commands.push([command, ...args]);
      return { status: 1 };
    });

    expect(succeeded).toBe(false);
    expect(commands).toEqual([['pnpm', 'verify:release']]);
  });

  test('lifecycle direct actual은 차단하고 wrapper marker와 dry-run은 허용한다', () => {
    expect(() => validatePublishLifecycle({})).toThrow('WEB_IMAGE_UTIL_PUBLISH_DIRECT_DENIED');
    expect(() => validatePublishLifecycle({ npm_config_dry_run: 'true' })).not.toThrow();
    expect(() => validatePublishLifecycle({ WEB_IMAGE_UTIL_PUBLISH_CONFIRMED: '1' })).not.toThrow();
  });
});
