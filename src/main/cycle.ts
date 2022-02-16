import {performance} from 'perf_hooks';
import {IHistogram} from './createHistogram';
import {sleep} from 'parallel-universe';

/**
 * The mode of duration calculation.
 */
export const enum DurationMode {

  /**
   * Measure cycle duration as time spent on callback invocation, {@link ICycleOptions.beforeIteration} and
   * {@link ICycleOptions.afterIteration}.
   */
  TOTAL = 0,

  /**
   * Measure cycle duration as time spent on callback invocation exclusively.
   */
  EXCLUSIVE = 1,
}

export interface ICycleOptions {

  /**
   * The number of iterations before results are collected.
   *
   * @default 1
   */
  warmupIterationCount?: number;

  batchTimeout?: number;

  /**
   * The cycle timeout in milliseconds.
   *
   * @default 5000
   */
  cycleTimeout?: number;

  /**
   * The mode of cycle duration calculation.
   *
   * @default `DurationMode.EXCLUSIVE`
   */
  durationMode?: DurationMode;

  /**
   * The required margin of error [0, 1] to abort the cycle.
   *
   * @default 0.002
   */
  targetRme?: number;

  afterWarmup?(): void;

  /**
   * The callback executed before each iteration.
   *
   * @param iterationIndex The number of the current iteration.
   * @param histogram The histogram that describes the current results.
   */
  beforeIteration?(iterationIndex: number, histogram: IHistogram): void;

  /**
   * The callback executed after each iteration.
   *
   * @param iterationIndex The number of the current iteration.
   * @param histogram The histogram that describes the current results.
   * @returns If `false` is returned then cycle is aborted.
   */
  afterIteration?(iterationIndex: number, histogram: IHistogram): boolean | void;
}

/**
 * Executes a callback and adds results to the histogram.
 *
 * @param cb The callback to execute.
 * @param histogram The histogram to populate.
 * @param options The cycle options.
 */
export function cycle(cb: () => void, histogram: IHistogram, options: ICycleOptions = {}): Promise<void> {
  const {
    warmupIterationCount = 1,
    batchTimeout = 1000,
    cycleTimeout = 5000,
    durationMode = DurationMode.EXCLUSIVE,
    targetRme = 0.002,
    afterWarmup,
    beforeIteration,
    afterIteration,
  } = options;

  let i = 0;

  while (i < warmupIterationCount) {
    beforeIteration?.(i, histogram);
    cb();
    afterIteration?.(i, histogram);
    ++i;
  }

  afterWarmup?.();

  i = 0;

  const cycleTs = Date.now();

  const nextBatch = (resolve: () => void) => {
    const batchTs = Date.now();
    while (true) {
      beforeIteration?.(i, histogram);

      const iterationTs = performance.now();
      cb();
      histogram.add(performance.now() - iterationTs);

      const aborted = afterIteration?.(i, histogram) === false;
      const cycleDuration = durationMode === DurationMode.EXCLUSIVE ? histogram.getSum() : Date.now() - cycleTs;

      if (aborted || cycleDuration > cycleTimeout || i > 2 && histogram.getRme() <= targetRme) {
        resolve();
        break;
      }
      const batchDuration = Date.now() - batchTs;
      if (batchDuration > batchTimeout) {
        sleep(1000).then(() => nextBatch(resolve));
        return;
      }
      ++i;
    }
  };

  return new Promise(nextBatch);
}
