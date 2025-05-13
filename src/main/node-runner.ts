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

  const { setupFiles, testFiles, testRegExps, testOptions } = resolveConfig();

  const testPatterns = testRegExps.map(re => re.source);

  const logger = createNodeLogger();

  for (const testFile of testFiles) {
    let nodeLocation: number[] = [];

    const nextTest = (): Promise<void> => {
      return new Promise(resolve => {
        const worker = cluster.fork();

        worker.on('message', (message: WorkerMessage) => {
          if (message.type === 'workerReady') {
            worker.send({
              type: 'runTest',
              setupFiles,
              testFile,
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

        worker.on('exit', resolve);
      });
    };

    await nextTest();
  }

  process.exit(0);
}

function startWorker(): void {
  const messageListener = async (message: MasterMessage) => {
    if (message.type !== 'runTest') {
      return;
    }

    process.off('message', messageListener);

    const { setupFiles, testFile, nodeLocation, testPatterns } = message;

    const testRegExps = testPatterns.map(pattern => RegExp(pattern, 'i'));

    const testSuiteNode = new TestSuiteNode(message.testOptions);

    setCurrentNode(testSuiteNode);

    const isSuccessful = await bootstrapRunner({
      setupFiles,
      testFile,
      evalFile,
      sendMessage,
    });

    if (!isSuccessful) {
      cluster.worker!.kill();
      return;
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

    cluster.worker!.kill();
  };

  process.on('message', messageListener);

  sendMessage({ type: 'workerReady' });
}

type MasterMessage = {
  type: 'runTest';
  setupFiles: string[];
  testFile: string;
  nodeLocation: number[];
  testPatterns: string[];
  testOptions: TestOptions;
};

type WorkerMessage = { type: 'workerReady' } | RunnerMessage;

function evalFile(file: string): Promise<void> {
  return import(file);
}

function sendMessage(message: WorkerMessage): void {
  process.send!(message);
}
