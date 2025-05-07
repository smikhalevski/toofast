import { Histogram } from './Histogram.js';
import { MeasureOptions } from './types.js';
import { sleep } from './utils.js';

// Defaults
const MEASURE_TIMEOUT = 10_000;
const TARGET_RME = 0.01;
const WARMUP_ITERATION_COUNT = 1;
const BATCH_ITERATION_COUNT = Infinity;
const BATCH_TIMEOUT = 1_000;
const BATCH_INTERMISSION_TIMEOUT = 200;

export interface RunMeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

export type RunMeasureLifecycle = (
  cb: () => unknown,
  handlers?: MeasureLifecycleHandlers,
  options?: MeasureOptions,
  durationHistogram?: Histogram,
  memoryHistogram?: Histogram
) => Promise<RunMeasureResult>;

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
export const runMeasureLifecycle: RunMeasureLifecycle = (
  cb,
  handlers = {},
  options = {},
  durationHistogram = new Histogram(),
  memoryHistogram = new Histogram()
) => {
  const { onMeasureStart, onMeasureEnd, onMeasureWarmupStart, onMeasureWarmupEnd, onMeasureError, onMeasureProgress } =
    handlers;

  const {
    measureTimeout = MEASURE_TIMEOUT,
    targetRme = TARGET_RME,
    warmupIterationCount = WARMUP_ITERATION_COUNT,
    batchIterationCount = BATCH_ITERATION_COUNT,
    batchTimeout = BATCH_TIMEOUT,
    batchIntermissionTimeout = BATCH_INTERMISSION_TIMEOUT,
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
      .then(() => {
        onMeasureWarmupStart?.();
        return beforeBatch?.();
      })
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

        return afterBatch?.();
      })
      .then(afterWarmup)
      .then(() => {
        onMeasureWarmupEnd?.();
        return sleep(batchIntermissionTimeout);
      });
  }

  let totalIterationCount = 0;
  let progress = 0;

  const measureTimestamp = Date.now();

  const nextBatch = (): Promise<void> | void => {
    const batchTimestamp = Date.now();

    let iterationCount = 0;

    while (true) {
      ++iterationCount;
      ++totalIterationCount;

      beforeIteration?.();

      const memoryUsed = getMemoryUsed();
      const iterationTimestamp = performance.now();

      try {
        cb();
      } catch (error) {
        onMeasureError?.(error);
      }

      durationHistogram.add(performance.now() - iterationTimestamp);

      const memoryUsedDelta = getMemoryUsed() - memoryUsed;
      if (memoryUsedDelta > 0) {
        memoryHistogram.add(memoryUsedDelta);
      }

      afterIteration?.();

      const measureDuration = Date.now() - measureTimestamp;
      const rme = durationHistogram.rme;

      if (measureDuration > measureTimeout || (totalIterationCount > 2 && targetRme >= rme)) {
        onMeasureProgress?.(1);

        // Measurements completed
        return Promise.resolve(afterBatch?.());
      }

      progress = Math.max(
        progress,
        measureDuration / measureTimeout || 0,
        totalIterationCount > 2 ? targetRme / rme || 0 : 0
      );

      onMeasureProgress?.(progress);

      if (Date.now() - batchTimestamp > batchTimeout || iterationCount >= batchIterationCount) {
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
      return { durationHistogram, memoryHistogram };
    });
};

function getMemoryUsed(): number {
  return typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;
}
