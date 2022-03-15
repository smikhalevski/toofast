export type Hook = () => PromiseLike<void> | void;

export type MountHook = (hook: Hook) => void;

export type SyncHook = () => void;

export type MountSyncHook = (hook: SyncHook) => void;

export type Describe = (label: string, cb: () => void, options?: TestOptions) => void;

export type Measure = (cb: () => unknown) => Promise<void>;

export type Test = (label: string, cb: (measure: Measure) => PromiseLike<void> | void, options?: TestOptions) => void;

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
export interface Protocol {
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
