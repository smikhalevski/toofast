import { fork } from 'child_process';
import path from 'path';
import { emptyHistogramSummary } from '../Histogram.ts';
import type { TestOptions } from '../index.ts';
import type { Block, WorkerEvent, WorkerJob } from '../runner.ts';
import { getErrorMessage } from '../utils.ts';
import type { Reporter } from './createReporter.ts';
import type { Config } from './resolveConfig.ts';

// Sources have the .ts extension, and the build has the .js extension
const WORKER_FILE = path.join(import.meta.dirname, 'worker' + path.extname(import.meta.filename));

const WORKER_EXEC_ARGV = getWorkerExecArgv();

/**
 * Returns Node.js options for worker processes.
 */
function getWorkerExecArgv(): string[] {
  // The inspector port is already in use by the main process
  const execArgv = process.execArgv.filter(arg => !arg.startsWith('--inspect'));

  // Versions before 22.18 strip types only if the option is enabled
  if (!process.features.typescript) {
    execArgv.push('--experimental-strip-types', '--no-warnings=ExperimentalWarning');
  }
  return execArgv;
}

export interface RunTestFilesParams {
  config: Config;
  reporter: Reporter;
}

/**
 * Runs tests in worker processes and exits. For each test file, a worker collects describe blocks and tests, and then
 * each test runs in a new worker.
 *
 * If a test file can't be imported, or a worker exits before it finishes, the error is reported and other tests still
 * run. Exits with code 1 if there were errors or no tests.
 */
export async function runTestFiles(params: RunTestFilesParams): Promise<void> {
  const { config, reporter } = params;
  const { setupFiles, testFiles, testNamePatterns, testOptions } = config;

  let testCount = 0;
  let errorCount = 0;

  for (const testFile of testFiles) {
    let blocks: Block[] = [];

    try {
      await runJobInWorker({ type: 'collect_blocks', setupFiles, testFile, testOptions }, event => {
        if (event.type === 'blocks_collected') {
          blocks = event.blocks;
        }
      });
    } catch (error) {
      reporter.printError(getErrorMessage(error));
      errorCount++;
      continue;
    }

    pruneBlocks(blocks, testNamePatterns);

    testCount += getTestCount(blocks);
    errorCount += await runBlocks({ blocks, setupFiles, testFile, testOptions, reporter });
  }

  if (testCount === 0 && errorCount === 0) {
    // For example, test file patterns or test name patterns have a typo
    reporter.printError('No tests found');
    errorCount++;
  }

  process.exit(errorCount === 0 ? 0 : 1);
}

interface RunBlocksParams {
  blocks: Block[];
  setupFiles: string[];
  testFile: string;
  testOptions: TestOptions;
  reporter: Reporter;
}

/**
 * Prints describe blocks and runs each test in a new worker. Returns the number of errors thrown by tests and describe
 * blocks.
 */
async function runBlocks(params: RunBlocksParams): Promise<number> {
  const { blocks, setupFiles, testFile, testOptions, reporter } = params;

  // Results of sibling tests are aligned
  const nameLength = getMaxTestNameLength(blocks);

  let errorCount = 0;

  for (const block of blocks) {
    if (block.kind === 'describe') {
      reporter.printDescribeStart(block.name);

      if (block.errorMessage !== null) {
        reporter.printError(block.errorMessage);
        errorCount++;
      }

      errorCount += await runBlocks({ ...params, blocks: block.children });

      reporter.printDescribeEnd();
      continue;
    }

    reporter.printTestStart(block.name.padEnd(nameLength));

    try {
      await runJobInWorker({ type: 'run_test', setupFiles, testFile, testOptions, testPath: block.path }, event => {
        if (event.type === 'error_caught') {
          errorCount++;
        }
        reporter.printTestEvent(event);
      });
    } catch (error) {
      // The worker didn't end the test, so the test ends here without results
      reporter.printTestEvent({
        type: 'error_caught',
        errorMessage: getErrorMessage(error),
      });

      reporter.printTestEvent({
        type: 'test_ended',
        durationSummary: emptyHistogramSummary,
        memorySummary: emptyHistogramSummary,
      });

      errorCount++;
    }
  }

  return errorCount;
}

/**
 * Runs a job in a new worker. Rejects if the job fails, or if the worker exits before the job ends.
 */
function runJobInWorker(job: WorkerJob, handleEvent: (event: WorkerEvent) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // Test options can be Infinity, which JSON serialization would turn into null
    const worker = fork(WORKER_FILE, { execArgv: WORKER_EXEC_ARGV, serialization: 'advanced' });

    // The job is sent over IPC, since the command line length is limited
    worker.send(job);

    let isJobEnded = false;

    worker.on('message', (event: WorkerEvent) => {
      if (event.type === 'job_failed') {
        reject(new Error(event.errorMessage));
        return;
      }

      // The last message of a job that succeeded
      if (event.type === 'blocks_collected' || event.type === 'test_ended') {
        isJobEnded = true;
      }

      handleEvent(event);
    });

    worker.on('error', reject);

    worker.on('close', exitCode => {
      if (isJobEnded) {
        resolve();
      } else {
        reject(new Error('Test process exited unexpectedly: ' + exitCode));
      }
    });
  });
}

/**
 * Removes tests whose names don't match any of the patterns, and describe blocks that have no tests left. Describe
 * blocks that have thrown an error are kept, so the error is reported.
 *
 * @param blocks Blocks that are pruned in place.
 * @param testNamePatterns Patterns of test names prefixed with names of enclosing describe blocks. If empty, all tests
 * are kept.
 * @param parentName The name of the parent describe block followed by a dot.
 */
function pruneBlocks(blocks: Block[], testNamePatterns: RegExp[], parentName = ''): void {
  for (let i = blocks.length - 1; i >= 0; --i) {
    const block = blocks[i];
    const name = parentName + block.name;

    if (block.kind === 'describe') {
      pruneBlocks(block.children, testNamePatterns, name + '.');
    }

    if (shouldPruneBlock(block, name, testNamePatterns)) {
      blocks.splice(i, 1);
    }
  }
}

function shouldPruneBlock(block: Block, name: string, testNamePatterns: RegExp[]): boolean {
  if (block.kind === 'describe') {
    return block.children.length === 0 && block.errorMessage === null;
  }

  return testNamePatterns.length !== 0 && !testNamePatterns.some(pattern => pattern.test(name));
}

function getTestCount(blocks: Block[]): number {
  let testCount = 0;

  for (const block of blocks) {
    testCount += block.kind === 'test' ? 1 : getTestCount(block.children);
  }

  return testCount;
}

function getMaxTestNameLength(blocks: Block[]): number {
  let maxLength = 0;

  for (const block of blocks) {
    if (block.kind === 'test') {
      maxLength = Math.max(maxLength, block.name.length);
    }
  }

  return maxLength;
}
