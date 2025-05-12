export type Hook = () => PromiseLike<void> | void;

export type RegisterHook = (hook: Hook) => void;

export interface Describe {
  (name: string, cb: () => void): void;

  (name: string, options: TestOptions, cb: () => void): void;
}

export interface Test {
  (name: string, cb: TestCallback): void;

  (name: string, options: TestOptions, cb: TestCallback): void;
}

export type TestCallback = (measure: Measure) => PromiseLike<void> | void;

export interface Measure {
  (cb: () => unknown): Promise<void>;

  (options: MeasureOptions, cb: () => unknown): Promise<void>;
}

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
  afterWarmup?: Hook;
  beforeBatch?: Hook;
  afterBatch?: Hook;
  beforeIteration?: Hook;
  afterIteration?: Hook;
}

/**
 * Functions that are exposed in a test script.
 */
export interface Runtime {
  beforeEach: RegisterHook;
  afterEach: RegisterHook;
  afterWarmup: RegisterHook;
  beforeBatch: RegisterHook;
  afterBatch: RegisterHook;
  beforeIteration: RegisterHook;
  afterIteration: RegisterHook;
  describe: Describe;
  test: Test;
}

declare const beforeEach: RegisterHook;
declare const afterEach: RegisterHook;
declare const afterWarmup: RegisterHook;
declare const beforeBatch: RegisterHook;
declare const afterBatch: RegisterHook;
declare const beforeIteration: RegisterHook;
declare const afterIteration: RegisterHook;
declare const describe: Describe;
declare const test: Test;
