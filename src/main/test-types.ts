import {Awaitable} from 'parallel-universe';

export type Hook = () => Awaitable<void>;

export type MountHook = (cb: Hook) => void;

export type SyncHook = () => void;

export type MountSyncHook = (cb: SyncHook) => void;

export type Describe = (label: string, cb: () => Awaitable<void>, options?: TestOptions) => void;

export type Test = (label: string, cb: (measure: (cb: () => unknown) => Promise<void>) => Awaitable<void>, options?: TestOptions) => void;

export interface TestOptions {
  testTimeout?: number;
  targetRme?: number;
  warmupIterationCount?: number;
  batchIterationCount?: number;
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
