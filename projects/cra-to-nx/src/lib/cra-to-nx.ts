#!/usr/bin/env node
import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import { output } from '@nrwl/workspace/src/utilities/output';
import { execSync } from 'child_process';

import { statSync } from 'fs-extra';
import { addCRACommandsToWorkspaceJson } from './add-cra-commands-to-nx';
import { checkForUncommittedChanges } from './check-for-uncommitted-changes';
import { readNameFromPackageJson } from './read-name-from-package-json';
import { setupTsConfig } from './tsconfig-setup';
import { writeConfigOverrides } from './write-config-overrides';

function isYarn() {
  try {
    statSync('yarn.lock');
    return true;
  } catch (e) {
    return false;
  }
}

function addDependency(dep: string, dev?: boolean) {
  output.log({ title: `📦 Adding dependency: ${dep}` });
  if (isYarn()) {
    execSync(`yarn add ${dev ? '-D ' : ''}${dep}`, { stdio: [0, 1, 2] });
  } else {
    execSync(`npm i ${dev ? '--save-dev ' : ''}${dep}`, { stdio: [0, 1, 2] });
  }
}

export async function createNxWorkspaceForReact() {
  checkForUncommittedChanges();

  output.log({ title: '🐳 Nx initialization' });

  let appIsJs = true;

  if (fileExists(`tsconfig.json`)) {
    console.log('THE APP IS IN TS');
    appIsJs = false;
  }

  const reactAppName = readNameFromPackageJson();
  execSync(
    `npx create-nx-workspace temp-workspace --appName=${reactAppName} --preset=react --style=css --nx-cloud`,
    { stdio: [0, 1, 2] }
  );

  /**
   * The following step will not be needed in the future
   * https://github.com/nrwl/nx/pull/4678
   */
  execSync(
    `git restore .gitignore README.md package.json${
      fileExists(`tsconfig.json`) ? ' tsconfig.json' : ''
    }`
  );

  output.log({ title: '👋 Welcome to Nx!' });

  output.log({ title: '🧹 Clearing unused files' });
  execSync(
    `rm -rf temp-workspace/apps/${reactAppName}/* temp-workspace/apps/${reactAppName}/{.babelrc,.browserslistrc} node_modules`,
    { stdio: [0, 1, 2] }
  );

  output.log({ title: '🚚 Moving your React app in your new Nx workspace' });
  execSync(
    `mv ./{README.md,package.json,src,public${
      fileExists(`tsconfig.json`) ? ',tsconfig.json' : ''
    }} temp-workspace/apps/${reactAppName}`,
    { stdio: [0, 1, 2] }
  );
  process.chdir(`temp-workspace/`);

  output.log({ title: '🤹 Add CRA commands to workspace.json' });

  addCRACommandsToWorkspaceJson(reactAppName, appIsJs);

  output.log({ title: '🧑‍🔧 Customize webpack' });

  writeConfigOverrides(reactAppName);

  output.log({
    title: '🛬 Skip CRA preflight check since Nx manages the monorepo',
  });

  execSync(`echo "SKIP_PREFLIGHT_CHECK=true" > .env`, { stdio: [0, 1, 2] });

  output.log({ title: '🧶 Add all node_modules to .gitignore' });

  execSync(`echo "node_modules" >> .gitignore`, { stdio: [0, 1, 2] });

  output.log({ title: '🚚 Folder restructuring.' });

  process.chdir(`../`);

  execSync('mv temp-workspace/* ./', { stdio: [0, 1, 2] });
  execSync(
    'mv temp-workspace/{.editorconfig,.env,.eslintrc.json,.gitignore,.prettierignore,.prettierrc,.vscode} ./',
    { stdio: [0, 1, 2] }
  );
  execSync('rm -rf temp-workspace', { stdio: [0, 1, 2] });

  output.log({ title: "📃 Extend the app's tsconfig.json from the base" });
  output.log({ title: '📃 Add tsconfig files for jest and eslint' });
  output.log({ title: '📃 Disable react/react-in-jsx-scope eslint rule' });
  output.log({ title: '📃 Setup app-specific eslint' });

  setupTsConfig(reactAppName);

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
