import fs from 'fs';
import path from 'path';
import { parseArgs } from 'util';
import type { TestOptions } from '../index.ts';
import { toValidatedTestOptions } from '../runner.ts';
import { assert, getErrorMessage, globToRegExp, isArrayOf, isObject, isString } from '../utils.ts';

const CONFIG_FILE = 'toofast.json';

const TEST_FILE_PATTERNS = ['**/*.perf.{js,mjs,ts,mts}'];

/**
 * Test files of dependencies are never run.
 */
const EXCLUDE_PATTERNS = ['**/node_modules/**'];

/**
 * The config of a run, resolved from command line arguments and the config file.
 */
export interface Config {
  /**
   * Absolute paths of modules that are loaded before each test file.
   */
  setupFiles: string[];

  /**
   * Absolute paths of test files.
   */
  testFiles: string[];

  /**
   * Patterns of names of tests to run. If empty, all tests run. A test name is prefixed with names of enclosing describe
   * blocks, separated by dots.
   */
  testNamePatterns: RegExp[];

  /**
   * Test options from the config file, with defaults for options that aren't set.
   */
  testOptions: Required<TestOptions>;
}

/**
 * Contents of a config file. Patterns are relative to the config file.
 */
interface UserConfig {
  setupFilePatterns?: string[];
  testFilePatterns?: string[];
  testOptions?: TestOptions;
}

const defaultConfig: Required<UserConfig> = {
  setupFilePatterns: [],
  testFilePatterns: TEST_FILE_PATTERNS,
  testOptions: {},
};

/**
 * Parses command line arguments and reads the config file.
 *
 * @param args Command line arguments without the paths of the Node.js executable and the script.
 * @param cwd The directory that the path of the config file is relative to.
 */
export function resolveConfig(args = process.argv.slice(2), cwd = process.cwd()): Config {
  const { values, positionals } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
    },
    allowPositionals: true,
  });

  const configPath = values.config ?? CONFIG_FILE;
  const configFile = path.resolve(cwd, configPath);
  const configDir = path.dirname(configFile);

  // The default config file is optional
  const userConfig =
    values.config !== undefined || fs.existsSync(configFile) ? readConfigFile(configFile, configPath) : defaultConfig;

  return {
    setupFiles: globFiles(userConfig.setupFilePatterns, configDir),
    testFiles: globFiles(userConfig.testFilePatterns, configDir, EXCLUDE_PATTERNS),
    testNamePatterns: positionals.map(globToRegExp),
    testOptions: toValidatedTestOptions(userConfig.testOptions),
  };
}

/**
 * Reads a config file and checks its structure. Test options are validated separately.
 *
 * @param configFile The absolute path of the config file.
 * @param configPath The path of the config file to show in error messages.
 */
function readConfigFile(configFile: string, configPath: string): Required<UserConfig> {
  assert(fs.existsSync(configFile), "Config file doesn't exist: " + configPath);

  const config = parseConfig(fs.readFileSync(configFile, 'utf8'), configPath);

  assert(isObject(config), 'Config file must export an object: ' + configPath);

  const {
    $schema,
    setupFilePatterns = [],
    testFilePatterns = TEST_FILE_PATTERNS,
    testOptions = {},
    ...unknownOptions
  } = config;

  const unknownOptionNames = Object.keys(unknownOptions);

  assert(unknownOptionNames.length === 0, 'Unknown config option:' + unknownOptionNames[0]);

  assert(isArrayOf(setupFilePatterns, isString), 'setupFilePatterns must be an array of strings');

  assert(isArrayOf(testFilePatterns, isString), 'testFilePatterns must be an array of strings');

  assert(isObject(testOptions), 'testOptions must be an object');

  return {
    setupFilePatterns,
    testFilePatterns,
    testOptions,
  };
}

function parseConfig(json: string, configPath: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Cannot parse config: ' + configPath + '\n\n' + getErrorMessage(error));
  }
}

function globFiles(patterns: string[], dir: string, exclude: string[] = []): string[] {
  return fs.globSync(patterns, { cwd: dir, exclude }).map(file => path.resolve(dir, file));
}
