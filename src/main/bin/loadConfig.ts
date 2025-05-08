import fs from 'fs';
import * as d from 'doubter';
import globToRegExp from 'glob-to-regexp';
import { parseArgs } from 'argcat';
import { TestOptions } from '../types.js';
import { loadFile } from '../runner/utils.js';
import { globSync } from 'fs';

const CONFIG_FILE_PATHS = [
  '.toofastrc',
  'toofast.json',
  'toofast.config.js',
  'toofast.config.mjs',
  'toofast.config.ts',
  'toofast.config.mts',
];

const INCLUDE = ['**/*.perf.js', '**/*.perf.mjs', '**/*.perf.ts', '**/*.perf.mts'];

const testOptionsShape = d
  .object({
    measureTimeout: d.number().int().positive(),
    targetRme: d.number().gt(0).lt(1),
    warmupIterationCount: d.number().int().positive(),
    batchIterationCount: d.number().int().positive(),
    batchTimeout: d.number().int().positive(),
    batchIntermissionTimeout: d.number().int().positive(),
  })
  .partial() satisfies d.Shape<any, TestOptions>;

const configShape = d
  .object({
    testOptions: testOptionsShape,
    include: d.array(d.string()),
    setup: d.array(d.string()),
  })
  .partial();

const cliOptionsShape = testOptionsShape.extend({
  config: d.string().optional(),
  include: d.array(d.string()).optional(),
  setup: d.array(d.string()).optional(),
  // testNameGlobs
  '': d.array(d.string()),
});

interface Config {
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
 * Returns a config descriptor or terminates the process with the error code.
 */
export function loadConfig(): Promise<Config> {
  const cliOptions = cliOptionsShape.parse(parseArgs(process.argv.slice(2)));

  const configFilePath = cliOptions.config || CONFIG_FILE_PATHS.find(filePath => fs.existsSync(filePath));

  const configPromise: Promise<d.Output<typeof configShape>> =
    configFilePath === undefined ? Promise.resolve({}) : loadFile(configFilePath).then(configShape.parse);

  return configPromise.then(config => {
    const include = cliOptions.include || config.include || INCLUDE;
    const setup = cliOptions.setup || config.setup;

    const includeFilePaths = include.flatMap(filePattern => globSync(filePattern));
    const setupFilePaths = setup?.flatMap(filePattern => globSync(filePattern));

    const testNamePatterns = cliOptions['']?.map(pattern => globToRegExp(pattern, { flags: 'i' }));

    return {
      includeFilePaths,
      testNamePatterns,
      setupFilePaths,
      testOptions: { ...config.testOptions, ...cliOptions },
    };
  });
}
