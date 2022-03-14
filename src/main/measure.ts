import {MeasureOptions} from './test-types';
import {Histogram} from './Histogram';

export interface MeasureHandlers {

  /**
   * Triggered when an error occurred during the measured callback invokation.
   *
   * @param error The error that was thrown.
   */
  onError(error: any): void;

  /**
   * Triggered after each iteration with the elapsed percentage of the measurement duration.
   *
   * @param prc The elapsed percentage of the measurement duration.
   */
  onProgress(prc: number): void;
}

/**
 * Measures callback performance and stores measurements in a histogram.
 *
 * @param cb The measured callback.
 * @param histogram The histogram to store performance measurements.
 * @param handlers Callbacks that are invoked at different measurement stages.
 * @param options Other measurement options.
 * @returns The promise that is resolved when measurements are completed.
 */
export function measure(cb: () => unknown, histogram: Histogram, handlers: MeasureHandlers, options: MeasureOptions): Promise<void> {
  const {
    onError,
    onProgress,
  } = handlers;

  const {
    measureTimeout = 5_000,
    targetRme = 0.002,
    warmupIterationCount = 1,
    batchIterationCount = Infinity,
    batchTimeout = 1_000,
    afterWarmup,
    beforeBatch,
    afterBatch,
    beforeIteration,
    afterIteration,
  } = options;

  let i = 0;

  if (warmupIterationCount > 0) {
    while (i < warmupIterationCount) {
      beforeIteration?.();
      try {
        cb();
      } catch (error) {
        onError(error);
      }
      afterIteration?.();
      ++i;
    }
    afterWarmup?.();
  }

  i = 0;

  onProgress(0);

  const measureTs = Date.now();

  const runBatch = (): Promise<void> | void => {
    const batchTs = Date.now();

    let j = 0;

    while (true) {
      beforeIteration?.();

      const iterationTs = performance.now();
      try {
        cb();
      } catch (error) {
        onError(error);
      }
      histogram.add(performance.now() - iterationTs);

      afterIteration?.();

      const measureDuration = Date.now() - measureTs;

      if (measureDuration > measureTimeout || i > 2 && histogram.getRme() <= targetRme) {
        onProgress(1);
        return Promise.resolve().then(afterBatch);
      }

      if (Date.now() - batchTs > batchTimeout || j >= batchIterationCount) {
        return Promise.resolve().then(afterBatch).then(beforeBatch).then(runBatch);
      }

      onProgress(measureDuration / measureTimeout);

      ++i;
      ++j;
    }
  };

  return Promise.resolve(beforeBatch).then(runBatch);
}
