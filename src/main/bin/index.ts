// #!/usr/bin/env node

import cluster from 'cluster';
import childProcess from 'child_process';
import { createLoggingHandlers } from './createLoggingHandlers.js';
import { runMaster } from '../runner/runMaster.js';
import { runWorker } from '../runner/runWorker.js';
import { loadConfig } from './loadConfig.js';
import path from 'path';

(() => {
  if (cluster.isWorker) {
    runWorker({
      postMessage(message) {
        process.send!(message);
      },
      addMessageListener(listener) {
        process.on('message', listener);
      },
      importFile(file) {
        return import(file);
      },
      injectRuntime(_file, runtime) {
        Object.assign(global, runtime);
      },
      tearDown() {
        process.exit(0);
      },
    });
    return;
  }

  const config = loadConfig();

  if (
    (config.setupFiles?.some(isTypeScriptFile) || config.includeFiles.some(isTypeScriptFile)) &&
    !process.execArgv.includes('--experimental-strip-types')
  ) {
    const [, file, ...args] = process.argv;

    childProcess
      .fork(file, args, {
        execArgv: [...process.execArgv, '--experimental-strip-types', '--no-warnings=ExperimentalWarning'],
      })
      .once('close', code => process.exit(code));

    return;
  }

  runMaster({
    setupFiles: config.setupFiles,
    includeFiles: config.includeFiles,
    testNamePatterns: config.testNamePatterns,
    testOptions: config.testOptions,

    handlers: createLoggingHandlers(),

    importFile(file) {
      return import(file);
    },
    injectRuntime(_file, runtime) {
      Object.assign(global, runtime);
    },
    startWorker(options) {
      const worker = cluster.fork();

      worker.on('message', options.onMessage);
      worker.on('error', options.onError);
      worker.on('exit', options.onExit);

      return {
        postMessage(message) {
          worker.send(message);
        },
      };
    },
    tearDown() {
      process.exit(0);
    },
  });
})();

function isTypeScriptFile(file: string): boolean {
  const ext = path.extname(file);

  return ext === '.ts' || ext === '.mts' || ext === '.tsx' || ext === '.mtsx';
}
