import {Hook, MeasureOptions, SyncHook, TestProtocol} from './test-types';
import {Histogram} from './Histogram';
import {measure, MeasureHandlers} from './measure';

export interface WorkerHandlers extends MeasureHandlers {

  /**
   * Triggered when test is completed.
   *
   * @param histogram The histogram that represents tested callback performance statistics.
   */
  onTestComplete(histogram: Histogram): void;
}

export interface WorkerProtocolOptions {

  /**
   * Indices of describe and test DSL blocks that must be run.
   */
  testPath: number[];

  /**
   * Measures callback performance.
   */
  runMeasure: typeof measure;
}

export function createWorkerProtocol(handlers: WorkerHandlers, options: WorkerProtocolOptions) {
  const {onTestComplete} = handlers;

  const {
    testPath,
    runMeasure,
  } = options;

  let run!: () => void;
  let promise = new Promise<void>((resolve) => {
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
      if (i >= testPath.length - 1 || j++ !== testPath[i]) {
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
      i++;

      Object.assign(measureOptions, options);

      measureOptions.afterWarmup = afterWarmupHooks ? () => callHooks(afterWarmupHooks) : undefined;
      measureOptions.beforeBatch = beforeBatchHooks ? () => callHooks(beforeBatchHooks) : undefined;
      measureOptions.afterBatch = afterBatchHooks ? () => callHooks(afterBatchHooks) : undefined;
      measureOptions.beforeIteration = beforeIterationHooks ? () => callSyncHooks(beforeIterationHooks) : undefined;
      measureOptions.afterIteration = afterIterationHooks ? () => callSyncHooks(afterIterationHooks) : undefined;

      if (beforeEachHooks) {
        promise = promise.then(() => callHooks(beforeEachHooks));
      }

      promise = promise.then(() => {
        let promise = Promise.resolve();

        const histogram = new Histogram();

        const result = cb((cb) => promise = promise.then(() => {
          const cbHistogram = new Histogram();

          return runMeasure(cb, cbHistogram, handlers, Object.assign({}, measureOptions)).then(() => {
            histogram.addFromHistogram(cbHistogram);
          });
        }));

        return Promise.resolve(result).then(() => promise).then(() => {
          onTestComplete(histogram);
        });
      });

      if (afterEachHooks) {
        promise = promise.then(() => callHooks(afterEachHooks));
      }
    },
  };

  return {
    testProtocol,
    getPromise: () => promise,
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
