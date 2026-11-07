import { pathToFileURL } from 'url';
import v8 from 'v8';
import {
  collectBlocks,
  createTestSuiteNode,
  runTest,
  setCurrentNode,
  type WorkerEvent,
  type WorkerJob,
} from '../runner.ts';
import { getErrorStackOrMessage } from '../utils.ts';

let isJobEnded = false;

process.once('message', (job: WorkerJob) => {
  runJob(job).then(endJob, handleJobError);
});

process.on('uncaughtException', handleJobError);

/**
 * Runs a job and returns the event that ends it.
 */
async function runJob(job: WorkerJob): Promise<WorkerEvent> {
  const testSuiteNode = createTestSuiteNode(job.testOptions);

  setCurrentNode(testSuiteNode);

  for (const file of job.setupFiles.concat(job.testFile)) {
    await import(pathToFileURL(file).href);
  }

  if (job.type === 'collect_blocks') {
    return {
      type: 'blocks_collected',
      blocks: await collectBlocks(testSuiteNode),
    };
  }

  const { durationSummary, memorySummary, durationPercentiles } = await runTest({
    rootNode: testSuiteNode,
    testPath: job.testPath,
    percentiles: job.percentiles,
    getMemoryUsed,
    sendMessage,
  });

  return {
    type: 'test_ended',
    durationSummary,
    memorySummary,
    durationPercentiles,
  };
}

function handleJobError(error: unknown): void {
  endJob({
    type: 'job_failed',
    errorMessage: getErrorStackOrMessage(error),
  });
}

/**
 * Sends the last event of the job and exits. Errors after that are ignored, since the job is already over.
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
  return v8.getHeapStatistics().used_heap_size;
}

function sendMessage(message: WorkerEvent): void {
  process.send!(message);
}
