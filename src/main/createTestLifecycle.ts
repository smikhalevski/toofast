import { Histogram } from './Histogram.js';
import { MeasureLifecycleHandlers, MeasureLifecycleOptions, MeasureResult } from './runMeasureLifecycle.js';
import { Describe, Hook, Measure, MeasureOptions, Runtime, Test, TestCallback, TestOptions } from './types.js';
import { callHooks, combineHooks } from './utils.js';

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

export interface TestLifecycleOptions {
  /**
   * Measures callback performance.
   */
  runMeasureLifecycle: (options: MeasureLifecycleOptions) => Promise<MeasureResult>;

  /**
   * Indices of describe and test DSL blocks that must be run.
   */
  testLocation: readonly number[];

  /**
   * The default measure options.
   */
  testOptions?: TestOptions;

  /**
   * Callbacks that are invoked at different lifecycle stages.
   */
  handlers?: TestLifecycleHandlers;
}

/**
 * Creates a test lifecycle that executes a single test.
 */
export function createTestLifecycle(options: TestLifecycleOptions): TestLifecycle {
  const { runMeasureLifecycle, testLocation, handlers = {} } = options;

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
  let beforeIterationHooks: Hook[] | undefined;
  let afterIterationHooks: Hook[] | undefined;

  // Prevent describe() and test() calls inside a test
  let isTestFound = false;
  let testOptions = options.testOptions;

  const describe: Describe = function () {
    if (isTestFound || i >= testLocation.length || j !== testLocation[i]) {
      j++;
      return;
    }

    i++;
    j = 0;

    if (typeof arguments[1] === 'function') {
      arguments[1]();
    } else {
      testOptions = { ...testOptions, ...arguments[1] };
      arguments[2]();
    }
  };

  const test: Test = function () {
    if (isTestFound || i >= testLocation.length || j !== testLocation[i]) {
      j++;
      return;
    }

    isTestFound = true;

    let testCallback: TestCallback = arguments[1];

    if (typeof testCallback !== 'function') {
      testOptions = { ...testOptions, ...arguments[1] };
      testCallback = arguments[2];
    }

    // Histograms that reflect population across all measurements
    const durationHistogram = new Histogram();
    const memoryHistogram = new Histogram();

    lifecyclePromise = lifecyclePromise.then(async () => {
      onTestStart?.();

      await callHooks(beforeEachHooks);

      // Measure invocations are sequential
      let measurePromise = Promise.resolve();

      const measure: Measure = function () {
        let measureOptions: MeasureOptions | undefined;
        let callback: () => void = arguments[0];

        if (typeof callback !== 'function') {
          measureOptions = arguments[0];
          callback = arguments[1];
        }

        measurePromise = measurePromise.then(async () => {
          measureOptions = { ...testOptions, ...measureOptions };

          measureOptions.afterWarmup = combineHooks(afterWarmupHooks, measureOptions.afterWarmup);
          measureOptions.beforeBatch = combineHooks(beforeBatchHooks, measureOptions.beforeBatch);
          measureOptions.afterBatch = combineHooks(afterBatchHooks, measureOptions.afterBatch);
          measureOptions.beforeIteration = combineHooks(beforeIterationHooks, measureOptions.beforeIteration);
          measureOptions.afterIteration = combineHooks(afterIterationHooks, measureOptions.afterIteration);

          const result = await runMeasureLifecycle({ callback, handlers, measureOptions });

          durationHistogram.add(result.durationHistogram);
          memoryHistogram.add(result.memoryHistogram);
        });

        return measurePromise;
      };

      await testCallback(measure);

      // Await the completion of all measures
      await measurePromise;

      await callHooks(afterEachHooks);

      onTestEnd?.(durationHistogram, memoryHistogram);
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
