import {createTestSuiteLifecycle, TestSuiteLifecycleHandlers} from '../createTestSuiteLifecycle';
import {Message, MessageType, Stats, TestLifecycleInitMessage} from './bin-types';
import {handleMessage} from './utils';
import path from 'path';
import fs from 'fs';
import cluster from 'cluster';
import vm from 'vm';
import {TestLifecycleHandlers} from '../createTestLifecycle';

export interface MasterLifecycleHandlers extends Required<TestSuiteLifecycleHandlers>, Required<TestLifecycleHandlers<Stats>> {

  onTestError(error: any): void;

  onTestSuiteError(error: any): void;
}

export function runMaster(handlers: MasterLifecycleHandlers): void {

  const {
    onTestStart,
    onTestEnd,
    onTestError,
    onTestSuiteError,
    onMeasureWarmupStart,
    onMeasureWarmupEnd,
    onMeasureStart,
    onMeasureEnd,
    onMeasureError,
    onMeasureProgress,
  } = handlers;

  const handleWorkerMessage = (message: Message) => handleMessage(message, {
    onTestStartMessage() {
      onTestStart();
    },
    onTestEndMessage(message) {
      onTestEnd(message.stats);
    },
    onTestErrorMessage(message) {
      onTestError(message.message);
    },
    onMeasureWarmupStartMessage() {
      onMeasureWarmupStart();
    },
    onMeasureWarmupEndMessage() {
      onMeasureWarmupEnd();
    },
    onMeasureStartMessage() {
      onMeasureStart();
    },
    onMeasureEndMessage(message) {
      onMeasureEnd(message.stats);
    },
    onMeasureErrorMessage(message) {
      onMeasureError(message.message);
    },
    onMeasureProgressMessage(message) {
      onMeasureProgress(message.percent);
    },
  });

  const filePath = path.resolve(process.cwd(), process.argv[2]);

  const jsCode = fs.readFileSync(filePath, 'utf-8');

  const lifecycle = createTestSuiteLifecycle((testPath) => new Promise((resolve) => {
    const worker = cluster.fork();

    worker.on('message', handleWorkerMessage);
    worker.on('exit', resolve);
    worker.on('error', (error) => {
      onTestError(error);
      resolve();
    });

    const message: TestLifecycleInitMessage = {
      type: MessageType.TEST_LIFECYCLE_INIT,
      filePath,
      testPath,
    };

    worker.send(message);

  }), handlers);

  const vmContext = vm.createContext(lifecycle.protocol);

  vm.runInContext(jsCode, vmContext);

  lifecycle.run().catch(onTestSuiteError).then(() => {
    process.exit(0);
  });
}
