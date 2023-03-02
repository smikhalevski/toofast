import { DescribeNode, NodeType, TestNode, TestSuiteNode } from './node-types';
import { Runtime } from './test-types';
import { noop } from './utils';

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

export interface TestSuiteLifecycleOptions {
  /**
   * The list of test label patterns that must be run. If omitted then all tests are run.
   */
  testNamePatterns?: RegExp[];
}

export function createTestSuiteLifecycle(
  runTestLifecycle: (node: TestNode) => Promise<void>,
  handlers: TestSuiteLifecycleHandlers = {},
  options: TestSuiteLifecycleOptions = {}
): TestSuiteLifecycle {
  const { onDescribeStart, onDescribeEnd } = handlers;

  const { testNamePatterns } = options;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>(resolve => {
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

    describe(label) {
      const node: DescribeNode = {
        nodeType: NodeType.DESCRIBE,
        parentNode,
        label,
        children: [],
      };
      parentNode.children.push(node);
      parentNode = node;

      if (onDescribeStart) {
        lifecyclePromise = lifecyclePromise.then(() => {
          if (hasEnabledTests(node)) {
            return onDescribeStart(node);
          }
        });
      }

      arguments[typeof arguments[1] === 'function' ? 1 : 2]();

      if (onDescribeEnd) {
        lifecyclePromise = lifecyclePromise.then(() => {
          if (hasEnabledTests(node)) {
            return onDescribeEnd(node);
          }
        });
      }

      parentNode = node.parentNode;
    },

    test(label) {
      const node: TestNode = {
        nodeType: NodeType.TEST,
        parentNode,
        label,
        enabled: true,
      };
      parentNode.children.push(node);

      if (testNamePatterns) {
        node.enabled = testNamePatterns.some(re => isMatchingLabel(node, re));
      }

      lifecyclePromise = lifecyclePromise.then(() => {
        if (node.enabled) {
          return runTestLifecycle(node);
        }
      });
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

function isMatchingLabel(node: DescribeNode | TestNode, re: RegExp): boolean {
  return (
    re.test(node.label) || (node.parentNode.nodeType !== NodeType.TEST_SUITE && isMatchingLabel(node.parentNode, re))
  );
}

function hasEnabledTests(node: DescribeNode): boolean {
  for (const child of node.children) {
    if (
      (child.nodeType === NodeType.DESCRIBE && hasEnabledTests(child)) ||
      (child.nodeType === NodeType.TEST && child.enabled)
    ) {
      return true;
    }
  }
  return false;
}
