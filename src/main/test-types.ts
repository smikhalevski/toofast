import {Awaitable} from 'parallel-universe';

export type Hook = () => Awaitable<void>;

export type MountHook = (cb: Hook) => void;

export type SyncHook = () => void;

export type MountSyncHook = (cb: SyncHook) => void;

export type Describe = (label: string, cb: () => Awaitable<void>, options?: TestOptions) => void;

export type Test = (label: string, cb: (measure: (cb: () => unknown) => Promise<void>) => Awaitable<void>, options?: TestOptions) => void;

export interface TestOptions {

  /**
   * Maximum measure duration. Doesn't include the duration of warmup iterations.
   *
   * @default 5000
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
   * The maximum batch duration.
   *
   * @default 1_000
   */
  batchTimeout?: number;
}

export interface MeasureOptions extends TestOptions {
  afterWarmup?: Hook;
  beforeBatch?: Hook;
  afterBatch?: Hook;
  beforeIteration?: SyncHook;
  afterIteration?: SyncHook;
}

export interface TestProtocol {
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
