import { MasterMessage, MasterMessageHandlers, WorkerMessage, WorkerMessageHandlers } from './types.js';
import { DescribeNode, TestNode } from '../createTestSuiteLifecycle.js';

export function handleWorkerMessage(message: WorkerMessage, handlers: WorkerMessageHandlers): true {
  switch (message.type) {
    case 'testStart':
      handlers.onTestStartMessage(message);
      return true;

    case 'testEnd':
      handlers.onTestEndMessage(message);
      return true;

    case 'testFatalError':
      handlers.onTestFatalErrorMessage(message);
      return true;

    case 'measureWarmupStart':
      handlers.onMeasureWarmupStartMessage(message);
      return true;

    case 'measureWarmupEnd':
      handlers.onMeasureWarmupEndMessage(message);
      return true;

    case 'measureStart':
      handlers.onMeasureStartMessage(message);
      return true;

    case 'measureEnd':
      handlers.onMeasureEndMessage(message);
      return true;

    case 'measureError':
      handlers.onMeasureErrorMessage(message);
      return true;

    case 'measureProgress':
      handlers.onMeasureProgressMessage(message);
      return true;
  }
}

export function handleMasterMessage(message: MasterMessage, handlers: MasterMessageHandlers): true {
  switch (message.type) {
    case 'testLifecycleInit':
      handlers.onTestLifecycleInitMessage(message);
      return true;
  }
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

export function getNameLength(node: TestNode): number {
  const siblings = node.parent.children;

  let i = siblings.indexOf(node);

  while (i !== 0 && siblings[i - 1].type === 'test') {
    --i;
  }

  let length = 0;

  while (i < siblings.length && siblings[i].type === 'test') {
    length = Math.max(length, siblings[i].name.length);
    ++i;
  }

  return length;
}
