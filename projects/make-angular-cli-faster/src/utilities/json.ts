import { readFileSync } from 'fs';
import * as stripJsonComments from 'strip-json-comments';

export function readJsonFile(file: string) {
  return JSON.parse(stripJsonComments(readFileSync(file).toString()));
}
