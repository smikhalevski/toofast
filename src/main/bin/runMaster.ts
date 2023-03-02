import cluster from 'cluster';
import { globSync } from 'glob';
import { createTestSuiteLifecycle, TestSuiteLifecycleOptions } from '../createTestSuiteLifecycle';
import { TestNode } from '../node-types';
import { MasterLifecycleHandlers, MessageType, TestLifecycleInitMessage, WorkerMessage } from './bin-types';
import { parseCliOptions } from './parseCliOptions';
import { getTestPath, handleWorkerMessage } from './utils';

export function runMaster(handlers: MasterLifecycleHandlers): void {

  let testNode: TestNode;

  const handleMessage = (message: WorkerMessage) => handleWorkerMessage(message, {
    onTestStartMessage() {
      handlers.onTestStart(testNode);
    },
    onTestEndMessage(message) {
      handlers.onTestEnd(testNode, message.durationStats, message.memoryStats);
    },
    onTestFatalErrorMessage(message) {
      handlers.onTestFatalError(testNode, message.message);
    },
    onMeasureWarmupStartMessage() {
      handlers.onMeasureWarmupStart(testNode);
    },
    onMeasureWarmupEndMessage() {
      handlers.onMeasureWarmupEnd(testNode);
    },
    onMeasureStartMessage() {
      handlers.onMeasureStart(testNode);
    },
    onMeasureEndMessage(message) {
      handlers.onMeasureEnd(testNode, message.stats);
    },
    onMeasureErrorMessage(message) {
      handlers.onMeasureError(testNode, message.message);
    },
    onMeasureProgressMessage(message) {
      handlers.onMeasureProgress(testNode, message.percent);
    },
  });

  const cliOptions = parseCliOptions(process.argv.slice(2), { t: 'testNamePattern' });

  const filePatterns = cliOptions[''] || ['**/*.perf.js'];

  const filePaths = filePatterns?.flatMap((filePattern) => globSync(filePattern, { absolute: true }));

  if (!filePaths?.length) {
    // No files to run
    return;
  }

  const options: TestSuiteLifecycleOptions = {
    testNamePatterns: cliOptions['testNamePattern']?.map((pattern) => RegExp(pattern, 'i')),
  };

  let filePromise = Promise.resolve();

  for (const filePath of filePaths) {

    filePromise = filePromise.then(() => {

      const lifecycle = createTestSuiteLifecycle((node) => new Promise((resolve) => {
        testNode = node;

        const worker = cluster.fork();

        worker.on('message', handleMessage);
        worker.on('error', (error) => {
          handlers.onTestFatalError(testNode, error);
        });
        worker.on('exit', resolve);

        const message: TestLifecycleInitMessage = {
          type: MessageType.TEST_LIFECYCLE_INIT,
          filePath,
          testPath: getTestPath(node),
        };

        worker.send(message);

      }), handlers, options);

      Object.assign(global, lifecycle.runtime);

      require(filePath);

      return lifecycle.run().catch((error) => handlers.onTestSuiteError(lifecycle.node, error));
    });
  }

  // Kill the process after completion
  filePromise.then(() => {
    process.exit(0);
  });
}
