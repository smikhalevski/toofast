import { fork } from 'child_process';
import path from 'path';
import { emptyHistogramSummary } from '../Histogram.ts';
import type { TestOptions } from '../index.ts';
import {
  type Block,
  getTestBlocks,
  pruneBlocks,
  type Reporter,
  type TestBlock,
  type TestModule,
  type WorkerEvent,
  type WorkerJob,
} from '../runner.ts';
import { getErrorMessage } from '../utils.ts';
import type { Config } from './resolveConfig.ts';

// Sources have the .ts extension, and the build has the .js extension
const WORKER_FILE = path.join(import.meta.dirname, 'worker' + path.extname(import.meta.filename));

const WORKER_EXEC_ARGV = getWorkerExecArgv({
  execArgv: process.execArgv,
  isTypeStrippingEnabled: process.features.typescript !== false,
});

export interface GetWorkerExecArgvParams {
  /**
   * Node.js options of the main process.
   */
  execArgv: readonly string[];

  /**
   * `true` if the main process strips types from TypeScript files.
   */
  isTypeStrippingEnabled: boolean;
}

/**
 * Returns Node.js options for worker processes.
 */
export function getWorkerExecArgv(params: GetWorkerExecArgvParams): string[] {
  const { execArgv, isTypeStrippingEnabled } = params;

  // The inspector port is already in use by the main process
  const workerExecArgv = execArgv.filter(arg => !arg.startsWith('--inspect'));

  // Versions before 22.18 strip types only if the option is enabled
  if (!isTypeStrippingEnabled) {
    workerExecArgv.push('--experimental-strip-types', '--no-warnings=ExperimentalWarning');
  }

  return workerExecArgv;
}

export interface RunTestFilesParams {
  config: Config;
  reporter: Reporter;
}

/**
 * Runs tests in worker processes and exits. For each test file, a worker collects describe blocks and tests, and then
 * each test runs in a new worker.
 *
 * Blocks of all test files are collected before tests run, so the reporter gets all of them in
 * {@link Reporter.onTestModulesCollected}, for example, to align results of all tests.
 *
 * If a test file can't be imported, or a worker exits before it finishes, the error is reported and other tests still
 * run. Exits with code `1` if there were errors or no tests.
 */
export async function runTestFiles(params: RunTestFilesParams): Promise<void> {
  const { config, reporter } = params;
  const { setupFiles, testOptions } = config;

  const testModules = await collectTestModules(config);
  const testBlocks: TestBlock[] = [];

  for (const testModule of testModules) {
    getTestBlocks(testModule.blocks, testBlocks);
  }

  let errorCount = 0;

  reporter.onTestModulesCollected(testModules);

  for (const testModule of testModules) {
    reporter.onTestModuleStart(testModule);

    if (testModule.errorMessage !== null) {
      errorCount++;
    }

    errorCount += await runBlocks(testModule.blocks, {
      setupFiles,
      testFile: testModule.testFile,
      testOptions,
      reporter,
    });

    reporter.onTestModuleEnd(testModule);
  }

  if (testBlocks.length === 0 && errorCount === 0) {
    reporter.onError('No tests found');
    errorCount++;
  }

  process.exit(errorCount === 0 ? 0 : 1);
}

/**
 * Collects describe blocks and tests of each test file in a new worker, and prunes tests whose names don't match test
 * name patterns.
 */
async function collectTestModules(config: Config): Promise<TestModule[]> {
  const { setupFiles, testFiles, testNamePatterns, testOptions } = config;

  const testModules: TestModule[] = [];

  for (const testFile of testFiles) {
    const testModule: TestModule = {
      testFile,
      blocks: [],
      errorMessage: null,
    };

    await runJobInWorker({ type: 'collect_blocks', setupFiles, testFile, testOptions }, event => {
      switch (event.type) {
        case 'blocks_collected':
          testModule.blocks = event.blocks;
          break;

        case 'job_failed':
          testModule.errorMessage = event.errorMessage;
          break;
      }
    });

    pruneBlocks(testModule.blocks, testNamePatterns, '.');

    testModules.push(testModule);
  }

  return testModules;
}

interface RunBlocksParams {
  setupFiles: string[];
  testFile: string;
  testOptions: TestOptions;
  reporter: Reporter;
}

/**
 * Runs each test in a new worker, and reports describe blocks and tests.
 *
 * Returns the number of errors thrown by tests and describe blocks.
 */
async function runBlocks(blocks: readonly Block[], params: RunBlocksParams): Promise<number> {
  const { setupFiles, testFile, testOptions, reporter } = params;

  let errorCount = 0;

  for (const block of blocks) {
    if (block.kind === 'describe') {
      reporter.onDescribeStart(block);

      if (block.errorMessage !== null) {
        errorCount++;
      }

      errorCount += await runBlocks(block.children, params);

      reporter.onDescribeEnd(block);
      continue;
    }

    reporter.onTestStart(block);

    const errorMessages: string[] = [];

    let durationSummary = emptyHistogramSummary;
    let memorySummary = emptyHistogramSummary;

    await runJobInWorker({ type: 'run_test', setupFiles, testFile, testOptions, testPath: block.path }, event => {
      switch (event.type) {
        case 'warmup_started':
          reporter.onWarmupStart({
            block,
            measureIndex: event.measureIndex,
            measureCount: event.measureCount,
          });
          break;

        case 'progress_updated':
          reporter.onProgress({
            block,
            measureIndex: event.measureIndex,
            measureCount: event.measureCount,
            percentage: event.percentage,
          });
          break;

        case 'error_caught':
        case 'job_failed':
          errorMessages.push(event.errorMessage);
          break;

        case 'test_ended':
          durationSummary = event.durationSummary;
          memorySummary = event.memorySummary;
          break;
      }
    });

    errorCount += errorMessages.length;

    reporter.onTestEnd({
      block,
      durationSummary,
      memorySummary,
      errorMessages,
    });
  }

  return errorCount;
}

/**
 * Runs a job in a new worker, and resolves after the worker has exited.
 *
 * If the worker fails to start or exits before the job ends, the job ends with a `job_failed` event.
 */
function runJobInWorker(job: WorkerJob, handleEvent: (event: WorkerEvent) => void): Promise<void> {
  return new Promise(resolve => {
    const worker = fork(WORKER_FILE, { execArgv: WORKER_EXEC_ARGV, serialization: 'advanced' });

    worker.send(job);

    let isJobEnded = false;

    function handleJobEvent(event: WorkerEvent): void {
      if (isJobEnded) {
        return;
      }

      if (event.type === 'blocks_collected' || event.type === 'test_ended' || event.type === 'job_failed') {
        isJobEnded = true;
      }

      handleEvent(event);
    }

    worker.on('message', handleJobEvent);

    worker.on('error', error => {
      handleJobEvent({
        type: 'job_failed',
        errorMessage: getErrorMessage(error),
      });

      resolve();
    });

    worker.on('close', exitCode => {
      handleJobEvent({
        type: 'job_failed',
        errorMessage: 'Test worker exited unexpectedly: ' + exitCode,
      });

      resolve();
    });
  });
}
