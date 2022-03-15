import cluster from 'cluster';
import {runWorker} from './runWorker';
import {runMaster} from './runMaster';
import {createLogHandlers} from './createLogHandlers';

if (cluster.isWorker) {
  runWorker();
} else {
  runMaster(createLogHandlers());
}
