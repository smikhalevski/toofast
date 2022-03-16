import {createTestSuiteLifecycle} from '../createTestSuiteLifecycle';
import {MasterLifecycleHandlers, WorkerMessage, MessageType, TestLifecycleInitMessage} from './bin-types';
import path from 'path';
import fs from 'fs';
import cluster from 'cluster';
import vm from 'vm';
import {getTestPath, handleWorkerMessage} from './utils';
import {TestNode} from '../node-types';
import {createRequire} from 'module';

export function runMaster(handlers: MasterLifecycleHandlers): void {

  let testNode: TestNode;

  const handleMessage = (message: WorkerMessage) => handleWorkerMessage(message, {
    onTestStartMessage() {
      handlers.onTestStart(testNode);
    },
    onTestEndMessage(message) {
      handlers.onTestEnd(testNode, message.stats);
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

  const filePath = path.resolve(process.cwd(), process.argv[2]);

  const jsCode = fs.readFileSync(filePath, 'utf-8');

  const lifecycle = createTestSuiteLifecycle((node) => new Promise((resolve) => {
    testNode = node;

    const worker = cluster.fork();

    worker.on('message', handleMessage);
    worker.on('exit', resolve);
    worker.on('error', (error) => {
      handlers.onTestFatalError(testNode, error);
      resolve();
    });

    const message: TestLifecycleInitMessage = {
      type: MessageType.TEST_LIFECYCLE_INIT,
      filePath,
      testPath: getTestPath(node),
    };

    worker.send(message);

  }), handlers);

  const vmContext = vm.createContext(Object.assign({
    require: createRequire(filePath),
    __dirname: path.dirname(filePath),
    __filename: filePath,
  }, lifecycle.runtime));

  vm.runInContext(jsCode, vmContext, {
    filename: filePath,
  });

  lifecycle.run()
      .catch((error) => handlers.onTestSuiteError(lifecycle.node, error))
      .then(() => {
        process.exit(0);
      });
}
