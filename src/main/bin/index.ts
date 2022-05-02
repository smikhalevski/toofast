import cluster from 'cluster';
import {createLoggingHandlers} from './createLoggingHandlers';
import {runMaster} from './runMaster';
import {runWorker} from './runWorker';

if (cluster.isWorker) {
  runWorker();
} else {
  runMaster(createLoggingHandlers());
}
