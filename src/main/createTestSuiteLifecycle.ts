import { Runtime } from './types.js';
import { noop } from './utils.js';

export interface TestSuiteNode {
  type: 'testSuite';
  children: Array<DescribeNode | TestNode>;
}

export interface DescribeNode {
  type: 'describe';
  parent: TestSuiteNode | DescribeNode;
  name: string;
  children: Array<DescribeNode | TestNode>;
}

export interface TestNode {
  type: 'test';
  parent: TestSuiteNode | DescribeNode;
  name: string;
  isEnabled: boolean;
}

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
   * The list of test name patterns that must be run. If omitted then all tests are run.
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
    type: 'testSuite',
    children: [],
  };

  let parent: DescribeNode | TestSuiteNode = node;

  const runtime: Runtime = {
    beforeEach: noop,
    afterEach: noop,
    afterWarmup: noop,
    beforeBatch: noop,
    afterBatch: noop,
    beforeIteration: noop,
    afterIteration: noop,

    describe(name) {
      const node: DescribeNode = {
        type: 'describe',
        parent,
        name,
        children: [],
      };

      parent.children.push(node);
      parent = node;

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

      parent = node.parent;
    },

    test(name) {
      const node: TestNode = {
        type: 'test',
        parent,
        name,
        isEnabled: true,
      };

      parent.children.push(node);

      if (testNamePatterns) {
        node.isEnabled = testNamePatterns.some(pattern => isMatchingName(node, pattern));
      }

      lifecyclePromise = lifecyclePromise.then(() => {
        if (node.isEnabled) {
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

function isMatchingName(node: DescribeNode | TestNode, pattern: RegExp): boolean {
  return pattern.test(node.name) || (node.parent.type !== 'testSuite' && isMatchingName(node.parent, pattern));
}

function hasEnabledTests(node: DescribeNode): boolean {
  for (const child of node.children) {
    if ((child.type === 'describe' && hasEnabledTests(child)) || (child.type === 'test' && child.isEnabled)) {
      return true;
    }
  }
  return false;
}
