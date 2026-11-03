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

// The main process sends the job as the first message
process.once('message', async (job: WorkerJob) => {
  // The test file may leave handles that keep the process alive, so it exits as soon as the last message is sent
  process.send!(await runJob(job), () => process.exit());
});

/**
 * Runs a job and returns the last message that must be sent to the main process.
 */
async function runJob(job: WorkerJob): Promise<WorkerEvent> {
  const testSuite = createTestSuite(job.testOptions);

  setCurrentNode(testSuite);

  try {
    for (const file of job.setupFiles.concat(job.testFile)) {
      // A path isn't a valid module specifier if it contains "#", "?" or a Windows drive letter
      await import(pathToFileURL(file).href);
    }
  } catch (error) {
    return {
      type: 'file_failed',
      errorMessage: getErrorStackOrMessage(error),
    };
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

function getMemoryUsed(): number {
  // Same as process.memoryUsage().heapUsed, but much cheaper since it doesn't read RSS from the OS
  return v8.getHeapStatistics().used_heap_size;
}

function sendMessage(message: WorkerEvent): void {
  process.send!(message);
}
