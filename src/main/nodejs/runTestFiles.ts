import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import type { TestOptions } from '../index.ts';
import type { Block, WorkerEvent, WorkerJob } from '../runner.ts';
import { getErrorMessage } from '../utils.ts';
import type { Reporter } from './createReporter.ts';
import type { Config } from './resolveConfig.ts';

const WORKER_FILE = fileURLToPath(new URL('./worker.ts', import.meta.url));

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
 * Runs tests in worker processes and exits. A worker first collects blocks of a test file, then each test runs in a new
 * worker.
 *
 * Exits with code 1 if a test or a describe block throws. A test file that can't be imported, or a worker that exits
 * unexpectedly, stops the run.
 */
export async function runTestFiles(params: RunTestFilesParams): Promise<void> {
  const { config, reporter } = params;
  const { setupFiles, testFiles, testNamePatterns, testOptions } = config;

  let errorCount = 0;

  try {
    for (const testFile of testFiles) {
      let blocks: Block[] = [];

      await runJobInWorker({ type: 'collect_blocks', setupFiles, testFile, testOptions }, event => {
        if (event.type === 'blocks_collected') {
          blocks = event.blocks;
        }
      });

      pruneBlocks(blocks, testNamePatterns);

      errorCount += await runBlocks({ blocks, setupFiles, testFile, testOptions, reporter });
    }
  } catch (error) {
    reporter.printError(getErrorMessage(error));
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

  // Results of sibling tests are padded
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

    await runJobInWorker({ type: 'run_test', setupFiles, testFile, testOptions, testPath: block.path }, event => {
      if (event.type === 'error_caught') {
        errorCount++;
      }
      reporter.printTestEvent(event);
    });
  }
  return errorCount;
}

/**
 * Runs a job in a new worker. Rejects if the worker can't import a file, or exits before it finishes the job.
 */
function runJobInWorker(job: WorkerJob, handleEvent: (event: WorkerEvent) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // Test options can be Infinity, which JSON serialization would turn into null
    const worker = fork(WORKER_FILE, { execArgv: WORKER_EXEC_ARGV, serialization: 'advanced' });

    // The job is sent over IPC, since the command line length is limited
    worker.send(job);

    let isJobFinished = false;

    worker.on('message', (event: WorkerEvent) => {
      if (event.type === 'file_failed') {
        reject(new Error(event.errorMessage));
        return;
      }

      // The last event of a job
      if (event.type === 'blocks_collected' || event.type === 'test_ended') {
        isJobFinished = true;
      }

      handleEvent(event);
    });

    worker.on('error', reject);

    worker.on('close', exitCode => {
      if (isJobFinished) {
        resolve();
      } else {
        reject(new Error('Test process exited unexpectedly: ' + exitCode));
      }
    });
  });
}

/**
 * Removes tests which names don't match any of patterns, and describe blocks that have no tests left. Describe blocks
 * that have thrown an error are kept, so the error is reported.
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

function getMaxTestNameLength(blocks: Block[]): number {
  let maxLength = 0;

  for (const block of blocks) {
    if (block.kind === 'test') {
      maxLength = Math.max(maxLength, block.name.length);
    }
  }
  return maxLength;
}
