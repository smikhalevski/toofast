import { createTestLifecycle, TestLifecycleHandlers } from '../createTestLifecycle.js';
import { runMeasureLifecycle } from '../runMeasureLifecycle.js';
import { MasterMessage, WorkerMessage } from './types.js';
import { getErrorMessage, handleMasterMessage } from './utils.js';
import { Runtime } from '../types.js';

export interface RunWorkerOptions {
  postMessage: (message: WorkerMessage) => void;
  addMessageListener: (listener: (message: MasterMessage) => void) => void;
  importFile: (file: string) => Promise<void> | void;
  injectRuntime: (file: string, runtime: Runtime) => Promise<void> | void;
  tearDown: () => void;
}

/**
 * Runs worker that waits for the test init message and sends lifecycle messages.
 */
export function runWorker(options: RunWorkerOptions): void {
  const { postMessage, addMessageListener, importFile, injectRuntime, tearDown } = options;

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

  addMessageListener(message => {
    handleMasterMessage(message, {
      async onTestLifecycleInitMessage(message) {
        try {
          const lifecycle = createTestLifecycle({
            runMeasureLifecycle,
            testLocation: message.testLocation,
            testOptions: message.testOptions,
            handlers,
          });

          await injectRuntime(message.file, lifecycle.runtime);

          for (const file of message.setupFiles) {
            await importFile(file);
          }

          await importFile(message.file);

          await lifecycle.run();
        } catch (error) {
          postMessage({
            type: 'testFatalError',
            message: getErrorMessage(error),
          });
        }

        tearDown();
      },
    });
  });

  postMessage({
    type: 'ready',
  });
}
