import fs from 'fs';
import glob from 'fast-glob';
import * as d from 'doubter';
import globToRegExp from 'glob-to-regexp';
import { parseArgs } from 'argcat';
import { TestOptions } from '../types.js';

const CONFIG_FILE_PATHS = ['.toofastrc', 'toofast.json', 'toofast.config.json'];

const INCLUDE_GLOBS = ['**/*.perf.js', '**/*.perf.mjs', '**/*.perf.ts', '**/*.perf.mts'];

/**
 * Shape of CLI arguments.
 */
const argsShape = d
  .object({
    // Config file path
    config: d.string().coerce(),

    // Array of test file globs
    include: d.array(d.string()),

    // Array of setup file globs
    setup: d.array(d.string()),

    // Array of test name globs to enable
    '': d.array(d.string()),

    // CLI arguments override test options from config file
    measureTimeout: d.number().int().positive().coerce(),
    targetRme: d.number().gt(0).lt(1).coerce(),
    warmupIterationCount: d.number().int().positive().coerce(),
    batchIterationCount: d.number().int().positive().coerce(),
    batchTimeout: d.number().int().positive().coerce(),
    batchIntermissionTimeout: d.number().int().positive().coerce(),
  })
  .partial()

  // Don't allow unknown arguments
  .exact() satisfies d.Shape<any, TestOptions>;

/**
 * Shape of global test options.
 */
const testOptionsShape = d
  .object({
    measureTimeout: d.number().int().positive(),
    targetRme: d.number().gt(0).lt(1),
    warmupIterationCount: d.number().int().positive(),
    batchIterationCount: d.number().int().positive(),
    batchTimeout: d.number().int().positive(),
    batchIntermissionTimeout: d.number().int().positive(),
  })
  .partial()
  .strip() satisfies d.Shape<any, TestOptions>;

/**
 * Shape of a config read from a file.
 */
export const rcShape = d
  .object({
    testOptions: testOptionsShape,

    // Array of test file globs
    include: d.array(d.string()),

    // Array of setup file globs
    setup: d.array(d.string()),
  })
  .partial();

/**
 * Parsed config consumed by the master runner.
 */
interface Config {
  /**
   * The array of glob patters of files that are evaluated in the test environment before any test suites are run.
   */
  setupFiles: string[] | undefined;

  /**
   * The array of glob patterns of included test files.
   */
  includeFiles: string[];

  /**
   * The list of test name patterns that must be run. If omitted then all tests are run.
   *
   * @see {@link TestSuiteLifecycleOptions.testNamePatterns}
   */
  testNamePatterns: RegExp[] | undefined;

  /**
   * The default test options.
   */
  testOptions: TestOptions | undefined;
}

/**
 * Parses CLI arguments and loads config from a file if needed.
 */
export function loadConfig(): Config {
  const args = argsShape.parse(parseArgs(process.argv.slice(2)));

  const configFile = args.config || CONFIG_FILE_PATHS.find(file => fs.existsSync(file));

  const config = configFile === undefined ? {} : rcShape.parse(JSON.parse(fs.readFileSync(configFile, 'utf8')));

  const setup = args.setup || config.setup;
  const include = args.include || config.include || INCLUDE_GLOBS;

  return {
    setupFiles: setup?.flatMap(pattern => glob.sync(pattern, { absolute: true })),
    includeFiles: include.flatMap(pattern => glob.sync(pattern, { absolute: true })),
    testNamePatterns: args['']?.map(pattern => globToRegExp(pattern, { flags: 'i' })),
    testOptions: { ...config.testOptions, ...args },
  };
}
