import { Histogram } from '../Histogram.js';
import {
  MasterMessage,
  MasterMessageHandlers,
  MessageType,
  Stats,
  WorkerMessage,
  WorkerMessageHandlers,
} from './types.js';
import { DescribeNode, TestNode } from '../createTestSuiteLifecycle.js';

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

export function toStats(histogram: Histogram): Stats {
  return {
    size: histogram.size,
    mean: histogram.mean,
    variance: histogram.variance,
    sd: histogram.sd,
    sem: histogram.sem,
    moe: histogram.moe,
    rme: histogram.rme,
    hz: histogram.hz,
  };
}

export function getErrorMessage(error: any): string {
  return typeof error?.message === 'string' ? error.stack || error.message : String(error);
}

export function getTestPath(node: DescribeNode | TestNode): number[] {
  const testPath: number[] = [];

  let parent = node.parent;

  while (true) {
    testPath.unshift(parent.children.indexOf(node));
    if (parent.type === 'testSuite') {
      break;
    }
    node = parent;
    parent = parent.parent;
  }
  return testPath;
}

export function getLabelLength(node: TestNode): number {
  const siblings = node.parent.children;

  let i = siblings.indexOf(node);

  while (i !== 0 && siblings[i - 1].type === 'test') {
    --i;
  }

  let length = 0;

  while (i < siblings.length && siblings[i].type === 'test') {
    length = Math.max(length, siblings[i].label.length);
    ++i;
  }

  return length;
}
