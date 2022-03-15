import {MeasureOptions} from './test-types';
import {Histogram} from './Histogram';
import {sleep} from './utils';

export interface MeasureLifecycleHandlers<Stats> {

  /**
   * Triggered before the warmup is started. If {@link MeasureOptions.warmupIterationCount} is 0 then there's no warmup.
   */
  onMeasureWarmupStart?(): void;

  /**
   * Triggered after the warmup was completed.
   */
  onMeasureWarmupEnd?(): void;

  /**
   * Triggered before performance measurements are collected.
   */
  onMeasureStart?(): void;

  /**
   * Triggered after measurements were collected.
   *
   * @param stats Tested callback performance statistics.
   */
  onMeasureEnd?(stats: Stats): void;

  /**
   * Triggered when an error occurred during the measured callback invocation.
   *
   * @param error The error that was thrown.
   */
  onMeasureError?(error: any): void;

  /**
   * Triggered after each iteration with the elapsed percentage of the measurement duration.
   *
   * @param percent The elapsed percentage of the measurement duration.
   */
  onMeasureProgress?(percent: number): void;
}

/**
 * Measures callback performance and stores measurements in a histogram.
 *
 * @param cb The measured callback.
 * @param handlers Callbacks that are invoked at different lifecycle phases.
 * @param options Other measurement options.
 * @param histogram The histogram to store performance measurements.
 * @returns The promise that is resolved with the results' histogram when measurements are completed.
 */
export function measureLifecycle(cb: () => unknown, handlers: MeasureLifecycleHandlers<Histogram>, options: MeasureOptions, histogram = new Histogram()): Promise<Histogram> {

  const {
    onMeasureStart,
    onMeasureEnd,
    onMeasureWarmupStart,
    onMeasureWarmupEnd,
    onMeasureError,
    onMeasureProgress,
  } = handlers;

  const {
    measureTimeout = 10_000,
    targetRme = 0.002,
    warmupIterationCount = 1,
    batchIterationCount = Infinity,
    batchTimeout = 1_000,
    batchIntermissionTimeout = 200,
    afterWarmup,
    beforeBatch,
    afterBatch,
    beforeIteration,
    afterIteration,
  } = options;

  let lifecyclePromise = Promise.resolve();

  // Warmup phase
  if (warmupIterationCount > 0) {
    lifecyclePromise = lifecyclePromise
        .then(onMeasureWarmupStart)
        .then(() => {
          for (let i = 0; i < warmupIterationCount; ++i) {
            beforeIteration?.();
            try {
              cb();
            } catch (error) {
              onMeasureError?.(error);
            }
            afterIteration?.();
          }
        })
        .then(afterWarmup)
        .then(onMeasureWarmupEnd)
        .then(() => sleep(batchIntermissionTimeout));
  }

  let i = 0; // Total iteration count

  const measureTs = Date.now();

  const nextBatch = (): Promise<void> | void => {
    const batchTs = Date.now();

    let j = 0; // Batch iteration count

    while (true) {
      beforeIteration?.();

      const iterationTs = performance.now();
      try {
        cb();
      } catch (error) {
        onMeasureError?.(error);
      }
      histogram.add(performance.now() - iterationTs);

      afterIteration?.();

      ++i;
      ++j;

      const measureDuration = Date.now() - measureTs;
      const rme = histogram.getRme();

      if (measureDuration > measureTimeout || i > 2 && targetRme >= rme) {
        onMeasureProgress?.(1);

        // Measurements completed
        return Promise.resolve().then(afterBatch);
      }

      if (i > 2) {
        onMeasureProgress?.(Math.max(measureDuration / measureTimeout, targetRme / rme));
      } else {
        onMeasureProgress?.(measureDuration / measureTimeout);
      }

      if (Date.now() - batchTs > batchTimeout || j >= batchIterationCount) {

        // Schedule the next measurement batch
        // The pause between batches is required for garbage collection
        return Promise.resolve()
            .then(afterBatch)
            .then(() => sleep(batchIntermissionTimeout))
            .then(beforeBatch)
            .then(nextBatch);
      }
    }
  };

  return lifecyclePromise
      .then(onMeasureStart)
      .then(beforeBatch)
      .then(() => onMeasureProgress?.(0))
      .then(nextBatch)
      .then(() => {
        onMeasureEnd?.(histogram);
        return histogram;
      });
}
