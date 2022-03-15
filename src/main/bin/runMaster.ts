import {createTestSuiteLifecycle, TestSuiteLifecycleHandlers} from '../createTestSuiteLifecycle';
import {MasterMessage, MessageType, Stats, TestLifecycleInitMessage} from './bin-types';
import path from 'path';
import fs from 'fs';
import cluster from 'cluster';
import vm from 'vm';
import {extractTestPath, handleMasterMessage} from './utils';
import {TestNode, TestSuiteNode} from '../node-types';

export interface MasterLifecycleHandlers extends TestSuiteLifecycleHandlers {

  onTestStart(node: TestNode): void;

  onTestEnd(node: TestNode, stats: Stats): void;

  onTestError(node: TestNode, error: any): void;

  onTestSuiteError(node: TestSuiteNode, error: any): void;

  onMeasureWarmupStart(node: TestNode): void;

  onMeasureWarmupEnd(node: TestNode): void;

  onMeasureStart(node: TestNode): void;

  onMeasureEnd(node: TestNode, stats: Stats): void;

  onMeasureError(node: TestNode, error: any): void;

  onMeasureProgress(node: TestNode, percent: number): void;
}

export function runMaster(handlers: MasterLifecycleHandlers): void {

  let testNode: TestNode;

  const handleWorkerMessage = (message: MasterMessage) => handleMasterMessage(message, {
    onTestStartMessage() {
      handlers.onTestStart(testNode);
    },
    onTestEndMessage(message) {
      handlers.onTestEnd(testNode, message.stats);
    },
    onTestErrorMessage(message) {
      handlers.onTestError(testNode, message.message);
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

    worker.on('message', handleWorkerMessage);
    worker.on('exit', resolve);
    worker.on('error', (error) => {
      handlers.onTestError(testNode, error);
      resolve();
    });

    const message: TestLifecycleInitMessage = {
      type: MessageType.TEST_LIFECYCLE_INIT,
      filePath,
      testPath: extractTestPath(node),
    };

    worker.send(message);

  }), handlers);

  const vmContext = vm.createContext(lifecycle.runtime);

  vm.runInContext(jsCode, vmContext);

  lifecycle.run()
      .catch((error) => handlers.onTestSuiteError(lifecycle.node, error))
      .then(() => {
        process.exit(0);
      });
}
