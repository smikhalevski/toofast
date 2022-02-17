import {cycle, TestOptions} from './cycle';
import {Histogram} from './Histogram';
import {Awaitable} from 'parallel-universe';

export interface TestHooks {

  afterWarmup?(): Awaitable<void>;

  beforeBatch?(): Awaitable<void>;

  afterBatch?(): Awaitable<void>;

  beforeIteration?(): Awaitable<void>;

  afterIteration?(): Awaitable<void>;
}

export interface DescribeHooks extends TestHooks {

  beforeEach?(): Awaitable<void>;

  afterEach?(): Awaitable<void>;
}

export interface TestSuiteNode extends DescribeHooks {
  type: 'testSuite';
  children: (DescribeNode | TestNode)[];
}

export interface DescribeNode extends DescribeHooks {
  type: 'describe';
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  children: (DescribeNode | TestNode)[];
}

export interface TestNode extends TestHooks {
  type: 'test';
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  options: TestOptions;
  histogram: Histogram;
  completed: boolean;
  cb: () => Awaitable<void>;
}

export interface TestManagerOptions {

  describeStarted(node: DescribeNode): void;

  describeCompleted(node: DescribeNode): void;

  testStarted(node: TestNode): void;

  testCompleted(node: TestNode): void;
}

export function createTestManager(options: TestManagerOptions) {
  const {
    describeStarted,
    describeCompleted,
    testStarted,
    testCompleted,
  } = options;

  let run!: () => void;
  let testPending = false;

  const testSuiteNode: TestSuiteNode = {
    type: 'testSuite',
    children: [],
  };

  let parentNode: DescribeNode | TestSuiteNode = testSuiteNode;

  let promise = new Promise<void>((resolve) => {
    run = resolve;
  });

  const beforeEach = (cb: () => void): void => {
    parentNode.beforeEach = cb;
  };

  const afterEach = (cb: () => void): void => {
    parentNode.afterEach = cb;
  };

  const afterWarmup = (cb: () => void): void => {
    parentNode.afterWarmup = cb;
  };

  const beforeBatch = (cb: () => void): void => {
    parentNode.beforeBatch = cb;
  };

  const afterBatch = (cb: () => void): void => {
    parentNode.afterBatch = cb;
  };

  const beforeIteration = (cb: () => void): void => {
    parentNode.beforeIteration = cb;
  };

  const afterIteration = (cb: () => void): void => {
    parentNode.afterIteration = cb;
  };

  const describe = (label: string, cb: () => void): void => {
    const node: DescribeNode = {
      type: 'describe',
      parentNode,
      label,
      children: [],
    };
    parentNode.children.push(node);
    promise = promise.then(() => describeStarted(node));
    cb();
    promise = promise.then(() => describeCompleted(node));
  };

  const test = (label: string, cb: () => void, options: TestOptions = {}): void => {
    if (testPending) {
      return;
    }
    const node: TestNode = {
      type: 'test',
      parentNode,
      label,
      options,
      histogram: new Histogram(),
      completed: false,
      cb,
    };
    parentNode.children.push(node);
    promise = promise.then(() => {
      testPending = true;
      testStarted(node);
      return cycle(cb, node.histogram, options);
    }).then(() => {
      node.completed = true;
      testPending = false;
      testCompleted(node);
    });
  };

  return {
    run,
    protocol: {

      beforeEach,
      afterEach,
      afterWarmup,
      beforeBatch,
      afterBatch,
      beforeIteration,
      afterIteration,

      describe,
      test,
    },
  };
}
