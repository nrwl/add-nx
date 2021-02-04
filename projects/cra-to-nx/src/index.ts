#!/usr/bin/env node
import { createNxWorkspaceForReact } from './lib/cra-to-nx';

export * from './lib/cra-to-nx';

createNxWorkspaceForReact()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.log(e);
    process.exit(1);
  });
