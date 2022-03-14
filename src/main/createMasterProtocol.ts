import {DescribeNode, NodeType, TestNode, TestSuiteNode} from './node-types';
import {TestProtocol} from './test-types';
import {noop} from './utils';

export interface MasterHandlers {

  onDescribeStart(node: DescribeNode): void;

  onDescribeEnd(node: DescribeNode): void;

  onTestStart(node: TestNode): void;

  onTestEnd(node: TestNode): void;
}

export interface MasterProtocolOptions {
  runTest(node: TestNode): Promise<void>;
}

export function createMasterProtocol(handlers: MasterHandlers, options: MasterProtocolOptions) {
  const {
    onDescribeStart,
    onDescribeEnd,
    onTestStart,
    onTestEnd,
  } = handlers;

  const {runTest} = options;

  let run!: () => void;
  let promise = new Promise<void>((resolve) => {
    run = resolve;
  });

  const node: TestSuiteNode = {
    nodeType: NodeType.TEST_SUITE,
    children: [],
  };

  let parentNode: DescribeNode | TestSuiteNode = node;

  const testPath: number[] = [-1];
  let i = 0;

  const testProtocol: TestProtocol = {
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

      testPath[i]++;
      testPath[++i] = -1;

      promise = promise.then(() => {
        onDescribeStart(node);
      });

      cb();

      promise = promise.then(() => {
        onDescribeEnd(node);
      });

      parentNode = node.parentNode;
      i--;
    },

    test(label) {
      testPath[i]++;

      const node: TestNode = {
        nodeType: NodeType.TEST,
        parentNode,
        label,
        testPath: testPath.slice(0, i + 1),
      };

      parentNode.children.push(node);

      promise = promise.then(() => {
        onTestStart(node);
        return runTest(node);
      }).then(() => {
        onTestEnd(node);
      });
    },
  };

  return {
    node,
    testProtocol,
    getPromise: () => promise,
    run,
  };
}
