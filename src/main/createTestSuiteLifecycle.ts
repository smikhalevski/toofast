import {Runtime} from './test-types';
import {noop} from './utils';
import {DescribeNode, NodeType, TestNode, TestSuiteNode} from './node-types';

export interface TestSuiteLifecycleHandlers {

  /**
   * Triggered before the `describe` block is run.
   */
  onDescribeStart?(node: DescribeNode): void;

  /**
   * Triggered after the `describe` block is completed.
   */
  onDescribeEnd?(node: DescribeNode): void;
}

export interface TestSuiteLifecycle {

  /**
   * The tree of test and declaration DSL nodes.
   */
  node: TestSuiteNode;

  /**
   * Functions that should be exposed in a test script.
   */
  runtime: Runtime;

  /**
   * Starts the test suite lifecycle execution.
   *
   * @returns The promise that resolves when the test suite lifecycle is completed.
   */
  run(): Promise<void>;
}

export function createTestSuiteLifecycle(runTestLifecycle: (node: TestNode) => Promise<void>, handlers: TestSuiteLifecycleHandlers = {}): TestSuiteLifecycle {

  const {
    onDescribeStart,
    onDescribeEnd,
  } = handlers;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>((resolve) => {
    runLifecycle = resolve;
  });

  const node: TestSuiteNode = {
    nodeType: NodeType.TEST_SUITE,
    children: [],
  };

  let parentNode: DescribeNode | TestSuiteNode = node;

  const runtime: Runtime = {

    beforeEach: noop,
    afterEach: noop,
    afterWarmup: noop,
    beforeBatch: noop,
    afterBatch: noop,
    beforeIteration: noop,
    afterIteration: noop,

    describe(label, cb) {
      const node: DescribeNode = {
        nodeType: NodeType.DESCRIBE,
        parentNode,
        label,
        children: [],
      };
      parentNode.children.push(node);
      parentNode = node;

      if (onDescribeStart) {
        lifecyclePromise = lifecyclePromise.then(() => onDescribeStart(node));
      }

      cb();

      if (onDescribeEnd) {
        lifecyclePromise = lifecyclePromise.then(() => onDescribeEnd(node));
      }

      parentNode = node.parentNode;
    },

    test(label) {
      const node: TestNode = {
        nodeType: NodeType.TEST,
        parentNode,
        label,
      };
      parentNode.children.push(node);

      lifecyclePromise = lifecyclePromise.then(() => runTestLifecycle(node));
    },
  };

  return {
    node,
    runtime,
    run() {
      runLifecycle();
      return lifecyclePromise;
    },
  };
}
