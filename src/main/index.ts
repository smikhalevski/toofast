import { appendNode, getCurrentNode, type HookType, type Node } from './runner.ts';
import { assert, isObject, isString } from './utils.ts';

/**
 * Options of a measure. A measure warms up the callback, and then runs batches with a pause between them. A batch runs
 * loops, and a loop runs iterations back to back and times them with a single pair of timer reads. An iteration is a
 * single call of the measured callback.
 */
export interface TestOptions {
  /**
   * The maximum measure duration in milliseconds. Doesn't include warmup.
   *
   * @default 10_000
   */
  measureTimeout?: number;

  /**
   * The relative margin of error [0, 1] of mean iteration durations of batches that stops the measure before
   * {@link measureTimeout}.
   *
   * @default 0.05
   */
  targetRme?: number;

  /**
   * The number of batches that a measure runs before {@link targetRme} can stop it. A few batches can agree by chance
   * while CPU frequency or scheduling is changing. {@link measureTimeout} can still end the measure with fewer batches.
   *
   * @default 5
   */
  minBatchCount?: number;

  /**
   * The maximum number of iterations in the warmup batch. V8 optimizes a function after it was called several thousand
   * times. The warmup batch is also limited by {@link batchTimeout} and {@link maxBatchIterationCount}. Set to 0 to
   * disable warmup.
   *
   * @default 10_000
   */
  maxWarmupBatchIterationCount?: number;

  /**
   * The maximum number of iterations in a batch, including iterations that sample memory and calibrate the duration of
   * a loop.
   *
   * @default Infinity
   */
  maxBatchIterationCount?: number;

  /**
   * The maximum duration of a batch in milliseconds. A batch times at least one loop.
   *
   * @default 1_000
   */
  batchTimeout?: number;

  /**
   * The pause after each batch in milliseconds. VM is expected to run garbage collector during the pause.
   *
   * @default 200
   */
  batchPauseDuration?: number;

  /**
   * The minimum duration of a loop in milliseconds, so timer resolution and overhead don't distort results of fast
   * callbacks. Loops have a single iteration if there are iteration hooks, and are shorter if
   * {@link maxBatchIterationCount} doesn't allow longer loops.
   *
   * @default 1
   */
  minLoopDuration?: number;

  /**
   * The maximum number of memory samples in a batch. A memory sample is an iteration after a loop, which allocations
   * are measured instead of its duration. Set to 0 to disable memory measurement.
   *
   * @default 10
   */
  maxBatchMemorySampleCount?: number;
}

/**
 * Test options and hooks of a measure. If {@link beforeIteration} or {@link afterIteration} hooks are provided, or
 * registered on an enclosing block, they are called around every iteration, so a loop has a single iteration.
 */
export interface MeasureOptions extends TestOptions {
  beforeWarmup?: HookCallback;
  afterWarmup?: HookCallback;
  beforeBatch?: HookCallback;
  afterBatch?: HookCallback;
  beforeIteration?: HookCallback;
  afterIteration?: HookCallback;
}

export type HookCallback = () => PromiseLike<void> | void;

export function beforeEach(hook: HookCallback): void {
  addTestHook('beforeEach', 'before_each', hook);
}

export function afterEach(hook: HookCallback): void {
  addTestHook('afterEach', 'after_each', hook);
}

export function beforeWarmup(hook: HookCallback): void {
  addMeasureHook('beforeWarmup', 'before_warmup', hook);
}

export function afterWarmup(hook: HookCallback): void {
  addMeasureHook('afterWarmup', 'after_warmup', hook);
}

export function beforeBatch(hook: HookCallback): void {
  addMeasureHook('beforeBatch', 'before_batch', hook);
}

export function afterBatch(hook: HookCallback): void {
  addMeasureHook('afterBatch', 'after_batch', hook);
}

export function beforeIteration(hook: HookCallback): void {
  addMeasureHook('beforeIteration', 'before_iteration', hook);
}

export function afterIteration(hook: HookCallback): void {
  addMeasureHook('afterIteration', 'after_iteration', hook);
}

export function describe(name: string, callback: () => PromiseLike<void> | void): void;

export function describe(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function describe(name: string, arg1: unknown, arg2?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test_suite' && parent.kind !== 'describe') {
    throw new Error('Unexpected describe() invocation');
  }

  const { options, callback } = parseBlockArgs(name, arg1, arg2);

  appendNode(parent, {
    kind: 'describe',
    name,
    testOptions: options as TestOptions,
    callback,
  });
}

export function test(name: string, callback: () => PromiseLike<void> | void): void;

export function test(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function test(name: string, arg1: unknown, arg2?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test_suite' && parent.kind !== 'describe') {
    throw new Error('Unexpected test() invocation');
  }

  const { options, callback } = parseBlockArgs(name, arg1, arg2);

  appendNode(parent, {
    kind: 'test',
    name,
    testOptions: options as TestOptions,
    callback,
  });
}

export function measure(callback: () => unknown): void;

export function measure(options: MeasureOptions, callback: () => unknown): void;

export function measure(arg0: unknown, arg1?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test') {
    throw new Error('Unexpected measure() invocation');
  }

  const { options, callback } = parseBlockArgs('', arg0, arg1);

  const { beforeWarmup, afterWarmup, beforeBatch, afterBatch, beforeIteration, afterIteration, ...testOptions } =
    options as MeasureOptions;

  const node = appendNode(parent, {
    kind: 'measure',
    name: '',
    testOptions,
    callback,
  });

  addHook(node, 'before_warmup', beforeWarmup);
  addHook(node, 'after_warmup', afterWarmup);
  addHook(node, 'before_batch', beforeBatch);
  addHook(node, 'after_batch', afterBatch);
  addHook(node, 'before_iteration', beforeIteration);
  addHook(node, 'after_iteration', afterIteration);
}

/**
 * Validates arguments of a block declaration, where options are optional and precede the callback.
 */
function parseBlockArgs(name: unknown, arg0: any, arg1: any): { options: object; callback: () => unknown } {
  assert(isString(name), 'name must be a string');

  if (typeof arg0 === 'function') {
    assert(arg1 === undefined, 'options must precede the callback');

    return { options: {}, callback: arg0 };
  }

  assert(isObject(arg0), 'options must be an object');
  assert(typeof arg1 === 'function', 'callback must be a function');

  return { options: arg0, callback: arg1 };
}

/**
 * Adds a hook that runs around a test to the current test suite or describe block. Throws inside a test, since the test
 * has already started when its callback is called.
 */
function addTestHook(functionName: string, type: HookType, callback: HookCallback): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test_suite' && parent.kind !== 'describe') {
    throw new Error('Unexpected ' + functionName + '() invocation');
  }
  addHook(parent, type, callback);
}

/**
 * Adds a hook that runs around a measure to the current test suite, describe block or test. Throws while a measure
 * runs.
 */
function addMeasureHook(functionName: string, type: HookType, callback: HookCallback): void {
  const parent = getCurrentNode();

  if (parent.kind === 'measure') {
    throw new Error('Unexpected ' + functionName + '() invocation');
  }
  addHook(parent, type, callback);
}

/**
 * Adds a hook to the node, unless the callback is undefined.
 */
function addHook(node: Node, type: HookType, callback: HookCallback | undefined): void {
  if (callback === undefined) {
    return;
  }

  assert(typeof callback === 'function', 'hook must be a function');

  node.hooks.push({ type, callback });
}
