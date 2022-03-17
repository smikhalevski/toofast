import {
  MasterMessage,
  MasterMessageHandlers,
  MessageType,
  Stats,
  WorkerMessage,
  WorkerMessageHandlers
} from './bin-types';
import {Histogram} from '../Histogram';
import {DescribeNode, NodeType, TestNode} from '../node-types';
import {type} from 'typedoc/dist/lib/output/themes/default/partials/type';

export function handleWorkerMessage(message: WorkerMessage, handlers: WorkerMessageHandlers): true {
  switch (message.type) {

    case MessageType.TEST_START:
      handlers.onTestStartMessage(message);
      return true;

    case MessageType.TEST_END:
      handlers.onTestEndMessage(message);
      return true;

    case MessageType.TEST_FATAL_ERROR:
      handlers.onTestFatalErrorMessage(message);
      return true;

    case MessageType.MEASURE_WARMUP_START:
      handlers.onMeasureWarmupStartMessage(message);
      return true;

    case MessageType.MEASURE_WARMUP_END:
      handlers.onMeasureWarmupEndMessage(message);
      return true;

    case MessageType.MEASURE_START:
      handlers.onMeasureStartMessage(message);
      return true;

    case MessageType.MEASURE_END:
      handlers.onMeasureEndMessage(message);
      return true;

    case MessageType.MEASURE_ERROR:
      handlers.onMeasureErrorMessage(message);
      return true;

    case MessageType.MEASURE_PROGRESS:
      handlers.onMeasureProgressMessage(message);
      return true;
  }
}

export function handleMasterMessage(message: MasterMessage, handlers: MasterMessageHandlers): true {
  switch (message.type) {

    case MessageType.TEST_LIFECYCLE_INIT:
      handlers.onTestLifecycleInitMessage(message);
      return true;
  }
}

export function getStats(histogram: Histogram): Stats {
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

export function getErrorMessage(error: any): string {
  return typeof error?.message === 'string' ? error.stack || error.message : String(error);
}

export function getTestPath(node: DescribeNode | TestNode): number[] {
  const testPath: number[] = [];

  let parentNode = node.parentNode;

  while (true) {
    testPath.unshift(parentNode.children.indexOf(node));
    if (parentNode.nodeType === NodeType.TEST_SUITE) {
      break;
    }
    node = parentNode;
    parentNode = parentNode.parentNode;
  }
  return testPath;
}

export function getLabelLength(node: TestNode): number {
  const siblings = node.parentNode.children;

  let i = siblings.indexOf(node);

  while (i !== 0 && siblings[i - 1].nodeType === NodeType.TEST) {
    --i;
  }

  let length = 0;

  while (i < siblings.length && siblings[i].nodeType === NodeType.TEST) {
    length = Math.max(length, siblings[i].label.length);
    ++i;
  }

  return length;
}
