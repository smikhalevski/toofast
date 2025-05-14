import cluster from 'cluster';
import childProcess from 'child_process';
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
import path from 'path';

export default async function start(): Promise<void> {
  if (cluster.isWorker) {
    startWorker();
    return;
  }

  const config = resolveConfig();

  // Restart process and enable TypeScript support
  if (
    (config.setupFiles.some(isTypeScriptFile) || config.testFiles.some(isTypeScriptFile)) &&
    !process.execArgv.includes('--experimental-strip-types')
  ) {
    const [, filePath, ...args] = process.argv;

    childProcess
      .fork(filePath, args, {
        execArgv: [...process.execArgv, '--experimental-strip-types', '--no-warnings=ExperimentalWarning'],
      })
      .once('close', exitCode => process.exit(exitCode));

    return;
  }

  const testPatterns = config.testRegExps.map(re => re.source);

  const logger = createNodeLogger();

  for (const testFile of config.testFiles) {
    let nodeLocation: number[] = [];

    const nextTest = (): Promise<void> => {
      return new Promise(resolve => {
        const worker = cluster.fork();

        worker.on('message', (message: WorkerMessage) => {
          if (message.type === 'workerReady') {
            worker.send({
              type: 'runTest',
              setupFiles: config.setupFiles,
              testFile,
              nodeLocation,
              testPatterns,
              testOptions: config.testOptions,
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
          if (message.type === 'testSuiteEnd') {
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
  process.once('message', async (message: MasterMessage) => {
    if (message.type !== 'runTest') {
      return;
    }

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
  });

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

function isTypeScriptFile(file: string): boolean {
  const ext = path.extname(file);

  return ext === '.ts' || ext === '.mts' || ext === '.tsx' || ext === '.mtsx';
}
