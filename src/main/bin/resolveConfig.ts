import path from 'path';
import fs from 'fs';
import { red } from 'kleur/colors';
import { Config } from './bin-types.js';

const configFilePaths = ['.toofastrc', 'toofast.json', 'toofast.config.js'];

/**
 * Returns a config descriptor or terminates the process with the error code.
 *
 * @param cwd The directory to search config file.
 * @param configFilePath The user provided config file path.
 */
export function resolveConfig(cwd: string, configFilePath: string | undefined): { cwd: string; config: Config } {
  if (configFilePath !== undefined) {
    return readConfig(path.resolve(cwd, configFilePath));
  }
  for (const configFilePath of configFilePaths) {
    const filePath = path.resolve(cwd, configFilePath);

    if (fs.existsSync(filePath)) {
      return readConfig(filePath);
    }
  }
  return { cwd, config: {} };
}

function readConfig(filePath: string) {
  try {
    return {
      cwd: path.dirname(filePath),
      config: require(filePath),
    };
  } catch (error) {
    console.log(red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}
