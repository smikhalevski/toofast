import {Histogram} from './Histogram';
import {Awaitable} from 'parallel-universe';

export type Hook = () => void;

export type AsyncHook = () => Awaitable<void>;

export interface DescribeLifecycle {
  beforeEachHooks?: AsyncHook[];
  afterEachHooks?: AsyncHook[];
}

export interface TestLifecycle {
  afterWarmupHooks?: AsyncHook[];
  beforeBatchHooks?: AsyncHook[];
  afterBatchHooks?: AsyncHook[];
  beforeIterationHooks?: Hook[];
  afterIterationHooks?: Hook[];
}

export interface DescribeOptions {
  testTimeout?: number;
  targetRme?: number;
  warmupIterationCount?: number;
  batchIterationCount?: number;
  batchTimeout?: number;
}

export interface TestOptions extends DescribeOptions {
  afterWarmup?: AsyncHook;
  beforeBatch?: AsyncHook;
  afterBatch?: AsyncHook;
  beforeIteration?: Hook;
  afterIteration?: Hook;
}

export const enum NodeType {
  TEST_SUITE = 'testSuite',
  DESCRIBE = 'describe',
  TEST = 'test',
}

export interface TestSuiteNode extends DescribeLifecycle, TestLifecycle {
  nodeType: NodeType.TEST_SUITE;
  children: (DescribeNode | TestNode)[];
  options: DescribeOptions;
  promise: Promise<void>;
}

export interface DescribeNode extends DescribeLifecycle, TestLifecycle {
  nodeType: NodeType.DESCRIBE;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  children: (DescribeNode | TestNode)[];
  options: DescribeOptions | undefined;
  promise: Promise<void>;
}

export interface TestNode {
  nodeType: NodeType.TEST;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  histogram: Histogram;
  cb: () => Awaitable<void>;
  options: TestOptions | undefined;
  promise: Promise<void>;
}
