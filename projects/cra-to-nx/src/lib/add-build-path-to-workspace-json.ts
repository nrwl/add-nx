import * as fs from 'fs';
export function addBuildPathToWorkspaceJson(appName: string) {
  const data = fs.readFileSync(`workspace.json`);
  const json = JSON.parse(data.toString());
  json.projects[
    `${appName}`
  ].targets.build.options.outputPath = `dist/apps/${appName}`;
  json.projects[`${appName}`].targets.build.outputs = ['{options.outputPath}'];
  fs.writeFileSync(`workspace.json`, JSON.stringify(json, null, 2));
}
