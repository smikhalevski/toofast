import {Histogram} from './Histogram';
import {MeasureOptions} from './test-types';
import {sleep} from './utils';

export interface RunMeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

export type RunMeasureLifecycle = (cb: () => unknown, handlers?: MeasureLifecycleHandlers, options?: MeasureOptions, durationHistogram?: Histogram, memoryHistogram?: Histogram) => Promise<RunMeasureResult>;

export interface MeasureLifecycleHandlers {

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
   * @param histogram Tested callback performance statistics.
   */
  onMeasureEnd?(histogram: Histogram): void;

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
 * @param durationHistogram The histogram to store performance measurements.
 * @param memoryHistogram
 * @returns The promise that is resolved with the results' histogram when measurements are completed.
 */
export const runMeasureLifecycle: RunMeasureLifecycle = (cb, handlers = {}, options = {}, durationHistogram = new Histogram(), memoryHistogram = new Histogram()) => {

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
    targetRme = 0.01,
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

  let {syncIterationCount = 0} = options;

  let lifecyclePromise = Promise.resolve();

  syncIterationCount = Math.max(syncIterationCount | 0, 0);

  // Warmup phase
  if (warmupIterationCount > 0) {
    lifecyclePromise = lifecyclePromise
        .then(() => {
          onMeasureWarmupStart?.();
          return beforeBatch?.();
        })
        .then(() => {
          let iterationDuration = Infinity;

          for (let i = 0; i < warmupIterationCount; ++i) {
            beforeIteration?.();
            const iterationTs = performance.now();
            try {
              cb();
            } catch (error) {
              onMeasureError?.(error);
            }
            iterationDuration = Math.min(iterationDuration, performance.now() - iterationTs);
            afterIteration?.();
          }

          syncIterationCount ||= Math.ceil(batchTimeout / 1000 / iterationDuration);

          return afterBatch?.();
        })
        .then(afterWarmup)
        .then(() => {
          onMeasureWarmupEnd?.();
          return sleep(batchIntermissionTimeout);
        });
  }

  let i = 0; // Total iteration count
  let progress = 0;

  const measureTs = Date.now();

  const nextBatch = (): Promise<void> | void => {
    syncIterationCount ||= 1;

    const batchTs = Date.now();

    let j = 0; // Batch iteration count

    while (true) {
      beforeIteration?.();

      const iterationTs = performance.now();
      const memoryUsed = getMemoryUsed();

      for (let i = 0; i < syncIterationCount; ++i) {
        ++j;
        try {
          cb();
        } catch (error) {
          onMeasureError?.(error);
        }
      }

      durationHistogram.add((performance.now() - iterationTs) / syncIterationCount);

      const memoryUsedDelta = getMemoryUsed() - memoryUsed;
      if (memoryUsedDelta > 0) {
        memoryHistogram.add(memoryUsedDelta / syncIterationCount);
      }

      afterIteration?.();

      ++i;

      const measureDuration = Date.now() - measureTs;
      const rme = durationHistogram.getRme();

      if (measureDuration > measureTimeout || i > 2 && targetRme >= rme) {
        onMeasureProgress?.(1);

        // Measurements completed
        return Promise.resolve(afterBatch?.());
      }

      onMeasureProgress?.(progress = Math.max(progress, measureDuration / measureTimeout || 0, i > 2 ? targetRme / rme || 0 : 0));

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
        onMeasureEnd?.(durationHistogram);
        return {durationHistogram, memoryHistogram};
      });
};

function getMemoryUsed(): number {
  return typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;
}
