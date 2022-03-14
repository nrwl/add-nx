import { execSync } from 'child_process';
import { prompt } from 'inquirer';
import { getPackageManagerCommand } from './package-manager';

export async function promptForNxCloud(): Promise<boolean> {
  const { useNxCloud } = await prompt([
    {
      name: 'useNxCloud',
      message: `Use Nx Cloud? (It's free and doesn't require registration.)`,
      type: 'list',
      choices: [
        {
          value: 'yes',
          name:
            'Yes [Faster builds, run details, Github integration. Learn more at https://nx.app]',
        },
        { value: 'no', name: 'No' },
      ],
      default: 'yes',
    },
  ]);

  return useNxCloud === 'yes';
}

export function initNxCloud(): void {
  execSync(`${getPackageManagerCommand().exec} nx g @nrwl/nx-cloud:init`, {
    stdio: [0, 1, 2],
  });
}
