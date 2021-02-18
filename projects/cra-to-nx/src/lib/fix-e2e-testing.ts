import { fileExists } from '@nrwl/workspace/src/utilities/fileutils';
import * as fs from 'fs';

export function fixE2eTesting(appName: string) {
  const data = fs.readFileSync(`workspace.json`);
  const json = JSON.parse(data.toString());
  json.projects[`${appName}-e2e`].targets.e2e = {
    executor: '@nrwl/workspace:run-commands',
    options: {
      commands: [`nx serve ${appName}`, `nx e2e-run-when-ready ${appName}-e2e`],
    },
  };
  json.projects[`${appName}-e2e`].targets['e2e-run'] = {
    executor: '@nrwl/cypress:cypress',
    options: {
      cypressConfig: `apps/${appName}-e2e/cypress.json`,
      tsConfig: `apps/${appName}-e2e/tsconfig.e2e.json`,
      baseUrl: 'http://localhost:3000',
    },
    configurations: {
      production: { devServerTarget: `${appName}:serve:production` },
    },
  };
  json.projects[`${appName}-e2e`].targets['e2e-run-when-ready'] = {
    executor: '@nrwl/workspace:run-commands',
    options: {
      commands: [`nx e2e-run ${appName}-e2e`],
      readyWhen: 'http://localhost:3000',
    },
  };
  fs.writeFileSync(`workspace.json`, JSON.stringify(json, null, 2));

  if (fileExists(`apps/${appName}-e2e/src/integration/app.spec.ts`)) {
    const integrationE2eTest = `
      describe('${appName}', () => {
        beforeEach(() => cy.visit('/'));
        it('should contain a body', () => {
          cy.get('body').should('exist');
        });
      });`;
    fs.writeFileSync(
      `apps/${appName}-e2e/src/integration/app.spec.ts`,
      integrationE2eTest
    );
  }
}
