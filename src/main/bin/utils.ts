import {
  MasterMessage,
  MasterMessageHandler,
  MessageType,
  Stats,
  WorkerMessage,
  WorkerMessageHandler
} from './bin-types';
import {Histogram} from '../Histogram';
import {NodeType, TestNode} from '../node-types';

export function handleMasterMessage(message: MasterMessage, handler: MasterMessageHandler): true {
  switch (message.type) {

    case MessageType.TEST_START:
      handler.onTestStartMessage(message);
      return true;

    case MessageType.TEST_END:
      handler.onTestEndMessage(message);
      return true;

    case MessageType.TEST_ERROR:
      handler.onTestErrorMessage(message);
      return true;

    case MessageType.MEASURE_WARMUP_START:
      handler.onMeasureWarmupStartMessage(message);
      return true;

    case MessageType.MEASURE_WARMUP_END:
      handler.onMeasureWarmupEndMessage(message);
      return true;

    case MessageType.MEASURE_START:
      handler.onMeasureStartMessage(message);
      return true;

    case MessageType.MEASURE_END:
      handler.onMeasureEndMessage(message);
      return true;

    case MessageType.MEASURE_ERROR:
      handler.onMeasureErrorMessage(message);
      return true;

    case MessageType.MEASURE_PROGRESS:
      handler.onMeasureProgressMessage(message);
      return true;
  }
}

export function handleWorkerMessage(message: WorkerMessage, handler: WorkerMessageHandler): true {
  switch (message.type) {

    case MessageType.TEST_LIFECYCLE_INIT:
      handler.onTestLifecycleInitMessage(message);
      return true;
  }
}

export function extractStats(histogram: Histogram): Stats {
  return {
    size: histogram.size,
    mean: histogram.getMean(),
    variance: histogram.getVariance(),
    sd: histogram.getSd(),
    sem: histogram.getSem(),
    moe: histogram.getMoe(),
    rme: histogram.getRme(),
    hz: histogram.getHz(),
  };
}

export function extractErrorMessage(error: any): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

export function extractTestPath(node: TestNode): number[] {
  const testPath: number[] = [];

  let parentNode = node.parentNode;

  while (true) {
    testPath.unshift(parentNode.children.indexOf(node));
    if (parentNode.nodeType === NodeType.TEST_SUITE) {
      break;
    }
    parentNode = parentNode.parentNode;
  }
  return testPath;
}
