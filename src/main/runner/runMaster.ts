import { createTestSuiteLifecycle, TestNode } from '../createTestSuiteLifecycle.js';
import { MasterLifecycleHandlers, MasterMessage, ReadyMessage } from './types.js';
import { getTestLocation, handleWorkerMessage } from './utils.js';
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
  setupFiles: string[] | undefined;
  includeFiles: string[];
  testNamePatterns: RegExp[] | undefined;
  testOptions: TestOptions | undefined;
  handlers: MasterLifecycleHandlers;
  importFile: (file: string) => Promise<void> | void;
  injectRuntime: (file: string, runtime: Runtime) => Promise<void> | void;
  startWorker: (options: WorkerOptions) => Worker;
  tearDown: () => void;
}

export async function runMaster(options: RunMasterOptions): Promise<void> {
  const {
    setupFiles = [],
    includeFiles,
    testNamePatterns,
    testOptions,
    handlers,
    importFile,
    injectRuntime,
    startWorker,
    tearDown,
  } = options;

  for (const file of includeFiles) {
    const runTestLifecycle = (node: TestNode): Promise<void> => {
      return new Promise(resolve => {
        const worker = startWorker({
          onMessage(message) {
            handleWorkerMessage(message, {
              onReady(_message: ReadyMessage) {
                worker.postMessage({
                  type: 'testLifecycleInit',
                  file,
                  testLocation: getTestLocation(node),
                  setupFiles,
                  testOptions,
                });
              },
              onTestStartMessage() {
                handlers.onTestStart(node);
              },
              onTestEndMessage(message) {
                handlers.onTestEnd(node, message.durationStats, message.memoryStats);
              },
              onTestFatalErrorMessage(message) {
                handlers.onTestFatalError(node, message.message);
              },
              onMeasureWarmupStartMessage() {
                handlers.onMeasureWarmupStart(node);
              },
              onMeasureWarmupEndMessage() {
                handlers.onMeasureWarmupEnd(node);
              },
              onMeasureStartMessage() {
                handlers.onMeasureStart(node);
              },
              onMeasureEndMessage(message) {
                handlers.onMeasureEnd(node, message.stats);
              },
              onMeasureErrorMessage(message) {
                handlers.onMeasureError(node, message.errorMessage);
              },
              onMeasureProgressMessage(message) {
                handlers.onMeasureProgress(node, message.percent);
              },
            });
          },
          onError(error) {
            handlers.onTestFatalError(node, error);
          },
          onExit: resolve,
        });
      });
    };

    const lifecycle = createTestSuiteLifecycle({ runTestLifecycle, handlers, testNamePatterns });

    try {
      await injectRuntime(file, lifecycle.runtime);

      for (const file of setupFiles) {
        await importFile(file);
      }

      await importFile(file);

      await lifecycle.run();
    } catch (error) {
      handlers.onTestSuiteError(lifecycle.node, error);
    }
  }

  tearDown();
}
