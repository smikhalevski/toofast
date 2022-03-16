import {Hook, MeasureOptions, SyncHook, Runtime, Measure, Test, Describe} from './test-types';
import {Histogram} from './Histogram';
import {runMeasureLifecycle, MeasureLifecycleHandlers} from './runMeasureLifecycle';

export type RunMeasureLifecycle = typeof runMeasureLifecycle;

export interface TestLifecycleHandlers extends MeasureLifecycleHandlers {

  /**
   * Triggered before `test` block is run.
   */
  onTestStart?(): void;

  /**
   * Triggered when the `test` block is completed. Not invoked if an error occurred in test lifecycle.
   *
   * @param histogram Tested callback performance statistics across all measurements.
   */
  onTestEnd?(histogram: Histogram): void;
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
 * @param runMeasureLifecycle Measures callback performance.
 * @param handlers Callbacks that are invoked at different lifecycle stages.
 *
 * @see {@link runMeasureLifecycle}
 */
export function createTestLifecycle(testPath: readonly number[], runMeasureLifecycle: RunMeasureLifecycle, handlers: TestLifecycleHandlers = {}): TestLifecycle {

  const {
    onTestStart,
    onTestEnd,
  } = handlers;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>((resolve) => {
    runLifecycle = resolve;
  });

  let i = 0;
  let j = 0;

  let beforeEachHooks: Hook[] | undefined;
  let afterEachHooks: Hook[] | undefined;
  let afterWarmupHooks: Hook[] | undefined;
  let beforeBatchHooks: Hook[] | undefined;
  let afterBatchHooks: Hook[] | undefined;
  let beforeIterationHooks: SyncHook[] | undefined;
  let afterIterationHooks: SyncHook[] | undefined;

  let testPending = false;

  const measureOptions: MeasureOptions = {};

  const describe: Describe = (label, cb, options) => {
    if (testPending || i >= testPath.length - 1 || j !== testPath[i]) {
      j++;
      return;
    }
    i++;
    j = 0;

    Object.assign(measureOptions, options);
    cb();
  };

  const test: Test = (label, cb, options) => {
    if (testPending || i !== testPath.length - 1 || j !== testPath[i]) {
      j++;
      return;
    }
    i++;

    Object.assign(measureOptions, options);

    // Histogram that reflects population across all performance measurements
    const testHistogram = new Histogram();

    lifecyclePromise = lifecyclePromise.then(() => {
      testPending = true;
      onTestStart?.();
      return callHooks(beforeEachHooks);
    });

    lifecyclePromise = lifecyclePromise.then(() => {

      // Measure invocations must be sequential
      let measureLifecyclePromise = Promise.resolve();

      const measure: Measure = (cb, options) => {

        options = Object.assign({}, measureOptions, options);

        options.afterWarmup = combineHooks(afterWarmupHooks, options.afterWarmup);
        options.beforeBatch = combineHooks(beforeBatchHooks, options.beforeBatch);
        options.afterBatch = combineHooks(afterBatchHooks, options.afterBatch);
        options.beforeIteration = combineSyncHooks(beforeIterationHooks, options.beforeIteration);
        options.afterIteration = combineSyncHooks(afterIterationHooks, options.afterIteration);

        return measureLifecyclePromise = measureLifecyclePromise
            .then(() => runMeasureLifecycle(cb, handlers, options))
            .then((histogram) => {
              testHistogram.addFromHistogram(histogram);
            });
      };

      // Always wait for measure calls to resolve
      return Promise.resolve(cb(measure)).then(() => measureLifecyclePromise);
    });

    lifecyclePromise = lifecyclePromise
        .then(() => callHooks(afterEachHooks))
        .then(() => {
          onTestEnd?.(testHistogram);
        });
  };

  const runtime: Runtime = {
    beforeEach(hook) {
      (beforeEachHooks ||= []).push(hook);
    },
    afterEach(hook) {
      (afterEachHooks ||= []).push(hook);
    },
    afterWarmup(hook) {
      (afterWarmupHooks ||= []).push(hook);
    },
    beforeBatch(hook) {
      (beforeBatchHooks ||= []).push(hook);
    },
    afterBatch(hook) {
      (afterBatchHooks ||= []).push(hook);
    },
    beforeIteration(hook) {
      (beforeIterationHooks ||= []).push(hook);
    },
    afterIteration(hook) {
      (afterIterationHooks ||= []).push(hook);
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

function callHooks(hooks: Hook[] | undefined): Promise<void> | undefined {
  if (hooks) {
    let promise = Promise.resolve();

    for (const hook of hooks) {
      promise = promise.then(hook);
    }
    return promise;
  }
}

function combineHooks(hooks: Hook[] | undefined, hook: Hook | undefined): Hook | undefined {
  if (hooks || hook) {
    return () => Promise.resolve(callHooks(hooks)).then(hook);
  }
}

function combineSyncHooks(hooks: SyncHook[] | undefined, hook: SyncHook | undefined): SyncHook | undefined {
  if (hooks || hook) {
    return () => {
      if (hooks) {
        for (const hook of hooks) {
          hook();
        }
      }
      hook?.();
    };
  }
}
