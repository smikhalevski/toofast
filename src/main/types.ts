export type Hook = () => PromiseLike<void> | void;

export type MountHook = (hook: Hook) => void;

export type SyncHook = () => void;

export type MountSyncHook = (hook: SyncHook) => void;

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
  beforeIteration?: SyncHook;
  afterIteration?: SyncHook;
}

/**
 * Functions that are exposed in a test script.
 */
export interface Runtime {
  beforeEach: MountHook;
  afterEach: MountHook;
  afterWarmup: MountHook;
  beforeBatch: MountHook;
  afterBatch: MountHook;
  beforeIteration: MountSyncHook;
  afterIteration: MountSyncHook;
  describe: Describe;
  test: Test;
}

declare const beforeEach: MountHook;
declare const afterEach: MountHook;
declare const afterWarmup: MountHook;
declare const beforeBatch: MountHook;
declare const afterBatch: MountHook;
declare const beforeIteration: MountSyncHook;
declare const afterIteration: MountSyncHook;
declare const describe: Describe;
declare const test: Test;
