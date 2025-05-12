import fs from 'fs';
import glob from 'fast-glob';
import * as d from 'doubter';
import globToRegExp from 'glob-to-regexp';
import { parseArgs } from 'argcat';
import { TestOptions } from './index.js';

const CONFIG_PATHS = ['.toofastrc', 'toofast.json', 'toofast.config.json'];

const INCLUDE_GLOBS = ['**/*.perf.js', '**/*.perf.mjs', '**/*.perf.ts', '**/*.perf.mts'];

/**
 * Shape of CLI arguments.
 */
const processArgsShape = d
  .object({
    // A config file path
    config: d.string().coerce().optional(),

    // An array of test suite file globs
    include: d.array(d.string()).optional(),

    // An array of setup file globs
    setup: d.array(d.string()).optional(),

    // An array of test name globs to enable
    '': d.array(d.string()),

    // CLI arguments override test options from config file
    measureTimeout: d.number().int().positive().coerce().optional(),
    targetRme: d.number().gt(0).lt(1).coerce().optional(),
    warmupIterationCount: d.number().int().positive().coerce().optional(),
    batchIterationCount: d.number().int().positive().coerce().optional(),
    batchTimeout: d.number().int().positive().coerce().optional(),
    batchIntermissionTimeout: d.number().int().positive().coerce().optional(),
  })

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

    // An array of test suite file globs
    include: d.array(d.string()),

    // An array of setup file globs
    setup: d.array(d.string()),
  })
  .partial();

/**
 * Parsed config consumed by the runner.
 */
export interface Config {
  /**
   * The base directory from which config was loaded.
   */
  baseDir: string;

  /**
   * An array of URIs of modules that are loaded before each test suite.
   */
  setupFilePaths: string[];

  /**
   * An array of URIs of test suite modules.
   */
  testFilePaths: string[];

  /**
   * A list of test name patterns.
   */
  testRegExps: RegExp[];

  /**
   * The default test options.
   */
  testOptions: TestOptions;
}

/**
 * Parses CLI arguments and loads config from a file if needed.
 */
export function resolveConfig(baseDir = process.cwd()): Config {
  const args = processArgsShape.parse(parseArgs(process.argv.slice(2)));

  const configFile = args.config || CONFIG_PATHS.find(filePath => fs.existsSync(filePath));

  const config = configFile === undefined ? {} : configShape.parse(JSON.parse(fs.readFileSync(configFile, 'utf8')));

  const setup = args.setup || config.setup || [];
  const include = args.include || config.include || INCLUDE_GLOBS;

  return {
    baseDir,
    setupFilePaths: setup.flatMap(src => glob.sync(src, { cwd: baseDir, absolute: true })),
    testFilePaths: include.flatMap(src => glob.sync(src, { cwd: baseDir, absolute: true })),
    testRegExps: args[''].map(src => globToRegExp(src, { flags: 'i' })),
    testOptions: { ...config.testOptions, ...args },
  };
}
