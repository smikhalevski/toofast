import fs from 'fs';
import glob from 'fast-glob';
import * as d from 'doubter';
import globToRegExp from 'glob-to-regexp';
import { parseArgs } from 'argcat';
import { TestOptions } from '../types.js';
import { loadFile } from './loadFile.js';

const DEFAULT_CONFIG_FILE_PATHS = [
  '.toofastrc',
  'toofast.json',
  'toofast.config.json',
  'toofast.config.js',
  'toofast.config.mjs',
  'toofast.config.ts',
  'toofast.config.mts',
];

const DEFAULT_INCLUDE = ['**/*.perf.js', '**/*.perf.mjs', '**/*.perf.ts', '**/*.perf.mts'];

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

    // Array of test name globs
    '': d.array(d.string()),

    // Test options overrides
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
export const configShape = d
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
interface ParsedConfig {
  /**
   * The array of glob patters of files that are evaluated in the test environment before any test suites are run.
   */
  setupFilePaths: string[] | undefined;

  /**
   * The array of glob patterns of included test files.
   */
  includeFilePaths: string[];

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
export function loadConfig(): Promise<ParsedConfig> {
  const args = argsShape.parse(parseArgs(process.argv.slice(2)));

  const configFilePath = args.config || DEFAULT_CONFIG_FILE_PATHS.find(filePath => fs.existsSync(filePath));

  if (configFilePath === undefined) {
    // Zero config
    return Promise.resolve(parseConfig(args, {}));
  }

  return loadFile(configFilePath)
    .then(configShape.parse)
    .then(config => parseConfig(args, config));
}

function parseConfig(args: d.Output<typeof argsShape>, config: d.Output<typeof configShape>): ParsedConfig {
  const setup = args.setup || config.setup;
  const include = args.include || config.include || DEFAULT_INCLUDE;

  const setupFilePaths = setup?.flatMap(pattern => glob.sync(pattern, { absolute: true }));
  const includeFilePaths = include.flatMap(pattern => glob.sync(pattern, { absolute: true }));

  const testNamePatterns = args['']?.map(pattern => globToRegExp(pattern, { flags: 'i' }));

  return {
    setupFilePaths,
    includeFilePaths,
    testNamePatterns,
    testOptions: { ...config.testOptions, ...args },
  };
}
