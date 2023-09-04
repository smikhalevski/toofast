import cluster from 'cluster';
import globToRegexp from 'glob-to-regexp';
import { globSync } from 'fast-glob';
import { createTestSuiteLifecycle, TestSuiteLifecycleOptions } from '../createTestSuiteLifecycle';
import { TestNode } from '../node-types';
import { MasterLifecycleHandlers, MessageType, TestLifecycleInitMessage, WorkerMessage } from './bin-types';
import { getTestPath, handleWorkerMessage } from './utils';
import { resolveConfig } from './resolveConfig';
import { parseArgs } from 'argcat';
import { cliParseArgsOptions, cliOptionsShape } from './shapes';

export function runMaster(handlers: MasterLifecycleHandlers): void {
  let testNode: TestNode;

  const handleMessage = (message: WorkerMessage) =>
    handleWorkerMessage(message, {
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

  const cliOptions = cliOptionsShape.parse(parseArgs(process.argv.slice(2), cliParseArgsOptions));

  const { cwd, config } = resolveConfig(process.cwd(), cliOptions['config']?.[0]);

  const setupFilePaths = config.setupFiles?.flatMap(filePattern => globSync(filePattern, { absolute: true, cwd }));

  const includeFilePatterns = cliOptions[''] || config.include || ['**/*.perf.js'];

  const includeFilePaths = includeFilePatterns?.flatMap(filePattern => globSync(filePattern, { absolute: true, cwd }));

  if (!includeFilePaths?.length) {
    // No files to run
    return;
  }

  const options: TestSuiteLifecycleOptions = {
    testNamePatterns: cliOptions['']?.map(pattern => globToRegexp(pattern, { flags: 'i' })),
  };

  let filePromise = Promise.resolve();

  for (const filePath of includeFilePaths) {
    filePromise = filePromise.then(() => {
      const lifecycle = createTestSuiteLifecycle(
        node =>
          new Promise(resolve => {
            testNode = node;

            const worker = cluster.fork();

            worker.on('message', handleMessage);
            worker.on('error', error => {
              handlers.onTestFatalError(testNode, error);
            });
            worker.on('exit', resolve);

            const message: TestLifecycleInitMessage = {
              type: MessageType.TEST_LIFECYCLE_INIT,
              filePath,
              testPath: getTestPath(node),
              setupFilePaths,
              testOptions: config.testOptions,
            };

            worker.send(message);
          }),
        handlers,
        options
      );

      // Register globals
      Object.assign(global, lifecycle.runtime);

      // Setup
      setupFilePaths?.forEach(require);

      // Run test suite
      require(filePath);

      return lifecycle.run().catch(error => handlers.onTestSuiteError(lifecycle.node, error));
    });
  }

  // Kill the process after completion
  filePromise.then(() => {
    process.exit(0);
  });
}
