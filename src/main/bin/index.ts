import cluster from 'cluster';
import {runWorker} from './runWorker';
import {runMaster} from './runMaster';
import {createLoggingHandlers} from './createLoggingHandlers';

if (cluster.isWorker) {
  runWorker();
} else {
  runMaster(createLoggingHandlers());
}
