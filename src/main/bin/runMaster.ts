import { createTestSuiteLifecycle, TestNode } from '../createTestSuiteLifecycle.js';
import { MasterLifecycleHandlers, MasterMessage, WorkerMessage } from './types.js';
import { getTestPath, handleWorkerMessage } from './utils.js';
import { Runtime, TestOptions } from '../types.js';

export interface WorkerOptions {
  onMessage(message: any): void;
  onError(error: any): void;
  onExit(): void;
}

export interface Worker {
  postMessage(message: MasterMessage): void;
}

export interface RunMasterOptions {
  setupFilePaths: string[] | undefined;
  includeFilePaths: string[];
  testNamePatterns: RegExp[] | undefined;
  testOptions: TestOptions | undefined;
  handlers: MasterLifecycleHandlers;
  loadFile: (filePath: string) => Promise<void> | void;
  loadRuntime: (runtime: Runtime) => Promise<void> | void;
  startWorker: (options: WorkerOptions) => Worker;
  tearDown: () => void;
}

export function runMaster(options: RunMasterOptions): void {
  const {
    setupFilePaths,
    includeFilePaths,
    testNamePatterns,
    testOptions,
    handlers,
    loadFile,
    loadRuntime,
    startWorker,
    tearDown,
  } = options;

  let testNode: TestNode;

  const handleMessage = (message: WorkerMessage) => {
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
        handlers.onMeasureError(testNode, message.errorMessage);
      },
      onMeasureProgressMessage(message) {
        handlers.onMeasureProgress(testNode, message.percent);
      },
    });
  };

  let testSuitePromise = Promise.resolve();

  includeFilePaths.forEach(filePath => {
    testSuitePromise = testSuitePromise.then(() => {
      const runTestLifecycle = (node: TestNode) =>
        new Promise<void>(resolve => {
          testNode = node;

          const worker = startWorker({
            onMessage: handleMessage,
            onError(error) {
              handlers.onTestFatalError(testNode, error);
            },
            onExit: resolve,
          });

          worker.postMessage({
            type: 'testLifecycleInit',
            filePath,
            testPath: getTestPath(node),
            setupFilePaths,
            testOptions,
          });
        });

      const lifecycle = createTestSuiteLifecycle(runTestLifecycle, handlers, { testNamePatterns });

      // Load runtime
      let lifecyclePromise = new Promise(resolve => resolve(loadRuntime(lifecycle.runtime)));

      // Load setup files
      setupFilePaths?.forEach(filePath => {
        lifecyclePromise = lifecyclePromise.then(() => loadFile(filePath));
      });

      // Load and run the test suite
      return lifecyclePromise
        .then(() => loadFile(filePath))
        .then(() => lifecycle.run())
        .catch(error => handlers.onTestSuiteError(lifecycle.node, error));
    });
  });

  testSuitePromise.then(tearDown);
}
