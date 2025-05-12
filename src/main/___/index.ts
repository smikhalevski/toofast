import { getCurrentNode, DescribeNode, MeasureNode, TestNode, TestSuiteNode } from './runner-api.js';

export interface TestOptions {
  /**
   * Maximum measure duration. Doesn't include the duration of warmup iterations.
   *
   * @default 10_000
   */
  measureTimeout?: number;

  /**
   * The maximum relative margin of error that must be reached for each measurement [0, 1].
   *
   * @default 0.002
   */
  targetRme?: number;

  /**
   * The maximum number of warmup iterations that are run before each measurement.
   *
   * @default 1
   */
  warmupIterationCount?: number;

  /**
   * The maximum number of iterations in a batch.
   *
   * @default Infinity
   */
  batchIterationCount?: number;

  /**
   * The maximum duration of batched measurements.
   *
   * @default 1_000
   */
  batchTimeout?: number;

  /**
   * The delay between batched measurements. VM is expected to run garbage collector during this delay.
   *
   * @default 200
   */
  batchIntermissionTimeout?: number;
}

export interface MeasureOptions extends TestOptions {
  afterWarmup?: HookCallback;
  beforeBatch?: HookCallback;
  afterBatch?: HookCallback;
  beforeIteration?: HookCallback;
  afterIteration?: HookCallback;
}

export type HookCallback = () => PromiseLike<void> | void;

export function beforeEach(hook: HookCallback): void {
  getCurrentNode().beforeEach(hook);
}

export function afterEach(hook: HookCallback): void {
  getCurrentNode().afterEach(hook);
}

export function beforeWarmup(hook: HookCallback): void {
  getCurrentNode().beforeWarmup(hook);
}

export function afterWarmup(hook: HookCallback): void {
  getCurrentNode().afterWarmup(hook);
}

export function beforeBatch(hook: HookCallback): void {
  getCurrentNode().beforeBatch(hook);
}

export function afterBatch(hook: HookCallback): void {
  getCurrentNode().afterBatch(hook);
}

export function beforeIteration(hook: HookCallback): void {
  getCurrentNode().beforeIteration(hook);
}

export function afterIteration(hook: HookCallback): void {
  getCurrentNode().afterIteration(hook);
}

export function describe(name: string, callback: () => PromiseLike<void> | void): void;

export function describe(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function describe(name: string, arg1: any, arg2?: any) {
  const node = getCurrentNode();

  if (node instanceof TestSuiteNode || node instanceof DescribeNode) {
    node.appendChild(typeof arg1 === 'function' ? new DescribeNode(name, arg1) : new DescribeNode(name, arg2, arg1));
  } else {
    throw new Error('Unexpected describe() invocation');
  }
}

export function test(name: string, callback: () => PromiseLike<void> | void): void;

export function test(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function test(name: string, arg1: any, arg2?: any) {
  const node = getCurrentNode();

  if (node instanceof TestSuiteNode || node instanceof DescribeNode) {
    node.appendChild(typeof arg1 === 'function' ? new TestNode(name, arg1) : new TestNode(name, arg2, arg1));
  } else {
    throw new Error('Unexpected test() invocation');
  }
}

export function measure(callback: () => unknown): void;

export function measure(options: MeasureOptions, callback: () => unknown): void;

export function measure(arg0: any, arg1?: any): void {
  const node = getCurrentNode();

  if (node instanceof TestNode) {
    node.appendChild(typeof arg0 === 'function' ? new MeasureNode(arg0) : new MeasureNode(arg1, arg0));
  } else {
    throw new Error('Unexpected measure() invocation');
  }
}
