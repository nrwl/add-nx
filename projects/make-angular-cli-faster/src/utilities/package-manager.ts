import { writeJsonFile } from '@nrwl/workspace/src/utilities/fileutils';
import { execSync } from 'child_process';
import { copyFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { major } from 'semver';
import { dirSync } from 'tmp';
import { readJsonFile } from './json';
import { MigrationDefinition } from './types';
import { workspaceRoot } from './workspace-root';

export function getPackageManagerCommand(): {
  add: string;
  exec: string;
  install: string;
} {
  const packageManager = existsSync(join(workspaceRoot, 'yarn.lock'))
    ? 'yarn'
    : existsSync(join(workspaceRoot, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : 'npm';

  switch (packageManager) {
    case 'yarn':
      return {
        add: 'yarn add -W',
        exec: 'yarn',
        install: 'yarn',
      };

    case 'pnpm':
      return {
        add: 'pnpm add',
        exec: 'pnpx',
        install: 'pnpm install --no-frozen-lockfile',
      };

    case 'npm':
      return {
        add: 'npm install',
        exec: 'npx',
        install: 'npm install --legacy-peer-deps',
      };
  }
}

export function installDependencies(
  { packageName, version }: MigrationDefinition,
  useNxCloud: boolean
): void {
  const json = readJsonFile(join(workspaceRoot, 'package.json'));

  json.devDependencies ??= {};
  json.devDependencies['nx'] = version;
  json.devDependencies['@nrwl/workspace'] = version;
  if (useNxCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = resolvePackageVersion(
      '@nrwl/nx-cloud',
      `^${major(version)}.0.0`
    );
  }
  json.devDependencies = sortObjectByKeys(json.devDependencies);

  if (packageName === '@nrwl/angular') {
    json.dependencies ??= {};
    json.dependencies['@nrwl/angular'] = version;
    json.dependencies = sortObjectByKeys(json.dependencies);
  }
  writeFileSync(`package.json`, JSON.stringify(json, null, 2));

  execSync(getPackageManagerCommand().install, {
    stdio: [0, 1, 2],
  });
}

export function resolvePackageVersion(
  packageName: string,
  version: string
): string {
  const dir = dirSync().name;
  const npmrc = checkForNPMRC();
  if (npmrc) {
    // Creating a package.json is needed for .npmrc to resolve
    writeJsonFile(`${dir}/package.json`, {});
    // Copy npmrc if it exists, so that npm still follows it.
    copyFileSync(npmrc, `${dir}/.npmrc`);
  }

  const pmc = getPackageManagerCommand();
  execSync(`${pmc.add} ${packageName}@${version}`, { stdio: [], cwd: dir });

  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [dir],
  });
  const { version: resolvedVersion } = readJsonFile(packageJsonPath);

  try {
    unlinkSync(dir);
  } catch {
    // It's okay if this fails, the OS will clean it up eventually
  }

  return resolvedVersion;
}

function checkForNPMRC(): string | null {
  let directory = process.cwd();
  while (!existsSync(join(directory, 'package.json'))) {
    directory = dirname(directory);
  }
  const path = join(directory, '.npmrc');
  return existsSync(path) ? path : null;
}

function sortObjectByKeys(
  originalObject: Record<string, string>
): Record<string, string> {
  return Object.keys(originalObject)
    .sort()
    .reduce((obj, key) => {
      return {
        ...obj,
        [key]: originalObject[key],
      };
    }, {});
}
