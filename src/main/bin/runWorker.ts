import fs from 'fs';
import {createRequire} from 'module';
import path from 'path';
import vm from 'vm';
import {createTestLifecycle, TestLifecycleHandlers} from '../createTestLifecycle';
import {runMeasureLifecycle} from '../runMeasureLifecycle';
import {MasterMessage, MessageType, WorkerMessage} from './bin-types';
import {getErrorMessage, handleMasterMessage, toStats} from './utils';

/**
 * Runs worker that waits for test init message and sends lifecycle messages to parent process.
 */
export function runWorker(): void {

  const send: (message: WorkerMessage) => void = (message) => process.send!(message);

  let prevPercent: number;
  let prevErrorMessage: string;

  const handlers: TestLifecycleHandlers = {
    onTestStart() {
      send({
        type: MessageType.TEST_START,
      });
    },
    onTestEnd(durationHistogram, memoryHistogram) {
      send({
        type: MessageType.TEST_END,
        durationStats: toStats(durationHistogram),
        memoryStats: toStats(memoryHistogram),
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
        stats: toStats(histogram),
      });
    },
    onMeasureError(error) {
      const errorMessage = getErrorMessage(error);
      if (prevErrorMessage !== errorMessage) {
        send({
          type: MessageType.MEASURE_ERROR,
          message: prevErrorMessage = errorMessage,
        });
      }
    },
    onMeasureProgress(percent) {
      const nextPercent = Math.round(percent * 100) / 100;
      if (prevPercent !== nextPercent) {
        send({
          type: MessageType.MEASURE_PROGRESS,
          percent: prevPercent = nextPercent,
        });
      }
    },
  };

  process.on('message', (message: MasterMessage) => handleMasterMessage(message, {

    onTestLifecycleInitMessage(message) {
      const {filePath} = message;

      const jsCode = fs.readFileSync(filePath, 'utf-8');

      const lifecycle = createTestLifecycle(message.testPath, runMeasureLifecycle, handlers);

      const vmContext = vm.createContext(Object.assign({
        require: createRequire(filePath),
        __dirname: path.dirname(filePath),
        __filename: filePath,
      }, lifecycle.runtime));

      vm.runInContext(jsCode, vmContext, {
        filename: filePath,
      });

      lifecycle.run()
          .catch((error) => {
            send({
              type: MessageType.TEST_FATAL_ERROR,
              message: getErrorMessage(error),
            });
          })
          .then(() => {
            process.exit(0);
          });
    }
  }));
}
