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
    expect(rootPackageJson.devDependencies['release-it']).toBe('21.1.2');
  });

  test('공개 package는 CI 태그 실행이 아닌 직접 publish를 lifecycle에서 차단한다', () => {
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
      ['4', '릴리스(버전 bump·tag push)'],
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

  test('release-it은 npm publish를 하지 않는다(publish는 release.yml만 한다)', () => {
    const releaseItConfig = JSON.parse(readFileSync(join(packageRoot, '.release-it.json'), 'utf8'));

    expect(releaseItConfig.npm?.publish).toBe(false);
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

  test('실제 릴리스는 npm 로그인이나 publish를 시도하지 않고 release-it만 실행한다', () => {
    const commands: string[][] = [];
    const succeeded = publishPackage(
      '5.1.2',
      false,
      { status: 'published', version: '5.1.2' },
      (command: string, args: string[]) => {
        commands.push([command, ...args]);
        return { status: 0 };
      },
      true,
      {}
    );

    expect(succeeded).toBe(true);
    expect(commands).toEqual([
      ['pnpm', 'verify:release'],
      ['pnpm', 'exec', 'release-it'],
    ]);
  });

  test('lifecycle은 로컬 직접 publish를 차단하고 dry-run과 GitHub Actions 태그 실행은 허용한다', () => {
    expect(() => validatePublishLifecycle({})).toThrow('WEB_IMAGE_UTIL_PUBLISH_DIRECT_DENIED');
    expect(() => validatePublishLifecycle({ npm_config_dry_run: 'true' })).not.toThrow();
    expect(() => validatePublishLifecycle({ GITHUB_ACTIONS: 'true', GITHUB_REF_TYPE: 'tag' })).not.toThrow();
    // 브랜치 push나 로컬에서 GITHUB_ACTIONS만 흉내 낸 경우는 허용하지 않는다.
    expect(() => validatePublishLifecycle({ GITHUB_ACTIONS: 'true', GITHUB_REF_TYPE: 'branch' })).toThrow(
      'WEB_IMAGE_UTIL_PUBLISH_DIRECT_DENIED'
    );
    expect(() => validatePublishLifecycle({ GITHUB_REF_TYPE: 'tag' })).toThrow('WEB_IMAGE_UTIL_PUBLISH_DIRECT_DENIED');
  });
});

describe('.github/workflows/release.yml', () => {
  const release = readFileSync(join(repositoryRoot, '.github/workflows/release.yml'), 'utf8');

  /** 문자열이 처음 나오는 위치를 반환한다. 없으면 테스트가 실패한다. */
  const at = (needle: string) => {
    const index = release.indexOf(needle);
    expect(index, `${needle}이 release.yml에 없다`).toBeGreaterThanOrEqual(0);
    return index;
  };

  test('v* 태그 push에서만 실행한다', () => {
    expect(release).toMatch(/on:\s*\n\s+push:\s*\n\s+tags:\s*\[\s*'v\*'\s*\]/);
    expect(release).not.toMatch(/branches:/);
  });

  test('OIDC 토큰 요청 권한(id-token: write)과 읽기 권한만 요청한다', () => {
    expect(release).toMatch(/permissions:\s*\n\s+contents:\s*read\s*\n\s+id-token:\s*write/);
  });

  test('npm 토큰 secret과 registry-url을 쓰지 않는다(trusted publishing으로 인증한다)', () => {
    expect(release).not.toMatch(/secrets\.|NODE_AUTH_TOKEN|NPM_TOKEN/);
    expect(release).not.toMatch(/^\s*registry-url:/m);
  });

  test('설치, main 포함 확인, 버전 확인, 검증, 재빌드, publish 순서로 실행한다', () => {
    const order = [
      at('pnpm install --frozen-lockfile'),
      at('git merge-base --is-ancestor'),
      at('GITHUB_REF_NAME'),
      at('pnpm verify:release'),
      at('run: pnpm build'),
      at('npm publish'),
    ];

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test('sub/web-image-util에서 provenance를 붙여 public으로 publish한다', () => {
    expect(release).toMatch(/npm publish --provenance --access public\s*\n\s+working-directory:\s*sub\/web-image-util/);
  });
});
