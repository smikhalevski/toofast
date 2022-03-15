import {Hook, MeasureOptions, SyncHook, Runtime, Measure, Test, Describe} from './test-types';
import {Histogram} from './Histogram';
import {measureLifecycle, MeasureLifecycleHandlers} from './measureLifecycle';

export type MeasureLifecycle = typeof measureLifecycle;

export interface TestLifecycleHandlers extends MeasureLifecycleHandlers {

  /**
   * Triggered before test is started.
   */
  onTestStart(): void;

  /**
   * Triggered when the test is completed. Not invoked if an error occurred in test lifecycle.
   *
   * @param histogram Tested callback performance statistics across all measurements.
   */
  onTestEnd(histogram: Histogram): void;
}

export interface TestLifecycle {

  /**
   * Functions that should be exposed in a test script.
   */
  runtime: Runtime;

  /**
   * Starts the test lifecycle execution.
   *
   * @returns The promise that resolves when the test lifecycle is completed.
   */
  run(): Promise<void>;
}

/**
 * Creates a test protocol that executes a particular test.
 *
 * @param testPath Indices of describe and test DSL blocks that must be run.
 * @param measureLifecycle Measures callback performance.
 * @param handlers Callbacks that are invoked at different lifecycle stages.
 *
 * @see {@link measureLifecycle}
 */
export function createTestLifecycle(testPath: readonly number[], measureLifecycle: MeasureLifecycle, handlers: TestLifecycleHandlers): TestLifecycle {

  const {
    onTestStart,
    onTestEnd,
  } = handlers;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>((resolve) => {
    runLifecycle = resolve;
  });

  let i = 0; // testPath index
  let j = 0; // testPath[i] index

  let beforeEachHooks: Hook[] = [];
  let afterEachHooks: Hook[] = [];
  let afterWarmupHooks: Hook[] = [];
  let beforeBatchHooks: Hook[] = [];
  let afterBatchHooks: Hook[] = [];
  let beforeIterationHooks: SyncHook[] = [];
  let afterIterationHooks: SyncHook[] = [];

  let testPending = false;

  const measureOptions: MeasureOptions = {};

  const describe: Describe = (label, cb, options) => {
    if (testPending || i >= testPath.length - 1 || j++ !== testPath[i]) {
      return;
    }
    i++;
    j = 0;

    Object.assign(measureOptions, options);
    cb();
  };

  const test: Test = (label, cb, options) => {
    if (testPending || i !== testPath.length - 1 || j++ !== testPath[i]) {
      return;
    }
    i++;

    Object.assign(measureOptions, options);

    // Histogram that reflects population across all performance measurements
    const testHistogram = new Histogram();

    lifecyclePromise = lifecyclePromise.then(() => {
      testPending = true;
      onTestStart();
      return callHooks(beforeEachHooks);
    });

    lifecyclePromise = lifecyclePromise.then(() => {

      measureOptions.afterWarmup = () => callHooks(afterWarmupHooks);
      measureOptions.beforeBatch = () => callHooks(beforeBatchHooks);
      measureOptions.afterBatch = () => callHooks(afterBatchHooks);
      measureOptions.beforeIteration = () => {
        callSyncHooks(beforeIterationHooks);
      };
      measureOptions.afterIteration = () => {
        callSyncHooks(afterIterationHooks);
      };

      // Measure invocations forced to be sequential
      let measurePromise = Promise.resolve();

      const measure: Measure = (cb) => measurePromise = measurePromise
          .then(() => measureLifecycle(cb, handlers, Object.assign({}, measureOptions)))
          .then((histogram) => {
            testHistogram.addFromHistogram(histogram);
          });

      // Always wait for measure calls to resolve
      return Promise.resolve(cb(measure)).then(() => measurePromise);
    });

    lifecyclePromise = lifecyclePromise
        .then(() => callHooks(afterEachHooks))
        .then(() => {
          onTestEnd(testHistogram);
        });
  };

  const runtime: Runtime = {
    beforeEach(hook) {
      beforeEachHooks.push(hook);
    },
    afterEach(hook) {
      afterEachHooks.push(hook);
    },
    afterWarmup(hook) {
      afterWarmupHooks.push(hook);
    },
    beforeBatch(hook) {
      beforeBatchHooks.push(hook);
    },
    afterBatch(hook) {
      afterBatchHooks.push(hook);
    },
    beforeIteration(hook) {
      beforeIterationHooks.push(hook);
    },
    afterIteration(hook) {
      afterIterationHooks.push(hook);
    },
    describe,
    test,
  };

  return {
    runtime,
    run() {
      runLifecycle();
      return lifecyclePromise;
    },
  };
}

function callHooks(hooks: Hook[]): Promise<void> | void {
  if (hooks.length === 0) {
    return;
  }
  let promise = Promise.resolve();

  for (const hook of hooks) {
    promise = promise.then(hook);
  }
  return promise;
}

function callSyncHooks(hooks: SyncHook[]): void {
  for (const hook of hooks) {
    hook();
  }
}
