import { execSync } from 'child_process';

export function addCRACommandsToWorkspaceJson(
  appName: string,
  appIsJs: boolean
) {
  execSync(
    `nx g @nrwl/workspace:run-commands serve \
    --project ${appName} \
    --command "node ../../node_modules/.bin/react-app-rewired start" \
    --cwd "apps/${appName}"`,
    { stdio: [0, 1, 2] }
  );

  execSync(
    `nx g @nrwl/workspace:run-commands build \
    --project ${appName} \
    --command "node ../../node_modules/.bin/react-app-rewired build" \
    --cwd "apps/${appName}"`,
    { stdio: [0, 1, 2] }
  );

  execSync(
    `nx g @nrwl/workspace:run-commands lint \
    --project ${appName} \
    --command "node ../../node_modules/.bin/eslint${
      appIsJs ? '' : ' src/**/*.tsx src/**/*.ts'
    }" \
    --cwd "apps/${appName}"`,
    { stdio: [0, 1, 2] }
  );

  execSync(
    `nx g @nrwl/workspace:run-commands test \
    --project ${appName} \
    --command "node ../../node_modules/.bin/react-app-rewired test --watchAll=false" \
    --cwd "apps/${appName}"`,
    { stdio: [0, 1, 2] }
  );
}
