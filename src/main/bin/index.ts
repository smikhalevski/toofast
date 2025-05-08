// #!/usr/bin/env node
import cluster from 'cluster';
import { createLoggingHandlers } from './createLoggingHandlers.js';
import { runMaster } from './runMaster.js';
import { runWorker } from './runWorker.js';
import { loadConfig } from './loadConfig.js';
import { loadFile } from './utils.js';

if (cluster.isWorker) {
  runWorker({
    postMessage(message) {
      process.send!(message);
    },
    subscribeToMessage(listener) {
      process.on('message', listener);
    },
    loadFile,
    loadRuntime(runtime) {
      Object.assign(global, runtime);
    },
    tearDown() {
      process.exit(0);
    },
  });
} else {
  loadConfig().then(config => {
    runMaster({
      setupFilePaths: config.setupFilePaths,
      includeFilePaths: config.includeFilePaths,
      testNamePatterns: config.testNamePatterns,
      testOptions: config.testOptions,

      handlers: createLoggingHandlers(),

      loadFile,
      loadRuntime(runtime) {
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
  });
}
