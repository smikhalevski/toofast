import cluster from 'cluster';
import fs from 'fs';
import vm from 'vm';
import {createWorkerProtocol} from './createWorkerProtocol';
import {measure} from './measure';
import {Histogram} from './Histogram';
import path from 'path';
import {createMasterProtocol} from './createMasterProtocol';
import {sleep} from 'parallel-universe';

interface StartMessage {
  filePath: string;
  testPath: number[];
}

if (!cluster.worker) {

  const filePath = path.resolve(process.cwd(), process.argv[2]);

  const jsCode = fs.readFileSync(filePath, 'utf-8');

  const testSuiteProtocol = createMasterProtocol({

    runTest: (node) => new Promise((resolve, reject) => {

      console.log('---->', node.label);

      const worker = cluster.fork();

      worker.send({
        filePath,
        testPath: node.testPath,
      });

      worker.on('exit', resolve);
      worker.on('error', reject);
    }),
  });

  const vmContext = vm.createContext(testSuiteProtocol.testProtocol);

  vm.runInContext(jsCode, vmContext);

  testSuiteProtocol.run();

} else {

  cluster.worker.on('message', (message: StartMessage) => {

    const jsCode = fs.readFileSync(message.filePath, 'utf-8');

    const histogram = new Histogram();

    const testSuiteProtocol = createWorkerProtocol({
      testPath: message.testPath,
      runMeasure: (cb, options) => measure(cb, histogram, options),
    });

    const vmContext = vm.createContext(testSuiteProtocol.testProtocol);

    vm.runInContext(jsCode, vmContext);

    testSuiteProtocol.promise.then(() => {
      console.log(histogram);
    });

    testSuiteProtocol.promise.then(() => {
      process.exit(0);
    });

    testSuiteProtocol.run();
  });
}
