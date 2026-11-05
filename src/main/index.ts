import { appendChild, getCurrentNode, type HookType, type Node } from './runner.ts';
import { assert, isObject, isString } from './utils.ts';

/**
 * Options that control how measures run. Set them in the config file, or pass them to {@link describe}, {@link test}
 * and {@link measure}. Nested blocks inherit options from enclosing blocks and can override them.
 *
 * A measure first warms up the callback. Then it runs batches of calls with a pause after each batch. A batch calls
 * the callback in loops, and times each loop as a whole. The mean duration of a call in a batch is one sample, and the
 * measure stops when samples agree within {@link targetRme}, or when {@link measureTimeout} is reached.
 */
export interface TestOptions {
  /**
   * The maximum duration of a measure in milliseconds, not counting warmup. When it's reached, the measure stops even
   * if {@link targetRme} isn't reached yet.
   *
   * @default 10_000
   */
  measureTimeout?: number;

  /**
   * The relative margin of error at which the measure stops, between `0` and `1`. For example, `0.05` stops the measure
   * when the mean call duration is known within ±5% at 95% confidence.
   *
   * @default 0.05
   */
  targetRme?: number;

  /**
   * The minimum number of batches before {@link targetRme} can stop the measure. A few batches may agree by chance, for
   * example, while the CPU is changing its frequency. {@link measureTimeout} still stops the measure if it's reached
   * first.
   *
   * @default 5
   */
  minBatchCount?: number;

  /**
   * The maximum number of calls during warmup. V8 optimizes a function after it has been called many times, so warmup
   * keeps slow unoptimized calls out of the results. Warmup is also limited by {@link batchTimeout} and
   * {@link maxBatchIterationCount}.
   *
   * Set to `0` to skip warmup.
   *
   * @default 10_000
   */
  maxWarmupBatchIterationCount?: number;

  /**
   * The maximum number of calls in a batch, including untimed calls that measure memory and calibrate loops. Set it if
   * {@link beforeBatch} prepares data for a limited number of calls.
   *
   * @default Infinity
   */
  maxBatchIterationCount?: number;

  /**
   * The maximum duration of a batch in milliseconds. A batch always times at least one loop, even if that loop takes
   * longer.
   *
   * @default 1_000
   */
  batchTimeout?: number;

  /**
   * The pause after each batch in milliseconds. It gives the garbage collector time to run between batches instead of
   * during them.
   *
   * @default 200
   */
  batchPauseDuration?: number;

  /**
   * The minimum duration of a timed loop in milliseconds. A fast callback is called many times in a loop that is timed
   * as a whole, so the overhead and resolution of the timer don't distort results.
   *
   * Loops are shorter if {@link maxBatchIterationCount} is too small, and have a single call if there are
   * {@link beforeIteration} or {@link afterIteration} hooks.
   *
   * @default 1
   */
  minLoopDuration?: number;

  /**
   * The maximum number of memory samples in a batch. A memory sample is an extra call after a loop, which measures how
   * many bytes the callback allocates instead of how long it takes.
   *
   * Set to `0` to skip measuring memory.
   *
   * @default 10
   */
  maxBatchMemorySampleCount?: number;
}

/**
 * Options of a single {@link measure}: {@link TestOptions} and hooks that run only for this measure.
 */
export interface MeasureOptions extends TestOptions {
  /**
   * Runs before warmup, like {@link beforeWarmup}.
   */
  beforeWarmup?: HookCallback;

  /**
   * Runs after warmup, like {@link afterWarmup}.
   */
  afterWarmup?: HookCallback;

  /**
   * Runs before each batch, like {@link beforeBatch}.
   */
  beforeBatch?: HookCallback;

  /**
   * Runs after each batch, like {@link afterBatch}.
   */
  afterBatch?: HookCallback;

  /**
   * Runs before each call of the measured callback, like {@link beforeIteration}.
   */
  beforeIteration?: HookCallback;

  /**
   * Runs after each call of the measured callback, like {@link afterIteration}.
   */
  afterIteration?: HookCallback;
}

/**
 * A hook. If it returns a promise, the test waits for the promise before it goes on.
 */
export type HookCallback = () => PromiseLike<void> | void;

/**
 * Registers a hook that runs before each test in the test file or the {@link describe} block where it's called,
 * including tests in nested blocks. Hooks of outer blocks run first.
 *
 * Can't be called inside a {@link test}, since the test has already started by then.
 *
 * @example
 * beforeEach(() => {
 *   cache.clear();
 * });
 */
export function beforeEach(hook: HookCallback): void {
  addTestHook('beforeEach', 'before_each', hook);
}

/**
 * Registers a hook that runs after each test in the test file or the {@link describe} block where it's called,
 * including tests in nested blocks. Runs even if the test has thrown. Hooks of inner blocks run first.
 *
 * Can't be called inside a {@link test}, since the test has already started by then.
 */
export function afterEach(hook: HookCallback): void {
  addTestHook('afterEach', 'after_each', hook);
}

/**
 * Registers a hook that runs before warmup of each measure in the test file, {@link describe} block or {@link test}
 * where it's called.
 */
export function beforeWarmup(hook: HookCallback): void {
  addMeasureHook('beforeWarmup', 'before_warmup', hook);
}

/**
 * Registers a hook that runs after warmup of each measure in the test file, {@link describe} block or {@link test}
 * where it's called. Doesn't run if the measured callback has thrown during warmup.
 */
export function afterWarmup(hook: HookCallback): void {
  addMeasureHook('afterWarmup', 'after_warmup', hook);
}

/**
 * Registers a hook that runs before each batch of each measure in the test file, {@link describe} block or
 * {@link test} where it's called. Warmup is a batch too.
 *
 * @example
 * let values: number[] = [];
 *
 * beforeBatch(() => {
 *   values = createValues();
 * });
 */
export function beforeBatch(hook: HookCallback): void {
  addMeasureHook('beforeBatch', 'before_batch', hook);
}

/**
 * Registers a hook that runs after each batch of each measure in the test file, {@link describe} block or
 * {@link test} where it's called. Runs even if the measured callback has thrown.
 */
export function afterBatch(hook: HookCallback): void {
  addMeasureHook('afterBatch', 'after_batch', hook);
}

/**
 * Registers a hook that runs before each call of the measured callback, in each measure in the test file,
 * {@link describe} block or {@link test} where it's called.
 *
 * With iteration hooks, each timed loop has a single call, so the overhead of the timer is added to the results. Use
 * {@link beforeBatch} instead if it's enough.
 */
export function beforeIteration(hook: HookCallback): void {
  addMeasureHook('beforeIteration', 'before_iteration', hook);
}

/**
 * Registers a hook that runs after each call of the measured callback, in each measure in the test file,
 * {@link describe} block or {@link test} where it's called.
 *
 * With iteration hooks, each timed loop has a single call, so the overhead of the timer is added to the results. Use
 * {@link afterBatch} instead if it's enough.
 */
export function afterIteration(hook: HookCallback): void {
  addMeasureHook('afterIteration', 'after_iteration', hook);
}

/**
 * Declares a describe block, which groups tests. Describe blocks can be nested.
 *
 * @param name The name of the describe block. Test name patterns match names of its tests prefixed with it, for
 * example, `factorial.of 42`.
 * @param callback Declares tests, nested describe blocks and hooks. Can be async.
 * @example
 * describe('factorial', () => {
 *   test('of 42', () => {
 *     measure(() => factorial(42));
 *   });
 * });
 */
export function describe(name: string, callback: () => PromiseLike<void> | void): void;

/**
 * Declares a describe block with options that apply to all of its tests. Describe blocks can be nested.
 *
 * @param name The name of the describe block. Test name patterns match names of its tests prefixed with it, for
 * example, `factorial.of 42`.
 * @param options Test options of all tests in the describe block.
 * @param callback Declares tests, nested describe blocks and hooks. Can be async.
 */
export function describe(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function describe(name: string, arg1: unknown, arg2?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test_suite' && parent.kind !== 'describe') {
    throw new Error('Unexpected describe() invocation');
  }

  const { options, callback } = parseBlockArgs(name, arg1, arg2);

  appendChild(parent, {
    kind: 'describe',
    name,
    testOptions: options as TestOptions,
    callback,
  });
}

/**
 * Declares a test. Each test runs in a separate process, so tests don't affect each other's results. The result of a
 * test combines the results of all measures declared in it.
 *
 * @param name The name of the test.
 * @param callback Declares measures and hooks of the test. Can be async, for example, to load data for measures.
 * @example
 * test('factorial of 42', () => {
 *   measure(() => factorial(42));
 * });
 */
export function test(name: string, callback: () => PromiseLike<void> | void): void;

/**
 * Declares a test with options that apply to all of its measures. Each test runs in a separate process, so tests
 * don't affect each other's results.
 *
 * @param name The name of the test.
 * @param options Test options of all measures in the test.
 * @param callback Declares measures and hooks of the test. Can be async, for example, to load data for measures.
 */
export function test(name: string, options: TestOptions, callback: () => PromiseLike<void> | void): void;

export function test(name: string, arg1: unknown, arg2?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test_suite' && parent.kind !== 'describe') {
    throw new Error('Unexpected test() invocation');
  }

  const { options, callback } = parseBlockArgs(name, arg1, arg2);

  appendChild(parent, {
    kind: 'test',
    name,
    testOptions: options as TestOptions,
    callback,
  });
}

/**
 * Declares a measure of the callback's performance. Must be called inside a {@link test}.
 *
 * Measures run one by one after the test callback has returned, so hooks that the test registers after the measure
 * apply to it too.
 *
 * @param callback The code to measure. Can be async: if the first call returns a promise, each call starts after the
 * promise of the previous call has settled. Otherwise, the callback must not return a promise.
 * @example
 * test('factorial of 42', () => {
 *   measure(() => factorial(42));
 * });
 */
export function measure(callback: () => unknown): void;

/**
 * Declares a measure of the callback's performance, with options and hooks of its own. Must be called inside a
 * {@link test}.
 *
 * @param options Test options and hooks of the measure.
 * @param callback The code to measure. Can be async: if the first call returns a promise, each call starts after the
 * promise of the previous call has settled. Otherwise, the callback must not return a promise.
 * @example
 * test('sort', () => {
 *   let values: number[] = [];
 *
 *   measure(
 *     {
 *       // Each call sorts a new copy
 *       beforeIteration() {
 *         values = randomValues.slice();
 *       },
 *     },
 *     () => values.sort((a, b) => a - b)
 *   );
 * });
 */
export function measure(options: MeasureOptions, callback: () => unknown): void;

export function measure(arg0: unknown, arg1?: unknown): void {
  const parent = getCurrentNode();

  if (parent.kind !== 'test') {
    throw new Error('Unexpected measure() invocation');
  }

  const { options, callback } = parseBlockArgs('', arg0, arg1);

  const { beforeWarmup, afterWarmup, beforeBatch, afterBatch, beforeIteration, afterIteration, ...testOptions } =
    options as MeasureOptions;

  const node = appendChild(parent, {
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
 * Validates the arguments of a block declaration, where options are optional and come before the callback.
 */
function parseBlockArgs(name: unknown, arg0: any, arg1: any): { options: object; callback: () => unknown } {
  assert(isString(name), 'Name must be a string');

  if (typeof arg0 === 'function') {
    assert(arg1 === undefined, 'Options must precede the callback');

    return { options: {}, callback: arg0 };
  }

  assert(isObject(arg0), 'Options must be an object');
  assert(typeof arg1 === 'function', 'Callback must be a function');

  return { options: arg0, callback: arg1 };
}

/**
 * Adds a hook that runs around tests to the current test suite or describe block. Throws inside a test, since the test
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
 * Adds a hook that runs around measures to the current test suite, describe block or test. Throws while a measure
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
 * Adds a hook to the node, unless the callback is `undefined`.
 */
function addHook(node: Node, type: HookType, callback: HookCallback | undefined): void {
  if (callback === undefined) {
    return;
  }

  assert(typeof callback === 'function', 'Hook must be a function');

  node.hooks.push({ type, callback });
}
