import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

export function addPostinstallPatch() {
  execSync('mkdir -p  tools/scripts', { stdio: [0, 1, 2] });
  writeFileSync(
    './tools/scripts/patch-react-app-rewired.js',
    `
// This is needed until we move to craco (https://github.com/gsoft-inc/craco)
const fs = require('fs');
const patchFile = 'node_modules/react-app-rewired/scripts/utils/babelTransform.js'
let content = fs.readFileSync(patchFile).toString();
content = content.replace('babelJest.createTransformer', 'babelJest.default.createTransformer');
fs.writeFileSync(patchFile, content);
`
  );
  const json = JSON.parse(readFileSync('./package.json').toString());
  json.scripts.postinstall = 'node tools/scripts/patch-react-app-rewired.js';
  writeFileSync('./package.json', JSON.stringify(json, null, 2));
}
