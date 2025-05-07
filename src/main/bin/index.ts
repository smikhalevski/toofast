// #!/usr/bin/env node
import cluster from 'cluster';
import { createLoggingHandlers } from './createLoggingHandlers.js';
import { runMaster } from './runMaster.js';
import { runWorker } from './runWorker.js';

if (cluster.isWorker) {
  runWorker();
} else {
  runMaster(createLoggingHandlers());
}
