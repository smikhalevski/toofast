import {Histogram} from './Histogram';
import {Awaitable} from 'parallel-universe';

export type Hook = () => void;

export type AsyncHook = () => any;

export interface TestSuiteLifecycle {
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

export const enum NodeType {
  TEST_SUITE = 'testSuite',
  DESCRIBE = 'describe',
  TEST = 'test',
}

export interface TestSuiteNode extends TestSuiteLifecycle, TestLifecycle {
  nodeType: NodeType.TEST_SUITE;
  children: (DescribeNode | TestNode)[];
  options: TestOptions | undefined;
}

export interface DescribeNode extends TestSuiteLifecycle, TestLifecycle {
  nodeType: NodeType.DESCRIBE;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  children: (DescribeNode | TestNode)[];
  options: TestOptions | undefined;
}

export interface TestNode {
  nodeType: NodeType.TEST;
  parentNode: TestSuiteNode | DescribeNode;
  label: string;
  histogram: Histogram;
  cb: () => Awaitable<void>;
  options: TestOptions | undefined;
}

// -----------------

export interface TestOptions {
  testTimeout?: number;
  targetRme?: number;
  warmupIterationCount?: number;
  batchIterationCount?: number;
  batchTimeout?: number;
}

export interface MeasureOptions extends TestOptions {
  afterWarmup?: AsyncHook;
  beforeBatch?: AsyncHook;
  afterBatch?: AsyncHook;
  beforeIteration?: Hook;
  afterIteration?: Hook;
}

export interface TestProtocol {

  beforeEach(hook: AsyncHook): void;

  afterEach(hook: AsyncHook): void;

  afterWarmup(hook: AsyncHook): void;

  beforeBatch(hook: AsyncHook): void;

  afterBatch(hook: AsyncHook): void;

  beforeIteration(hook: Hook): void;

  afterIteration(hook: Hook): void;

  describe(label: string, cb: () => Awaitable<void>, options?: TestOptions): void;

  test(label: string, cb: (measure: (cb: () => unknown) => Promise<void>) => Awaitable<void>, options?: TestOptions): void;
}

export interface TestSuiteProtocol {

  testProtocol: TestProtocol;
  promise: Promise<void>;

  run(): void;
}
