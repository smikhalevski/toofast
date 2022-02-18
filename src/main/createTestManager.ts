import {cycle} from './cycle';
import {Histogram} from './Histogram';
import {AsyncHook, DescribeNode, DescribeOptions, NodeType, TestNode, TestOptions, TestSuiteNode} from './test-model';
import {Awaitable, isPromiseLike} from 'parallel-universe';

export interface TestManager {

  node: TestSuiteNode;
  protocol: TestProtocol;

  start(): void;
}

export interface TestProtocol {

  beforeEach(cb: () => Awaitable<void>): void;

  afterEach(cb: () => Awaitable<void>): void;

  afterWarmup(cb: () => Awaitable<void>): void;

  beforeBatch(cb: () => Awaitable<void>): void;

  afterBatch(cb: () => Awaitable<void>): void;

  beforeIteration(cb: () => void): void;

  afterIteration(cb: () => void): void;

  describe(label: string, cb: () => void, options?: DescribeOptions): void;

  test(label: string, cb: () => void, options?: TestOptions): void;
}

export type Handler<T> = (node: T) => Awaitable<void>;

export interface TestManagerHandlers {
  describeStarted: Handler<DescribeNode>;
  describeCompleted: Handler<DescribeNode>;
  testStarted: Handler<TestNode>;
  testCompleted: Handler<TestNode>;
}

export function createTestManager(options: DescribeOptions, handlers: TestManagerHandlers): TestManager {
  const {
    describeStarted,
    describeCompleted,
    testStarted,
    testCompleted,
  } = handlers;

  let start!: () => void;
  let promise = new Promise<void>((resolve) => {
    start = resolve;
  });

  const node: TestSuiteNode = {
    nodeType: NodeType.TEST_SUITE,
    children: [],
    options,
    promise,
  };

  let parentNode: DescribeNode | TestSuiteNode = node;

  const protocol: TestProtocol = {

    beforeEach(cb) {
      (parentNode.beforeEachHooks ||= []).push(cb);
    },
    afterEach(cb) {
      (parentNode.afterEachHooks ||= []).push(cb);
    },
    afterWarmup(cb) {
      (parentNode.afterWarmupHooks ||= []).push(cb);
    },
    beforeBatch(cb) {
      (parentNode.beforeBatchHooks ||= []).push(cb);
    },
    afterBatch(cb) {
      (parentNode.afterBatchHooks ||= []).push(cb);
    },
    beforeIteration(cb) {
      (parentNode.beforeIterationHooks ||= []).push(cb);
    },
    afterIteration(cb) {
      (parentNode.afterIterationHooks ||= []).push(cb);
    },

    describe(label, cb, options) {
      promise = promise.then(() => describeStarted(node));
      cb();
      promise = promise.then(() => describeCompleted(node));

      const node: DescribeNode = {
        nodeType: NodeType.DESCRIBE,
        parentNode,
        label,
        children: [],
        promise,
        options,
      };
      parentNode.children.push(node);
    },

    test(label, cb, options) {
      promise = promise
          .then(() => testStarted(node))
          .then(() => cycle(node, createCycleOptions(node)))
          .then(() => testCompleted(node));

      const node: TestNode = {
        nodeType: NodeType.TEST,
        parentNode,
        label,
        histogram: new Histogram(),
        cb,
        options,
        promise,
      };
      parentNode.children.push(node);
    },
  };

  return {
    node,
    protocol,
    start,
  };
}

export function createCycleOptions(node: TestSuiteNode | DescribeNode | TestNode) {

  const afterWarmupHooks: AsyncHook[] = [];
  const beforeBatchHooks: AsyncHook[] = [];
  const afterBatchHooks: AsyncHook[] = [];
  const beforeIterationHooks: AsyncHook[] = [];
  const afterIterationHooks: AsyncHook[] = [];

  const options: TestOptions = {
    afterWarmup: combineHooks(afterWarmupHooks),
    beforeBatch: combineHooks(beforeBatchHooks),
    afterBatch: combineHooks(afterBatchHooks),
    beforeIteration: combineHooks(beforeIterationHooks),
    afterIteration: combineHooks(afterIterationHooks),
  };

  while (true) {

    Object.assign({}, node.options, options);

    if (node.nodeType === NodeType.TEST_SUITE || node.nodeType === NodeType.DESCRIBE) {
      push(afterWarmupHooks, node.afterWarmupHooks);
      push(beforeBatchHooks, node.beforeBatchHooks);
      push(afterBatchHooks, node.afterBatchHooks);
      push(beforeIterationHooks, node.beforeIterationHooks);
      push(afterIterationHooks, node.afterIterationHooks);
    }
    if (node.nodeType === NodeType.TEST) {
      const options = node.options;
      if (options) {
        push(afterWarmupHooks, options.afterWarmup);
        push(beforeBatchHooks, options.beforeBatch);
        push(afterBatchHooks, options.afterBatch);
        push(beforeIterationHooks, options.beforeIteration);
        push(afterIterationHooks, options.afterIteration);
      }
    }
    if (node.nodeType === NodeType.TEST_SUITE) {
      break;
    }
    node = node.parentNode;
  }

  return options;
}

function push(hooks: AsyncHook[], hook: AsyncHook[] | AsyncHook | undefined): void {
  if (hook == null) {
    return;
  }
  if (Array.isArray(hook)) {
    hooks.push(...hook);
  } else {
    hooks.push(hook);
  }
}

function combineHooks(hooks: AsyncHook[]): AsyncHook {
  const results: unknown[] = [];

  return () => {
    let async = false;

    for (let i = 0; i < hooks.length; ++i) {
      const result = hooks[i]();
      async ||= isPromiseLike(result);
      results[i] = result;
    }
    if (async) {
      return Promise.allSettled(results) as Promise<any>;
    }
  };
}
