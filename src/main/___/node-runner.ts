import cluster from 'cluster';
import {
  bootstrapRunner,
  createRunMeasure,
  RunnerMessage,
  runTest,
  setCurrentNode,
  TestSuiteNode,
} from './runner-api.js';
import { TestOptions } from './index.js';
import { getErrorMessage } from './utils.js';
import { createNodeLogger } from './createNodeLogger.js';
import { resolveConfig } from './resolveConfig.js';

export default async function start(): Promise<void> {
  if (cluster.isWorker) {
    startWorker();
    return;
  }

  const { setupFilePaths, testFilePaths, testRegExps, testOptions } = resolveConfig();

  const testPatterns = testRegExps.map(re => re.source);

  const logger = createNodeLogger();

  for (const testFilePath of testFilePaths) {
    let nodeLocation: number[] = [];

    const nextTest = (): Promise<void> => {
      return new Promise(resolve => {
        const worker = cluster.fork();

        worker.on('message', (message: WorkerMessage) => {
          if (message.type === 'workerReady') {
            worker.send({
              type: 'runTest',
              setupFilePaths: setupFilePaths,
              testFilePath,
              nodeLocation,
              testPatterns,
              testOptions,
            } satisfies MasterMessage);
            return;
          }

          logger(message);

          if (message.type === 'fatalError') {
            process.exit(1);
          }
          if (message.type === 'testStart') {
            nodeLocation = message.nodeLocation;
          }
          if (message.type === 'testEnd') {
            resolve(nextTest());
          }
          if (message.type === 'noTests') {
            resolve();
          }
        });

        worker.on('error', error => {
          logger({ type: 'fatalError', errorMessage: getErrorMessage(error) });

          process.exit(1);
        });
      });
    };

    await nextTest();
  }
}

function startWorker(): void {
  const messageListener = async (message: MasterMessage) => {
    if (message.type !== 'runTest') {
      return;
    }

    process.off('message', messageListener);

    const { setupFilePaths, testFilePath, nodeLocation, testPatterns } = message;

    const testRegExps = testPatterns.map(pattern => RegExp(pattern, 'i'));

    const testSuiteNode = new TestSuiteNode(message.testOptions);

    setCurrentNode(testSuiteNode);

    const isOK = await bootstrapRunner({
      setupFilePaths,
      testFilePath,
      evalFile,
      sendMessage,
    });

    if (!isOK) {
      process.exit(0);
    }

    const runMeasure = createRunMeasure({
      sendMessage,
      getMemoryUsed() {
        return typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;
      },
    });

    await runTest({
      startNode: testSuiteNode,
      nodeLocation,
      isSkipped(testNode) {
        return testRegExps.length !== 0 && !testRegExps.some(re => re.test(testNode.absoluteName));
      },
      setCurrentNode,
      runMeasure,
      sendMessage,
    });

    process.exit(0);
  };

  process.on('message', messageListener);

  setTimeout(() => sendMessage({ type: 'workerReady' }), 100);
}

type MasterMessage = {
  type: 'runTest';
  setupFilePaths: string[];
  testFilePath: string;
  nodeLocation: number[];
  testPatterns: string[];
  testOptions: TestOptions;
};

type WorkerMessage = { type: 'workerReady' } | RunnerMessage;

function evalFile(filePath: string): Promise<void> {
  return import(filePath);
}

function sendMessage(message: WorkerMessage): void {
  process.send!(message);
}
