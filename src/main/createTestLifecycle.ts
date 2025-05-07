import { Histogram } from './Histogram.js';
import { MeasureLifecycleHandlers, RunMeasureLifecycle } from './runMeasureLifecycle.js';
import {
  Describe,
  Hook,
  Measure,
  MeasureOptions,
  Runtime,
  SyncHook,
  Test,
  TestCallback,
  TestOptions,
} from './types.js';

export interface TestLifecycleHandlers extends MeasureLifecycleHandlers {
  /**
   * Triggered before `test` block is run.
   */
  onTestStart?(): void;

  /**
   * Triggered when the `test` block is completed. Not invoked if an error occurred in test lifecycle.
   *
   * @param durationHistogram Duration statistics across all measurements.
   * @param memoryHistogram Memory statistics across all measurements.
   */
  onTestEnd?(durationHistogram: Histogram, memoryHistogram: Histogram): void;
}

export interface TestLifecycle {
  /**
   * Functions that should be exposed as global in a test script.
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
 * @param measureOptions The default measure options.
 *
 * @see {@link runMeasureLifecycle}
 */
export function createTestLifecycle(
  testPath: readonly number[],
  runMeasureLifecycle: RunMeasureLifecycle,
  handlers: TestLifecycleHandlers = {},
  measureOptions: TestOptions = {}
): TestLifecycle {
  const { onTestStart, onTestEnd } = handlers;

  let runLifecycle: () => void;
  let lifecyclePromise = new Promise<void>(resolve => {
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

  let isTestPending = false;

  measureOptions = Object.assign({}, measureOptions);

  const describe: Describe = function () {
    if (isTestPending || i >= testPath.length - 1 || j !== testPath[i]) {
      j++;
      return;
    }
    i++;
    j = 0;

    arguments[typeof arguments[1] === 'function' ? 1 : (Object.assign(measureOptions, arguments[1]), 2)]();
  };

  const test: Test = function () {
    if (isTestPending || i !== testPath.length - 1 || j !== testPath[i]) {
      j++;
      return;
    }
    i++;

    const cb: TestCallback =
      arguments[typeof arguments[1] === 'function' ? 1 : (Object.assign(measureOptions, arguments[1]), 2)];

    // Histograms that reflect population across all measurements
    const testDurationHistogram = new Histogram();
    const testMemoryHistogram = new Histogram();

    lifecyclePromise = lifecyclePromise.then(() => {
      isTestPending = true;
      onTestStart?.();
      return callHooks(beforeEachHooks);
    });

    lifecyclePromise = lifecyclePromise.then(() => {
      // Measure invocations must be sequential
      let measureLifecyclePromise = Promise.resolve();

      const measure: Measure = function () {
        let options: MeasureOptions | undefined;

        const cb: () => void = arguments[typeof arguments[0] === 'function' ? 0 : ((options = arguments[0]), 1)];

        return (measureLifecyclePromise = measureLifecyclePromise
          .then(() => {
            options = Object.assign({}, measureOptions, options);

            options.afterWarmup = combineHooks(afterWarmupHooks, options.afterWarmup);
            options.beforeBatch = combineHooks(beforeBatchHooks, options.beforeBatch);
            options.afterBatch = combineHooks(afterBatchHooks, options.afterBatch);
            options.beforeIteration = combineSyncHooks(beforeIterationHooks, options.beforeIteration);
            options.afterIteration = combineSyncHooks(afterIterationHooks, options.afterIteration);

            return runMeasureLifecycle(cb, handlers, options);
          })
          .then(result => {
            testDurationHistogram.add(result.durationHistogram);
            testMemoryHistogram.add(result.memoryHistogram);
          }));
      };

      // Always wait for measure calls to resolve
      return Promise.resolve(cb(measure)).then(() => measureLifecyclePromise);
    });

    lifecyclePromise = lifecyclePromise
      .then(() => callHooks(afterEachHooks))
      .then(() => {
        onTestEnd?.(testDurationHistogram, testMemoryHistogram);
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
  if (hooks === undefined) {
    return;
  }

  let promise = Promise.resolve();

  for (const hook of hooks) {
    promise = promise.then(hook);
  }
  return promise;
}

function combineHooks(hooks: Hook[] | undefined, hook: Hook | undefined): Hook | undefined {
  if (hooks === undefined && hook === undefined) {
    return;
  }
  return () => Promise.resolve(callHooks(hooks)).then(hook);
}

function combineSyncHooks(hooks: SyncHook[] | undefined, hook: SyncHook | undefined): SyncHook | undefined {
  if (hooks === undefined) {
    return hook;
  }
  return () => {
    for (const hook of hooks) {
      hook();
    }
    hook?.();
  };
}
