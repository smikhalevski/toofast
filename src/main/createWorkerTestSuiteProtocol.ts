import {Hook, MeasureOptions, SyncHook, TestProtocol} from './test-types';

export interface WorkerTestSuiteProtocolOptions {
  testPath: number[];

  measure(cb: () => unknown, options: MeasureOptions): Promise<void>;
}

export function createWorkerTestSuiteProtocol(options: WorkerTestSuiteProtocolOptions) {
  const {
    testPath,
    measure,
  } = options;

  let run!: () => void;
  let testPromise = new Promise<void>((resolve) => {
    run = resolve;
  });

  let j = 0;
  let i = 0;

  let beforeEachHooks: Hook[];
  let afterEachHooks: Hook[];
  let afterWarmupHooks: Hook[];
  let beforeBatchHooks: Hook[];
  let afterBatchHooks: Hook[];
  let beforeIterationHooks: SyncHook[];
  let afterIterationHooks: SyncHook[];

  const measureOptions: MeasureOptions = {};

  const testProtocol: TestProtocol = {

    beforeEach(cb) {
      (beforeEachHooks ||= []).push(cb);
    },
    afterEach(cb) {
      (afterEachHooks ||= []).push(cb);
    },
    afterWarmup(cb) {
      (afterWarmupHooks ||= []).push(cb);
    },
    beforeBatch(cb) {
      (beforeBatchHooks ||= []).push(cb);
    },
    afterBatch(cb) {
      (afterBatchHooks ||= []).push(cb);
    },
    beforeIteration(cb) {
      (beforeIterationHooks ||= []).push(cb);
    },
    afterIteration(cb) {
      (afterIterationHooks ||= []).push(cb);
    },

    describe(label, cb, options) {
      if (i === testPath.length - 1 || j++ !== testPath[i]) {
        return;
      }
      i++;
      j = 0;

      Object.assign(measureOptions, options);
      cb();
    },

    test(label, cb, options) {
      if (i !== testPath.length - 1 || j++ !== testPath[i]) {
        return;
      }
      j = -1;

      Object.assign(measureOptions, options);

      measureOptions.afterWarmup = afterWarmupHooks ? () => callHooks(afterWarmupHooks) : undefined;
      measureOptions.beforeBatch = beforeBatchHooks ? () => callHooks(beforeBatchHooks) : undefined;
      measureOptions.afterBatch = afterBatchHooks ? () => callHooks(afterBatchHooks) : undefined;
      measureOptions.beforeIteration = beforeIterationHooks ? () => callSyncHooks(beforeIterationHooks) : undefined;
      measureOptions.afterIteration = afterIterationHooks ? () => callSyncHooks(afterIterationHooks) : undefined;

      if (beforeEachHooks) {
        testPromise = testPromise.then(() => callHooks(beforeEachHooks));
      }

      testPromise = testPromise.then(() => {
        let measurePromise = Promise.resolve();

        return Promise.resolve(cb((cb) => measurePromise = measurePromise.then(() => measure(cb, Object.assign({}, measureOptions))))).then(() => measurePromise);
      });

      if (afterEachHooks) {
        testPromise = testPromise.then(() => callHooks(afterEachHooks));
      }
    },
  };

  return {
    testProtocol,
    promise: testPromise,
    run,
  };
}

function callSyncHooks(hooks: SyncHook[]): void {
  for (const hook of hooks) {
    hook();
  }
}

function callHooks(hooks: Hook[]): Promise<void> {
  let promise = Promise.resolve();
  for (const hook of hooks) {
    promise = promise.then(hook);
  }
  return promise;
}
