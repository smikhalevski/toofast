import { Histogram } from './Histogram.js';
import { MeasureOptions } from './types.js';
import { sleep } from './utils.js';

const MEASURE_TIMEOUT = 10_000;
const TARGET_RME = 0.01;
const WARMUP_ITERATION_COUNT = 1;
const BATCH_ITERATION_COUNT = Infinity;
const BATCH_TIMEOUT = 1_000;
const BATCH_INTERMISSION_TIMEOUT = 200;

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

export interface MeasureLifecycleOptions {
  /**
   * The callback to measure performance of.
   */
  callback: () => unknown;

  /**
   * Callbacks that are invoked at different lifecycle phases.
   */
  handlers?: MeasureLifecycleHandlers;

  /**
   * Measurement options.
   */
  measureOptions?: MeasureOptions;

  /**
   * The histogram to store performance measurements.
   */
  durationHistogram?: Histogram;

  /**
   * The histogram to store memory usage measurements.
   */
  memoryHistogram?: Histogram;
}

/**
 * Measurement results.
 */
export interface MeasureResult {
  durationHistogram: Histogram;
  memoryHistogram: Histogram;
}

/**
 * Measures callback performance and stores measurements in a histogram.
 */
export async function runMeasureLifecycle(options: MeasureLifecycleOptions): Promise<MeasureResult> {
  const {
    callback,
    handlers = {},
    measureOptions = {},
    durationHistogram = new Histogram(),
    memoryHistogram = new Histogram(),
  } = options;

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
  } = measureOptions;

  // Warmup phase
  if (warmupIterationCount > 0) {
    onMeasureWarmupStart?.();

    await beforeBatch?.();

    for (let i = 0; i < warmupIterationCount; ++i) {
      await beforeIteration?.();

      try {
        callback();
      } catch (error) {
        onMeasureError?.(error);
      }

      await afterIteration?.();
    }

    await afterBatch?.();

    await afterWarmup?.();

    onMeasureWarmupEnd?.();

    await sleep(batchIntermissionTimeout);
  }

  let totalIterationCount = 0;
  let progress = 0;

  const measureTimestamp = Date.now();

  const nextBatch = async (): Promise<void> => {
    const batchTimestamp = Date.now();

    let iterationCount = 0;

    while (true) {
      ++iterationCount;
      ++totalIterationCount;

      await beforeIteration?.();

      const memoryUsed = getMemoryUsed();
      const iterationTimestamp = performance.now();

      try {
        callback();
      } catch (error) {
        onMeasureError?.(error);
      }

      durationHistogram.add(performance.now() - iterationTimestamp);

      const memoryUsedDelta = getMemoryUsed() - memoryUsed;
      if (memoryUsedDelta > 0) {
        memoryHistogram.add(memoryUsedDelta);
      }

      await afterIteration?.();

      const measureDuration = Date.now() - measureTimestamp;
      const { rme } = durationHistogram;

      if (measureDuration > measureTimeout || (totalIterationCount > 2 && targetRme >= rme)) {
        onMeasureProgress?.(1);

        // Measurements completed
        await afterBatch?.();
        return;
      }

      progress = Math.max(
        progress,
        measureDuration / measureTimeout || 0,
        totalIterationCount > 2 ? targetRme / rme || 0 : 0
      );

      onMeasureProgress?.(progress);

      if (Date.now() - batchTimestamp > batchTimeout || iterationCount >= batchIterationCount) {
        // Schedule the next measurement batch
        await afterBatch?.();

        // The pause between batches is required for garbage collection
        await sleep(batchIntermissionTimeout);

        await beforeBatch?.();

        return nextBatch();
      }
    }
  };

  onMeasureStart?.();

  await beforeBatch?.();

  onMeasureProgress?.(0);

  await nextBatch();

  onMeasureEnd?.(durationHistogram);

  return { durationHistogram, memoryHistogram };
}

function getMemoryUsed(): number {
  return typeof process !== 'undefined' ? process.memoryUsage().heapUsed : 0;
}
