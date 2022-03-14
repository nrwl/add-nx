import { output } from '@nrwl/workspace/src/utilities/output';
import { execSync } from 'child_process';
import { prompt } from 'inquirer';
import { lt, lte, major, satisfies } from 'semver';
import { readJsonFile } from './json';
import {
  getPackageManagerCommand,
  resolvePackageVersion,
} from './package-manager';
import { MigrationDefinition } from './types';
import { workspaceRoot } from './workspace-root';

// up to this version the generator was in the @nrwl/workspace package
const latestWorkspaceVersionWithMigration = '13.8.8';
// up to this version the preserveAngularCLILayout option was used
const latestVersionWithOldFlag = '13.8.3';
// map of Angular major versions to the versions of Nx that are compatible with them,
// key is the Angular major version, value is an object with the range of supported
// versions and the max version of the range if there's a bigger major version that
// is already supported
const nxAngularVersionMap: Record<number, { range: string; max?: string }> = {
  13: { range: '>= 13.2.0' },
};
// latest major version of Angular that is compatible with Nx, based on the map above
const latestCompatibleAngularMajorVersion = Math.max(
  ...Object.keys(nxAngularVersionMap).map((x) => +x)
);

export async function determineMigration(
  version: string | undefined
): Promise<MigrationDefinition> {
  const angularVersion = getInstalledAngularVersion();
  const majorAngularVersion = major(angularVersion);

  if (version) {
    const normalizedVersion = normalizeVersion(version);
    if (lte(normalizedVersion, latestWorkspaceVersionWithMigration)) {
      // specified version should use @nrwl/workspace:ng-add
      return { packageName: '@nrwl/workspace', version: normalizedVersion };
    }

    // if greater than the latest workspace version with the migration,
    // check the versions map for compatibility with Angular
    if (
      nxAngularVersionMap[majorAngularVersion] &&
      satisfies(
        normalizedVersion,
        nxAngularVersionMap[majorAngularVersion].range
      )
    ) {
      // there's a match, use @nrwl/angular:ng-add
      return { packageName: '@nrwl/angular', version: normalizedVersion };
    }

    // it's not compatible with the currently installed Angular version,
    // suggest the latest possible version to use
    await findAndSuggestVersionToUse(
      angularVersion,
      majorAngularVersion,
      version
    );
  }

  if (lt(angularVersion, '13.0.0')) {
    // Angular < 13.0.0 should use @nrwl/workspace:ng-add
    return {
      packageName: '@nrwl/workspace',
      version: latestWorkspaceVersionWithMigration,
    };
  }

  // Angular >= 13.0.0 should use @nrwl/angular:ng-add
  return {
    packageName: '@nrwl/angular',
    version: resolvePackageVersion(
      '@nrwl/angular',
      `^${majorAngularVersion}.0.0`
    ),
  };
}

export function migrateWorkspace(migration: MigrationDefinition): void {
  const preserveAngularCliLayoutFlag = lte(
    migration.version,
    latestVersionWithOldFlag
  )
    ? '--preserveAngularCLILayout'
    : '--preserve-angular-cli-layout';
  execSync(
    `${getPackageManagerCommand().exec} nx g ${
      migration.packageName
    }:ng-add ${preserveAngularCliLayoutFlag}`,
    { stdio: [0, 1, 2] }
  );
}

async function findAndSuggestVersionToUse(
  angularVersion: string,
  majorAngularVersion: number,
  userSpecifiedVersion: string
): Promise<MigrationDefinition> {
  let latestNxCompatibleVersion: string;
  if (lt(angularVersion, '13.0.0')) {
    // use @nrwl/workspace:ng-add
    latestNxCompatibleVersion = latestWorkspaceVersionWithMigration;
  } else if (nxAngularVersionMap[majorAngularVersion]?.max) {
    // use the max of the range
    latestNxCompatibleVersion = nxAngularVersionMap[majorAngularVersion].max;
  } else if (majorAngularVersion > latestCompatibleAngularMajorVersion) {
    // installed Angular version is not supported yet
    output.error({
      title: '❌ Cannot proceed with the migration.',
      bodyLines: [
        `The installed Angular version "${angularVersion}" is not yet supported by Nx.`,
        `Please keep an eye on the Nx releases for an update supporting it. We aim to support new Angular releases soon after they are released.`,
      ],
    });
    process.exit(1);
  } else {
    // use latest
    latestNxCompatibleVersion = resolvePackageVersion(
      '@nrwl/angular',
      'latest'
    );
  }

  const useSuggestedVersion = await promptForVersion(latestNxCompatibleVersion);
  if (useSuggestedVersion) {
    // should use @nrwl/workspace:ng-add if the version is less than the
    // latest workspace version that has the migration, otherwise use
    // @nrwl/angular:ng-add
    return {
      packageName: lte(
        latestNxCompatibleVersion,
        latestWorkspaceVersionWithMigration
      )
        ? '@nrwl/workspace'
        : '@nrwl/angular',
      version: latestNxCompatibleVersion,
    };
  }

  output.error({
    title: `❌ Cannot proceed with the migration.`,
    bodyLines: [
      `The specified Nx version "${userSpecifiedVersion}" is not compatible with the installed Angular version "${angularVersion}".`,
    ],
  });
  process.exit(1);
}

async function promptForVersion(version: string): Promise<boolean> {
  const result = await prompt([
    {
      name: 'version',
      message: `The provided version of Nx is not compatible with the installed Angular CLI version. Would you like to use the recommended version "${version}" instead?`,
      type: 'confirm',
      default: true,
    },
  ]);

  return result.version;
}

function getInstalledAngularVersion(): string {
  const packageJsonPath = require.resolve('@angular/core/package.json', {
    paths: [workspaceRoot],
  });
  return readJsonFile(packageJsonPath).version;
}

function normalizeVersion(version: string): string {
  if (
    version.startsWith('^') ||
    version.startsWith('~') ||
    version.split('.').length < 3
  ) {
    return resolvePackageVersion('@nrwl/angular', version);
  }

  return version;
}
