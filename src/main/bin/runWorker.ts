import fs from 'fs';
import vm from 'vm';
import {createTestLifecycle, TestLifecycleHandlers} from '../createTestLifecycle';
import {extractErrorMessage, extractStats, handleWorkerMessage} from './utils';
import {measureLifecycle} from '../measureLifecycle';
import {sleep} from '../utils';
import {MasterMessage, MessageType, WorkerMessage} from './bin-types';

/**
 * Runs worker that waits for test init message and sends lifecycle messages to parent process.
 */
export function runWorker(): void {

  const send: (message: MasterMessage) => void = process.send!;

  let prevPercent = -1;

  const handlers: TestLifecycleHandlers = {
    onTestStart() {
      send({
        type: MessageType.TEST_START,
      });
    },
    onTestEnd(histogram) {
      send({
        type: MessageType.TEST_END,
        stats: extractStats(histogram),
      });
    },
    onMeasureWarmupStart() {
      send({
        type: MessageType.MEASURE_WARMUP_START,
      });
    },
    onMeasureWarmupEnd() {
      send({
        type: MessageType.MEASURE_WARMUP_END,
      });
    },
    onMeasureStart() {
      send({
        type: MessageType.MEASURE_START,
      });
    },
    onMeasureEnd(histogram) {
      send({
        type: MessageType.MEASURE_END,
        stats: extractStats(histogram),
      });
    },
    onMeasureError(error) {
      send({
        type: MessageType.MEASURE_ERROR,
        message: extractErrorMessage(error),
      });
    },
    onMeasureProgress(percent) {
      const nextPercent = Math.round(percent * 100) / 100;

      if (prevPercent === nextPercent) {
        return;
      }
      prevPercent = nextPercent;

      send({
        type: MessageType.MEASURE_PROGRESS,
        percent: nextPercent,
      });
    },
  };

  process.on('message', (message: WorkerMessage) => handleWorkerMessage(message, {

    onTestLifecycleInitMessage(message) {

      const jsCode = fs.readFileSync(message.filePath, 'utf-8');

      const lifecycle = createTestLifecycle(message.testPath, measureLifecycle, handlers);

      const vmContext = vm.createContext(lifecycle.runtime);

      vm.runInContext(jsCode, vmContext);

      lifecycle.run()
          .catch((error) => {
            send({
              type: MessageType.TEST_ERROR,
              message: extractErrorMessage(error),
            });
          })
          // Ensure the message is sent
          .then(() => sleep(100))
          .then(() => {
            process.exit(0);
          });
    }
  }));
}
