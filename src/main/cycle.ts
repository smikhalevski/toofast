import {performance} from 'perf_hooks';
import {IHistogram} from './createHistogram';

export interface ICycleOptions {

  /**
   * The number of execution before results are collected.
   *
   * @default 1
   */
  warmupCycleCount?: number;

  /**
   * The timeout of the cycle.
   *
   * @default 3000
   */
  timeout?: number;

  /**
   * The required margin of error to abort the cycle.
   *
   * @default 0.005
   */
  marginOfError?: number;

  /**
   * The callback executed before each callback invocation.
   *
   * @param histogram The histogram that describes the current results.
   */
  beforeCycle?: (histogram: IHistogram) => void;

  /**
   * The callback executed after each callback invocation.
   *
   * @param histogram The histogram that describes the current results.
   */
  afterCycle?: (histogram: IHistogram) => boolean | void;
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
    warmupCycleCount = 1,
    timeout = 3000,
    marginOfError = 0.005,
    beforeCycle,
    afterCycle,
  } = options;

  for (let i = 0; i < warmupCycleCount; ++i) {
    beforeCycle?.(histogram);
    callback();
    afterCycle?.(histogram);
  }

  const startTimestamp = performance.now();

  let endTimestamp = startTimestamp;

  do {
    beforeCycle?.(histogram);

    const runTimestamp = performance.now();
    callback();
    endTimestamp = performance.now();

    histogram.add(endTimestamp - runTimestamp);

    if (afterCycle?.(histogram) === false || histogram.getRme() <= marginOfError) {
      break;
    }
  } while (endTimestamp - startTimestamp < timeout);
}
