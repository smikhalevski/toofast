import cluster from 'cluster';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import {createWorkerProtocol, WorkerHandlers} from './createWorkerProtocol';
import {createMasterProtocol, MasterHandlers} from './createMasterProtocol';
import {measure} from './measure';
import {Stats, TestNode} from './node-types';
import {bold, dim, green, red} from 'kleur/colors';

const enum MessageType {
  START,
  ERROR,
  PROGRESS,
  TEST_COMPLETE,
}

interface StartMessage {
  type: MessageType.START;
  filePath: string;
  testPath: number[];
}

interface ErrorMessage {
  type: MessageType.ERROR;
  message: string;
}

interface ProgressMessage {
  type: MessageType.PROGRESS;
  prc: number;
}

interface TestCompleteMessage {
  type: MessageType.TEST_COMPLETE;
  stats: Stats;
}

if (cluster.isMaster) {

  let depth = 0;
  let testLabel = '';
  let errorMessage: string | undefined;

  const numberFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  const percentFormat = new Intl.NumberFormat('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    style: 'percent',
  });

  const handlers: MasterHandlers = {

    onDescribeStart(node) {
      console.log('  '.repeat(depth) + node.label);
      ++depth;
    },

    onDescribeEnd(node) {
      --depth;
    },

    onTestStart(node) {
      testLabel = node.label.padEnd(node.parentNode.children.map((node) => node.label.length).sort((a, b) => b - a)[0]);
      errorMessage = undefined;
      process.stdout.write('\r' + '  '.repeat(depth) + dim('→ ') + testLabel);
    },

    onTestEnd(node) {
      process.stdout.write('\n');

      if (errorMessage) {
        process.stdout.write(red(errorMessage) + '\n\n');
      }
    },
  };

  const onTestComplete = (stats: Stats): void => {
    process.stdout.write(
        '\r'
        + '  '.repeat(depth)
        + (errorMessage ? red(bold('× ')) : green(bold('✓ ')))
        + testLabel
        + '  '
        + numberFormat.format(stats.hz)
        + ' ops/sec ± '
        + numberFormat.format(stats.variance)
    );
  };

  const onError = (message: any): void => {
    errorMessage = message;
  };

  const onProgress = (prc: number): void => {
    process.stdout.write(
        '\r'
        + '  '.repeat(depth)
        + '  '
        + testLabel
        + '  '
        + percentFormat.format(prc).padStart(3)
    );
  };


  const filePath = path.resolve(process.cwd(), process.argv[2]);

  const jsCode = fs.readFileSync(filePath, 'utf-8');

  const masterProtocol = createMasterProtocol(handlers, {

    runTest: (node) => new Promise((resolve, reject) => {
      const worker = cluster.fork();

      worker.send({
        filePath,
        testPath: node.testPath,
      });

      worker.on('message', (message: ErrorMessage | ProgressMessage | TestCompleteMessage) => {
        switch (message?.type) {

          case MessageType.ERROR:
            onError(message.message);
            break;

          case MessageType.PROGRESS:
            onProgress(message.prc);
            break;

          case MessageType.TEST_COMPLETE:
            onTestComplete(message.stats);
            break;
        }
      });

      worker.on('exit', resolve);
      worker.on('error', reject);
    }),
  });

  const vmContext = vm.createContext(masterProtocol.testProtocol);

  vm.runInContext(jsCode, vmContext);

  masterProtocol.run();

} else {

  let prevPrc = -1;

  const handlers: WorkerHandlers = {

    onTestComplete(histogram) {
      const message: TestCompleteMessage = {
        type: MessageType.TEST_COMPLETE,
        stats: {
          size: histogram.size,
          mean: histogram.getMean(),
          variance: histogram.getVariance(),
          sd: histogram.getSd(),
          sem: histogram.getSem(),
          moe: histogram.getMoe(),
          rme: histogram.getRme(),
          hz: histogram.getHz(),
        }
      };
      process.send?.(message);
    },

    onProgress(prc) {
      const nextPrc = Math.round(prc * 100) / 100;

      if (prevPrc === nextPrc) {
        return;
      }
      prevPrc = nextPrc;

      const message: ProgressMessage = {
        type: MessageType.PROGRESS,
        prc: nextPrc,
      };
      process.send?.(message);
    },

    onError(error) {
      const message: ErrorMessage = {
        type: MessageType.ERROR,
        message: String(error),
      };
      process.send?.(message);
    },
  };

  process.on('message', (message: StartMessage) => {

    const jsCode = fs.readFileSync(message.filePath, 'utf-8');

    const workerProtocol = createWorkerProtocol(handlers, {
      testPath: message.testPath,
      runMeasure: measure,
    });

    const vmContext = vm.createContext(workerProtocol.testProtocol);

    vm.runInContext(jsCode, vmContext);

    workerProtocol.getPromise().then(() => {
      process.exit(0);
    });

    workerProtocol.run();
  });
}
