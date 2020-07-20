#!/usr/bin/env node

import { statSync } from 'fs';
import { execSync } from 'child_process';
import * as yargsParser from 'yargs-parser';

const inquirer = require('inquirer');

const parsedArgs = yargsParser(process.argv, {
  string: ['version'],
  boolean: ['verbose']
});

function isYarn() {
  try {
    statSync('yarn.lock');
    return true;
  } catch (e) {
    return false;
  }
}

function addDependency(dep: string) {
  const stdio = parsedArgs.verbose ? [0, 1, 2] : ['ignore', 'ignore', 'ignore'];
  if (isYarn()) {
    execSync(`yarn add -D ${dep}`, { stdio });
  } else {
    execSync(`npm i --save-dev ${dep}`, { stdio });
  }
}

function addNxCloud() {
  return inquirer
    .prompt([
      {
        name: 'NxCloud',
        message: `Use the free tier of the distributed cache provided by Nx Cloud?`,
        type: 'list',
        choices: [
          {
            value: 'yes',
            name:
              'Yes [Faster command execution, faster CI. Learn more at https://nx.app]',
          },

          {
            value: 'no',
            name: 'No  [Only use local computation cache]',
          },
        ],
        default: 'no',
      },
    ])
    .then((a: { NxCloud: 'yes' | 'no' }) => a.NxCloud === 'yes');
}

async function main() {
  const version = parsedArgs.version ? parsedArgs.version : `^10.0.0`;

  const output = require('@nrwl/workspace/src/utils/output').output;
  output.log({ title: 'Nx initialization' });

  addDependency(`@nrwl/workspace@${version}`);
  execSync(`nx g @nrwl/workspace:ng-add --preserveAngularCLILayout`, { stdio: [0, 1, 2] });

  if (await addNxCloud()) {
    output.log({ title: 'Nx Cloud initialization' });
    addDependency(`@nrwl/nx-cloud`);
    execSync(`nx g @nrwl/nx-cloud:init`, { stdio: [0, 1, 2] });
  }

  execSync('npm install', {stdio: ['ignore', 'ignore', 'ignore']});

  const buildCmd = isYarn() ? `"yarn ng build"` : `"npm run ng build"`;

  output.success({
    title: 'Angular CLI is faster now!', bodyLines: [
      `Execute ${buildCmd} twice to see the computation caching in action.`,
      `Learn more about computation caching, how it is shared with your teammates,`,
      `and how it can speed up your CI by up to 10 times at https://nx.app/make-angular-cli-faster`
    ]
  });
}

main().then(() => {
  process.exit(0);
}).catch((e) => {
  console.log(e);
  process.exit(1);
});
