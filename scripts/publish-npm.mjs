import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createNpmPackEnvironment } from './verify-release.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');
const packageRoot = join(repositoryRoot, 'sub/web-image-util');
const packageName = '@cp949/web-image-util';
const confirmationEnvironment = 'WEB_IMAGE_UTIL_PUBLISH_CONFIRMED';

function run(command, args, { capture = false, cwd = repositoryRoot, env = process.env } = {}) {
  const executable = process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd,
    encoding: 'utf8',
    env,
    stdio: capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  return result;
}

export function parsePublishArguments(argv) {
  if (argv.length === 0) return { menu: true };

  let publish = false;
  let confirmed = false;
  let dryRun = false;
  for (const argument of argv) {
    if (argument === '--dry-run') {
      if (dryRun) throw new Error('--dry-run 중복은 허용하지 않습니다.');
      dryRun = true;
    } else if (argument === '--publish') {
      if (publish) throw new Error('--publish 중복은 허용하지 않습니다.');
      publish = true;
    } else if (argument === '--confirm-publish') {
      if (confirmed) throw new Error('--confirm-publish 중복은 허용하지 않습니다.');
      confirmed = true;
    } else {
      throw new Error(`알 수 없는 인자입니다: ${argument}`);
    }
  }

  if (dryRun && publish) throw new Error('--dry-run과 --publish는 함께 사용할 수 없습니다.');
  if (publish && !confirmed) throw new Error('실제 publish에는 --confirm-publish가 필요합니다.');
  if (!publish && confirmed) throw new Error('--confirm-publish는 --publish와 함께 사용하세요.');
  return { dryRun: !publish, confirmed };
}

export function getReleaseItArguments(dryRun) {
  return [
    ...(dryRun ? ['--dry-run', '--ci', '--no-increment'] : []),
    '--no-git',
    ...(dryRun ? ['--npm.skipChecks'] : []),
  ];
}

export function validatePublishLifecycle(environment) {
  if (environment.npm_config_dry_run === 'true' || environment[confirmationEnvironment] === '1') return;
  throw new Error('[WEB_IMAGE_UTIL_PUBLISH_DIRECT_DENIED] 실제 publish는 root publish:npm wrapper로만 실행하세요.');
}

export function classifyRegistryVersionResult(result) {
  if (result.status === 0) {
    const version = result.stdout.trim();
    return version === '' ? { status: 'error', reason: 'empty response' } : { status: 'published', version };
  }
  const errorCode = result.stderr.match(/(?:^|\s)code\s+([A-Z0-9_]+)/i)?.[1]?.toUpperCase();
  return errorCode === 'E404'
    ? { status: 'missing' }
    : { status: 'error', reason: errorCode ?? `exit ${result.status ?? 'unknown'}` };
}

export function planPublish(dryRun, registryLookup) {
  if (dryRun || registryLookup.status === 'published' || registryLookup.status === 'missing') {
    return { action: 'proceed' };
  }
  return { action: 'abort', reason: 'registry 조회 실패' };
}

export function publishPackage(
  version,
  dryRun,
  registryLookup,
  runCommand = run,
  confirmed = false,
  environment = process.env
) {
  if (!dryRun && !confirmed) {
    console.log('실제 publish confirmation이 없어 배포를 중단합니다.');
    return false;
  }

  const plan = planPublish(dryRun, registryLookup);
  if (plan.action === 'abort') {
    console.log(plan.reason);
    return false;
  }

  console.log('\n$ pnpm verify:release');
  if (runCommand('pnpm', ['verify:release']).status !== 0) {
    console.log('\nrelease 검증에 실패해 배포를 중단합니다.');
    return false;
  }

  if (!dryRun) {
    console.log('\n$ npm whoami');
    if (runCommand('npm', ['whoami'], { env: environment }).status !== 0) {
      console.log('\nnpm 인증을 확인할 수 없어 실제 배포를 중단합니다.');
      return false;
    }
  }

  const publishEnvironment = dryRun
    ? createNpmPackEnvironment(environment)
    : { ...createNpmPackEnvironment(environment), [confirmationEnvironment]: '1' };
  const args = ['exec', 'release-it', ...getReleaseItArguments(dryRun)];
  console.log(`\n$ pnpm ${args.join(' ')}`);
  if (runCommand('pnpm', args, { cwd: packageRoot, env: publishEnvironment }).status !== 0) {
    console.log(`\n${packageName} 배포에 실패했습니다.`);
    return false;
  }

  console.log(
    dryRun
      ? `\n${packageName}@${version} dry-run이 성공했습니다. 실제 배포는 되지 않았습니다.`
      : `\n${packageName}@${version} 배포 명령이 성공했습니다.`
  );
  return true;
}

export function getMenuItems() {
  return [
    ['1', '패키지 빌드'],
    ['2', 'release 전체 검증'],
    ['3', 'dry-run 배포'],
    ['4', '실제 publish'],
    ['5', 'registry 상태 새로고침'],
    ['6', '배포 결과 확인'],
    ['q', '종료'],
  ];
}

function readManifest() {
  return JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
}

function readRegistryVersion(version) {
  return classifyRegistryVersionResult(run('npm', ['view', `${packageName}@${version}`, 'version'], { capture: true }));
}

function printMenu(version, registryLookup) {
  console.log(`\n=== ${packageName} 배포 도구 · release ${version} ===`);
  console.log(`  registry 상태: ${registryLookup.status}`);
  for (const [key, label] of getMenuItems()) console.log(`  ${key}) ${label}`);
  console.log('');
}

async function runMenu(manifest) {
  let registryLookup = readRegistryVersion(manifest.version);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      printMenu(manifest.version, registryLookup);
      const choice = (await rl.question('선택: ')).trim().toLowerCase();
      if (choice === 'q' || choice === '') return;
      if (choice === '1') run('pnpm', ['--filter', packageName, 'package']);
      else if (choice === '2') run('pnpm', ['verify:release']);
      else if (choice === '3') publishPackage(manifest.version, true, registryLookup, run, true);
      else if (choice === '4') publishPackage(manifest.version, false, registryLookup, run, true);
      else if (choice === '5') registryLookup = readRegistryVersion(manifest.version);
      else if (choice === '6') {
        console.log(
          registryLookup.status === 'published'
            ? `${packageName}@${registryLookup.version}: 배포됨`
            : `${packageName}@${manifest.version}: ${registryLookup.status}`
        );
      } else console.log(`알 수 없는 선택입니다: ${choice}`);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === '--lifecycle-guard') {
    validatePublishLifecycle(process.env);
    return;
  }

  const options = parsePublishArguments(argv);
  const manifest = readManifest();
  if (manifest.name !== packageName || manifest.private === true) {
    throw new Error('공개 publish 대상 package manifest가 올바르지 않습니다.');
  }

  if (options.menu === true) {
    if (!process.stdin.isTTY) throw new Error('대화형 메뉴는 TTY에서만 실행할 수 있습니다.');
    await runMenu(manifest);
    return;
  }

  const registryLookup = readRegistryVersion(manifest.version);
  if (!publishPackage(manifest.version, options.dryRun, registryLookup, run, options.confirmed, process.env)) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
