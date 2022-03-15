import fs from 'fs';
import vm from 'vm';
import {createTestLifecycle, TestLifecycleHandlers} from '../createTestLifecycle';
import {Message, MessageType} from './bin-types';
import {createStats, extractMessage, handleMessage} from './utils';
import {measureLifecycle} from '../measureLifecycle';
import {sleep} from '../utils';
import {Histogram} from '../Histogram';

/**
 * Runs worker that waits for test init message and sends lifecycle messages to parent process.
 */
export function runWorker(): void {

  const send: (message: Message) => void = process.send!;

  let prevPercent = -1;

  const handlers: TestLifecycleHandlers<Histogram> = {
    onTestStart(label) {
      send({
        type: MessageType.TEST_START,
        label,
      });
    },
    onTestEnd(histogram) {
      send({
        type: MessageType.TEST_END,
        stats: createStats(histogram),
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
        stats: createStats(histogram),
      });
    },
    onMeasureError(error) {
      send({
        type: MessageType.MEASURE_ERROR,
        message: extractMessage(error),
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

  process.on('message', (message: Message) => handleMessage(message, {

    onTestLifecycleInitMessage(message) {

      const jsCode = fs.readFileSync(message.filePath, 'utf-8');

      const lifecycle = createTestLifecycle(message.testPath, measureLifecycle, handlers);

      const vmContext = vm.createContext(lifecycle.protocol);

      vm.runInContext(jsCode, vmContext);

      lifecycle.run()
          .catch((error) => {
            send({
              type: MessageType.TEST_ERROR,
              message: extractMessage(error),
            });
          })
          .then(() => sleep(100))
          .then(() => {
            process.exit(0);
          });
    }
  }));
}
