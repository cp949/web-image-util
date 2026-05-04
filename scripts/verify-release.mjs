import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '..');
const packageRoot = join(repositoryRoot, 'sub/web-image-util');

const NPM_PACK_IGNORED_ENV_CONFIG_KEYS = new Set(['verify_deps_before_run', 'hoist', '_jsr_registry']);

/**
 * npm 11은 pnpm 전용 npm_config_* 환경 변수를 알 수 없는 config로 보고 경고한다.
 * npm pack 단계에만 정제된 환경을 전달해 릴리스 로그의 노이즈를 제거한다.
 */
export function createNpmPackEnvironment(sourceEnv = process.env) {
  const env = { ...sourceEnv };

  for (const key of Object.keys(env)) {
    const normalizedKey = key.toLowerCase();
    if (!normalizedKey.startsWith('npm_config_')) {
      continue;
    }

    const configKey = normalizedKey.slice('npm_config_'.length);
    if (NPM_PACK_IGNORED_ENV_CONFIG_KEYS.has(configKey)) {
      delete env[key];
    }
  }

  return env;
}

export function getReleaseVerificationSteps() {
  return [
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
      env: createNpmPackEnvironment(),
    },
  ];
}

/**
 * 릴리스 검증 단계를 실행한다.
 *
 * 테스트에서는 runner를 주입해 실제 패키지 명령 실행 없이 성공/실패 경로를 검증한다.
 */
export function runReleaseVerification(steps = getReleaseVerificationSteps(), runner = runReleaseVerificationStep) {
  for (const [index, step] of steps.entries()) {
    console.log(`\n[verify:release ${index + 1}/${steps.length}] ${step.label}`);
    console.log(`$ ${[step.command, ...step.args].join(' ')}`);

    const result = runner(step);

    if (result.error) {
      console.error(`\n[verify:release] ${step.label} 실행에 실패했습니다.`);
      console.error(result.error.message);
      return 1;
    }

    if (result.status !== 0) {
      console.error(`\n[verify:release] 단계 실패: ${step.label} (exit code ${result.status ?? 1})`);
      return result.status ?? 1;
    }
  }

  console.log('\n[verify:release] 모든 릴리스 검증이 통과했습니다.');
  return 0;
}

function runReleaseVerificationStep(step) {
  return spawnSync(step.command, step.args, {
    cwd: step.cwd,
    env: step.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  process.exitCode = runReleaseVerification();
}
