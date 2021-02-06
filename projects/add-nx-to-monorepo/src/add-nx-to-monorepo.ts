#!/usr/bin/env node

import * as stripJsonComments from 'strip-json-comments';
import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import { output } from '@nrwl/workspace/src/utils/output';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const inquirer = require('inquirer');

import { execSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ignore = require('ignore');

addNxToMonorepo().catch((e) => console.error(e));

export async function addNxToMonorepo() {
  const repoRoot = process.cwd();

  output.log({
    title: `Adding Nx to "${repoRoot}"`
  });

  const useCloud = await askAboutNxCloud();

  output.log({
    title: `Analyzing the source code and creating configuration files`
  });

  const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);

  const pds = createProjectDesc(repoRoot, packageJsonFiles);

  if (pds.length === 0) {
    output.error({ title: `Cannot find any projects in this monorepo` });
    process.exit(1);
  }

  createWorkspaceJsonFile(repoRoot, pds);
  createNxJsonFile(repoRoot, pds);
  createOrUpdateTsconfig(repoRoot, pds);

  addDepsToPackageJson(repoRoot, useCloud);

  output.log({ title: `Installing dependencies` });
  runInstall(repoRoot);

  if (useCloud) {
    initCloud(repoRoot);
  }

  printFinalMessage(repoRoot);
}

async function askAboutNxCloud() {
  return inquirer
    .prompt([
      {
        name: 'NxCloud',
        message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
        type: 'list',
        choices: [
          {
            value: 'yes',
            name:
              'Yes [Faster builds, run details, Github integration. Learn more at https://nx.app]'
          },

          {
            value: 'no',
            name: 'No'
          }
        ],
        default: 'no'
      }
    ])
    .then((a: { NxCloud: 'yes' | 'no' }) => a.NxCloud === 'yes');
}

// scanning package.json files
function allProjectPackageJsonFiles(repoRoot: string) {
  const packageJsonFiles = allPackageJsonFiles(repoRoot, repoRoot);
  return packageJsonFiles.filter((c) => c != 'package.json');
}

function allPackageJsonFiles(repoRoot: string, dirName: string) {
  const ignoredGlobs = getIgnoredGlobs(repoRoot);
  const relDirName = path.relative(repoRoot, dirName);
  if (
    relDirName &&
    (ignoredGlobs.ignores(relDirName) ||
      relDirName.indexOf(`node_modules`) > -1)
  ) {
    return [];
  }

  let res = [];
  try {
    fs.readdirSync(dirName).forEach((c) => {
      const child = path.join(dirName, c);
      if (ignoredGlobs.ignores(path.relative(repoRoot, child))) {
        return;
      }
      try {
        const s = fs.statSync(child);
        if (!s.isDirectory() && c == 'package.json') {
          res.push(path.relative(repoRoot, child));
        } else if (s.isDirectory()) {
          res = [...res, ...allPackageJsonFiles(repoRoot, child)];
        }
        // eslint-disable-next-line no-empty
      } catch (e) {
      }
    });
    // eslint-disable-next-line no-empty
  } catch (e) {
  }
  return res;
}

function getIgnoredGlobs(repoRoot: string) {
  const ig = ignore();
  try {
    ig.add(fs.readFileSync(`${repoRoot}/.gitignore`).toString());
    // eslint-disable-next-line no-empty
  } catch (e) {
  }
  return ig;
}

// creating project descs
interface ProjectDesc {
  name: string;
  dir: string;
  mainFilePath: string;
}

function createProjectDesc(
  repoRoot: string,
  packageJsonFiles: string[]
): ProjectDesc[] {
  const res = [];
  packageJsonFiles.forEach((p) => {
    const dir = path.dirname(p);
    const packageJson = readJsonFile(repoRoot, p);
    if (!packageJson.name) return;

    if (packageJson.main) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.main)
      });
    } else if (packageJson.index) {
      res.push({
        name: packageJson.name,
        dir,
        mainFilePath: path.join(dir, packageJson.index)
      });
    } else {
      res.push({ name: packageJson.name, dir, mainFilePath: null });
    }
  });
  return res;
}

function readJsonFile(repoRoot: string, file: string) {
  return JSON.parse(
    stripJsonComments(fs.readFileSync(path.join(repoRoot, file)).toString())
  );
}

// create files
function createWorkspaceJsonFile(repoRoot: string, pds: ProjectDesc[]) {
  const res = {
    version: 2,
    projects: {}
  };

  pds.forEach((f) => {
    res.projects[f.name] = { root: normalizePath(f.dir), type: 'library' };
  });

  fs.writeFileSync(`${repoRoot}/workspace.json`, JSON.stringify(res, null, 2));
}


function detectWorkspaceScope(repoRoot: string) {
  let scope = readJsonFile(repoRoot, `package.json`).name;
  if (! scope) return "undetermined";

  if (scope.startsWith('@')) {
    scope = scope.substring(1);
  }

  return scope.split("/")[0];
}

function createNxJsonFile(repoRoot: string, pds: ProjectDesc[]) {
  const scope = detectWorkspaceScope(repoRoot);
  const res = {
    npmScope: scope,
    implicitDependencies: {
      'workspace.json': '*',
      'package.json': {
        dependencies: '*',
        devDependencies: '*'
      },
      'nx.json': '*'
    },
    tasksRunnerOptions: {
      default: {
        runner: '@nrwl/workspace/tasks-runners/default',
        options: {
          cacheableOperations: ['build', 'test', 'lint', 'package']
        }
      }
    },
    projects: {},
    affected: {
      defaultBase: deduceDefaultBase()
    }
  };

  pds.forEach((f) => {
    res.projects[f.name] = { implicitDependencies: [] };
  });

  fs.writeFileSync(`${repoRoot}/nx.json`, JSON.stringify(res, null, 2));
}

function deduceDefaultBase() {
  try {
    execSync(`git rev-parse --verify main`, {stdio: ['ignore', 'ignore', 'ignore']});
    return 'main';
  } catch (e) {
    try {
      execSync(`git rev-parse --verify dev`, {stdio: ['ignore', 'ignore', 'ignore']});
      return 'dev';
    } catch (e) {
      return 'master';
    }
  }
}

function normalizeFilePath(f: string) {
  return path.extname(f) != ''
    ? f.substr(0, f.length - path.extname(f).length)
    : f;
}

function createOrUpdateTsconfig(repoRoot: string, pds: ProjectDesc[]) {
  const mappings = {};
  pds.forEach((p) => {
    mappings[p.name] = [
      normalizePath(p.mainFilePath ? normalizeFilePath(p.mainFilePath) : p.dir)
    ];
    mappings[`${p.name}/*`] = [`${normalizePath(p.dir)}/*`];
  });

  let tsconfigFileName = getTsConfigFileName(repoRoot);
  let json;

  if (tsconfigFileName) {
    json = readJsonFile(repoRoot, tsconfigFileName);
  } else {
    tsconfigFileName = 'tsconfig.base.json';
    json = {};
  }
  if (json.compilerOptions && json.compilerOptions.paths) {
    json.compilerOptions.paths = { ...json.compilerOptions.paths, ...mappings };
  } else {
    if (!json.compilerOptions) {
      json.compilerOptions = {};
    }
    json.compilerOptions.paths = mappings;
    json.compilerOptions.baseUrl ='.';
  }
  fs.writeFileSync(tsconfigFileName, JSON.stringify(json, null, 2));
}

function getTsConfigFileName(repoRoot: string) {
  try {
    readJsonFile(repoRoot, `tsconfig.base.json`);
    return `tsconfig.base.json`;
  } catch (e) {
    try {
      readJsonFile(repoRoot, `tsconfig.json`);
      return `tsconfig.json`;
    } catch (e) {
      return null;
    }
  }
}

// add dependencies
function addDepsToPackageJson(repoRoot: string, useCloud: boolean) {
  const json = readJsonFile(repoRoot, `package.json`);
  if (!json.devDependencies) json.devDependencies = {};
  json.devDependencies['@nrwl/workspace'] = 'latest';
  json.devDependencies['@nrwl/cli'] = 'latest';
  json.devDependencies['@nrwl/tao'] = 'latest';
  if (!(json.dependencies && json.dependencies['typescript']) && !json.devDependencies['typescript']) {
    json.devDependencies['typescript'] = '4.1.3';
  }
  if (useCloud) {
    json.devDependencies['@nrwl/nx-cloud'] = 'latest';
  }
  fs.writeFileSync(`package.json`, JSON.stringify(json, null, 2));
}

function runInstall(repoRoot: string) {
  cp.execSync(getPackageManagerCommand(repoRoot).install, { stdio: [0, 1, 2] });
}

function initCloud(repoRoot: string) {
  execSync(
    `${getPackageManagerCommand(repoRoot).exec} nx g @nrwl/nx-cloud:init`,
    {
      stdio: [0, 1, 2]
    }
  );
}

function getPackageManagerCommand(
  repoRoot: string
): {
  install: string;
  exec: string;
} {
  const packageManager = fs.existsSync(path.join(repoRoot, 'yarn.lock'))
    ? 'yarn'
    : fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))
      ? 'pnpm'
      : 'npm';

  switch (packageManager) {
    case 'yarn':
      return {
        install: 'yarn',
        exec: 'yarn'
      };

    case 'pnpm':
      return {
        install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
        exec: 'pnpx'
      };

    case 'npm':
      return {
        install: 'npm install --legacy-peer-deps',
        exec: 'npx'
      };
  }
}

function printFinalMessage(repoRoot) {
  output.success({
    title: `Successfully added Nx to "${repoRoot}"`,
    bodyLines: [
      `- Computation caching and code change analysis are enabled.`,
      `- Run "${
        getPackageManagerCommand(repoRoot).exec
      } nx run-many --target=build --all --parallel" to run the build script for every project in the monorepo.`,
      `- Run it again to replay the cached computation.`,
      `- Run "nx dep-graph" to see the structure of the monorepo.`,
      `- Learn more at https://nx.dev/migration/adding-to-monorepo`
    ]
  });
}

function removeWindowsDriveLetter(osSpecificPath: string): string {
  return osSpecificPath.replace(/^[A-Z]:/, '');
}

function normalizePath(osSpecificPath: string): string {
  return removeWindowsDriveLetter(osSpecificPath).split(path.sep).join('/');
}
