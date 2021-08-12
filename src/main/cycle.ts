import {performance} from 'perf_hooks';
import {IHistogram} from './createHistogram';

/**
 * The mode of duration calculation.
 */
export const enum DurationMode {

  /**
   * Measure cycle duration as time spent on callback invocation, {@link ICycleOptions.beforeIteration} and
   * {@link ICycleOptions.afterIteration}.
   */
  ABSOLUTE = 0,

  /**
   * Measure cycle duration as time spent on callback invocation exclusively.
   */
  EFFECTIVE = 1,
}

export interface ICycleOptions {

  /**
   * The number of iterations before results are collected.
   *
   * @default 0
   */
  warmupIterationCount?: number;

  /**
   * The timeout in milliseconds.
   *
   * @default 3000
   */
  timeout?: number;

  /**
   * The mode of cycle duration calculation.
   *
   * @default `DurationMode.EFFECTIVE`
   */
  durationMode?: DurationMode;

  /**
   * The required margin of error to abort the cycle.
   *
   * @default 0.005
   */
  targetRme?: number;

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
 * @param callback The callback to execute.
 * @param histogram The histogram to populate.
 * @param options The cycle options.
 */
export function cycle(callback: () => void, histogram: IHistogram, options: ICycleOptions = {}): void {
  const {
    warmupIterationCount = 1,
    timeout = 3000,
    durationMode = DurationMode.EFFECTIVE,
    targetRme = 0.005,
    beforeIteration,
    afterIteration,
  } = options;

  let i = 0;

  while (i < warmupIterationCount) {
    beforeIteration?.(i, histogram);
    callback();
    afterIteration?.(i, histogram);
    ++i;
  }

  const cycleTimestamp = performance.now();

  while (true) {
    beforeIteration?.(i, histogram);

    const iterationTimestamp = performance.now();
    callback();
    histogram.add(performance.now() - iterationTimestamp);

    const aborted = afterIteration?.(i, histogram) === false;
    const duration = durationMode === DurationMode.EFFECTIVE ? histogram.getSum() : performance.now() - cycleTimestamp;

    if (aborted || duration > timeout || i > 2 && histogram.getRme() <= targetRme) {
      break;
    }
    ++i;
  }
}
