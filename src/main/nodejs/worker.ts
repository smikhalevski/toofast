import { pathToFileURL } from 'url';
import v8 from 'v8';
import {
  collectBlocks,
  createTestSuite,
  runTest,
  setCurrentNode,
  type WorkerEvent,
  type WorkerJob,
} from '../runner.ts';
import { getErrorStackOrMessage } from '../utils.ts';

let isJobEnded = false;

// The main process sends the job as the first message
process.once('message', (job: WorkerJob) => {
  runJob(job).then(endJob, handleJobError);
});

// An error that escapes the job, for example, a rejection of a promise that nobody awaits, fails the job
process.on('uncaughtException', handleJobError);

/**
 * Runs a job and returns the message that ends it.
 */
async function runJob(job: WorkerJob): Promise<WorkerEvent> {
  const testSuite = createTestSuite(job.testOptions);

  setCurrentNode(testSuite);

  for (const file of job.setupFiles.concat(job.testFile)) {
    // A path isn't a valid module specifier if it contains "#", "?" or a Windows drive letter
    await import(pathToFileURL(file).href);
  }

  if (job.type === 'collect_blocks') {
    return {
      type: 'blocks_collected',
      blocks: await collectBlocks(testSuite),
    };
  }

  const { durationHistogram, memoryHistogram } = await runTest({
    testSuite,
    testPath: job.testPath,
    getMemoryUsed,
    sendMessage,
  });

  return {
    type: 'test_ended',
    durationSnapshot: durationHistogram.getSnapshot(),
    memorySnapshot: memoryHistogram.getSnapshot(),
  };
}

function handleJobError(error: unknown): void {
  endJob({
    type: 'job_failed',
    errorMessage: getErrorStackOrMessage(error),
  });
}

/**
 * Sends the last message of the job and exits. Errors after that are ignored, since the job is already over.
 */
function endJob(event: WorkerEvent): void {
  if (isJobEnded) {
    return;
  }

  isJobEnded = true;

  // The test file may leave handles that would keep the process alive
  process.send!(event, () => process.exit());
}

function getMemoryUsed(): number {
  // Same as process.memoryUsage().heapUsed, but much cheaper, since it doesn't read the resident set size from the OS
  return v8.getHeapStatistics().used_heap_size;
}

function sendMessage(message: WorkerEvent): void {
  process.send!(message);
}
