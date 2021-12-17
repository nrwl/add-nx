import { readJsonSync, writeJsonSync } from 'fs-extra';

export function addCRACommandsToWorkspaceJson(
  appName: string,
  appIsJs: boolean
) {
  const packageJson = readJsonSync(`apps/${appName}/package.json`);
  packageJson.scripts = {
    ...packageJson.scripts,
    start: 'react-app-rewired start',
    serve: 'npm start',
    build: 'react-app-rewired build',
    test: 'react-app-rewired test',
  };
  writeJsonSync(`apps/${appName}/package.json`, packageJson);
}
