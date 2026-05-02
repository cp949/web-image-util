import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, '..');
const packageRoot = join(repositoryRoot, 'sub/web-image-util');

export function getReleaseVerificationSteps() {
  return [
    {
      label: '기본 CI 검증',
      command: 'pnpm',
      args: ['verify:ci'],
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
    },
  ];
}

export function runReleaseVerification(steps = getReleaseVerificationSteps()) {
  for (const [index, step] of steps.entries()) {
    console.log(`\n[verify:release ${index + 1}/${steps.length}] ${step.label}`);
    console.log(`$ ${[step.command, ...step.args].join(' ')}`);

    const result = spawnSync(step.command, step.args, {
      cwd: step.cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    if (result.error) {
      console.error(`\n[verify:release] ${step.label} 실행에 실패했습니다.`);
      console.error(result.error.message);
      return 1;
    }

    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  console.log('\n[verify:release] 모든 릴리스 검증이 통과했습니다.');
  return 0;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) {
  process.exitCode = runReleaseVerification();
}
