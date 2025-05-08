import { createTestLifecycle, TestLifecycleHandlers } from '../createTestLifecycle.js';
import { runMeasureLifecycle } from '../runMeasureLifecycle.js';
import { MasterMessage, WorkerMessage } from './types.js';
import { getErrorMessage, handleMasterMessage } from './utils.js';
import { Runtime } from '../types.js';

export interface RunWorkerOptions {
  postMessage: (message: WorkerMessage) => void;
  subscribeToMessage: (listener: (message: MasterMessage) => void) => void;
  loadFile: (filePath: string) => Promise<void> | void;
  loadRuntime: (runtime: Runtime) => Promise<void> | void;
  tearDown: () => void;
}

/**
 * Runs worker that waits for the test init message and sends lifecycle messages.
 */
export function runWorker(options: RunWorkerOptions): void {
  const { postMessage, subscribeToMessage, loadFile, loadRuntime, tearDown } = options;

  let prevPercent: number;
  let prevErrorMessage: string;

  const handlers: TestLifecycleHandlers = {
    onTestStart() {
      postMessage({
        type: 'testStart',
      });
    },
    onTestEnd(durationHistogram, memoryHistogram) {
      postMessage({
        type: 'testEnd',
        durationStats: durationHistogram.getStats(),
        memoryStats: memoryHistogram.getStats(),
      });
    },
    onMeasureWarmupStart() {
      postMessage({
        type: 'measureWarmupStart',
      });
    },
    onMeasureWarmupEnd() {
      postMessage({
        type: 'measureWarmupEnd',
      });
    },
    onMeasureStart() {
      postMessage({
        type: 'measureStart',
      });
    },
    onMeasureEnd(histogram) {
      postMessage({
        type: 'measureEnd',
        stats: histogram.getStats(),
      });
    },
    onMeasureError(error) {
      const errorMessage = getErrorMessage(error);

      if (prevErrorMessage === errorMessage) {
        return;
      }
      postMessage({
        type: 'measureError',
        errorMessage: (prevErrorMessage = errorMessage),
      });
    },
    onMeasureProgress(percent) {
      const nextPercent = Math.round(percent * 1000) / 1000;

      if (prevPercent === nextPercent) {
        return;
      }
      postMessage({
        type: 'measureProgress',
        percent: (prevPercent = nextPercent),
      });
    },
  };

  subscribeToMessage(message =>
    handleMasterMessage(message, {
      onTestLifecycleInitMessage(message) {
        const lifecycle = createTestLifecycle(message.testPath, runMeasureLifecycle, handlers, message.testOptions);

        // Load runtime
        let lifecyclePromise = new Promise(resolve => resolve(loadRuntime(lifecycle.runtime)));

        // Load setup files
        message.setupFilePaths?.forEach(filePath => {
          lifecyclePromise = lifecyclePromise.then(() => loadFile(filePath));
        });

        // Load tests
        lifecyclePromise.then(() => loadFile(message.filePath));

        // Run tests
        lifecyclePromise
          .then(() => lifecycle.run())
          .catch(error => {
            postMessage({
              type: 'testFatalError',
              message: getErrorMessage(error),
            });
          })
          .then(tearDown);
      },
    })
  );
}
