#!/usr/bin/env node
import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import { output } from '@nrwl/workspace/src/utilities/output';
import { execSync } from 'child_process';
import {
  existsSync,
  statSync,
  moveSync,
  removeSync,
  readdirSync,
} from 'fs-extra';

import { addBuildPathToWorkspaceJson } from './add-build-path-to-workspace-json';
import { addCRACommandsToWorkspaceJson } from './add-cra-commands-to-nx';
import { checkForUncommittedChanges } from './check-for-uncommitted-changes';
import { fixE2eTesting } from './fix-e2e-testing';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { setupTsConfig } from './tsconfig-setup';
import { writeConfigOverrides } from './write-config-overrides';

let packageManager: string;
function checkPackageManager() {
  packageManager = existsSync('yarn.lock')
    ? 'yarn'
    : existsSync('pnpm-lock.yaml')
    ? 'pnpm'
    : 'npm';
}

function addDependency(dep: string, dev?: boolean) {
  output.log({ title: `📦 Adding dependency: ${dep}` });
  if (packageManager === 'yarn') {
    execSync(`yarn add ${dev ? '-D ' : ''}${dep}`, { stdio: [0, 1, 2] });
  } else if (packageManager === 'pnpm') {
    execSync(`pnpm i ${dev ? '--save-dev ' : ''}${dep}`, { stdio: [0, 1, 2] });
  } else {
    execSync(`npm i ${dev ? '--save-dev ' : ''}${dep}`, { stdio: [0, 1, 2] });
  }
}

export async function createNxWorkspaceForReact() {
  checkForUncommittedChanges();
  checkPackageManager();

  output.log({ title: '🐳 Nx initialization' });

  let appIsJs = true;

  if (fileExists(`tsconfig.json`)) {
    console.log('THE APP IS IN TS');
    appIsJs = false;
  }

  const reactAppName = readNameFromPackageJson();

  execSync(
    `npx create-nx-workspace@latest temp-workspace --appName=${reactAppName} --preset=react --style=css --nx-cloud --packageManager=${packageManager}`,
    { stdio: [0, 1, 2] }
  );

  output.log({ title: '👋 Welcome to Nx!' });

  output.log({ title: '🧹 Clearing unused files' });

  removeSync(`temp-workspace/apps/${reactAppName}/`);
  removeSync('node_modules');

  output.log({ title: '🚚 Moving your React app in your new Nx workspace' });

  const requiredCraFiles = [
    'package.json',
    'src',
    'public',
    appIsJs ? null : 'tsconfig.json',
    packageManager === 'yarn' ? 'yarn.lock' : null,
    packageManager === 'pnpm' ? 'pnpm-lock.yaml' : null,
    packageManager === 'npm' ? 'package-lock.json' : null,
  ];

  const optionalCraFiles = [
    'README.md',
  ];

  const filesToMove = [...requiredCraFiles, ...optionalCraFiles].filter(Boolean);

  filesToMove.forEach((f) => {
    try {
      moveSync(f, `temp-workspace/apps/${reactAppName}/${f}`, { overwrite: true });
    } catch (error) {
      if (requiredCraFiles.includes(f)) {
        throw error;
      }
    }
  });

  process.chdir('temp-workspace/');

  output.log({ title: '🤹 Add CRA commands to workspace.json' });

  addCRACommandsToWorkspaceJson(reactAppName, appIsJs);

  addBuildPathToWorkspaceJson(reactAppName);

  output.log({ title: '🧑‍🔧 Customize webpack' });

  writeConfigOverrides(reactAppName);

  output.log({
    title: '🛬 Skip CRA preflight check since Nx manages the monorepo',
  });

  execSync(`echo "SKIP_PREFLIGHT_CHECK=true" > .env`, { stdio: [0, 1, 2] });

  output.log({ title: '🧶 Add all node_modules to .gitignore' });

  execSync(`echo "node_modules" >> .gitignore`, { stdio: [0, 1, 2] });

  process.chdir('../');

  output.log({ title: '🚚 Folder restructuring.' });

  readdirSync('./temp-workspace').forEach((f) => {
    moveSync(`temp-workspace/${f}`, `./${f}`, { overwrite: true });
  });

  output.log({ title: '🧹 Cleaning up.' });

  removeSync('temp-workspace');

  output.log({ title: "📃 Extend the app's tsconfig.json from the base" });
  output.log({ title: '📃 Add tsconfig files for jest and eslint' });
  output.log({ title: '📃 Disable react/react-in-jsx-scope eslint rule' });
  output.log({ title: '📃 Setup app-specific eslint' });

  setupTsConfig(reactAppName);

  output.log({ title: '📃 Setup e2e tests' });

  fixE2eTesting(reactAppName);

  output.log({ title: '🙂 Please be patient, one final step remaining!' });

  output.log({
    title: '🧶 Adding npm packages to your new Nx workspace to support CRA',
  });

  addDependency('react-scripts', true);
  addDependency('@testing-library/jest-dom', true);
  addDependency('eslint-config-react-app', true);
  addDependency('react-app-rewired', true);
  addDependency('web-vitals', true);
  addDependency('jest-watch-typeahead', true); // Only for ts apps?

  output.log({
    title: '🎉 Done!',
  });
  output.note({
    title: 'First time using Nx? Check out this interactive Nx tutorial.',
    bodyLines: [
      `https://nx.dev/react/tutorial/01-create-application`,
      ` `,
      `Prefer watching videos? Check out this free Nx course on Egghead.io.`,
      `https://egghead.io/playlists/scale-react-development-with-nx-4038`,
    ],
  });

  output.note({
    title: 'Or, you can try the commands!',
    bodyLines: [
      `nx serve ${reactAppName}`,
      `nx build ${reactAppName}`,
      `nx lint ${reactAppName}`,
      `nx test ${reactAppName}`,
      ` `,
      `https://nx.dev/latest/react/migration/migration-cra#10-try-the-commands`,
    ],
  });
}
