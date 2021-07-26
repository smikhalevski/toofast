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
  targetRme?: number;

  /**
   * The callback executed before each callback invocation.
   *
   * @param histogram The histogram that describes the current results.
   */
  beforeCycle?: (cycleCount: number, histogram: IHistogram) => void;

  /**
   * The callback executed after each callback invocation.
   *
   * @param histogram The histogram that describes the current results.
   */
  afterCycle?: (cycleCount: number, histogram: IHistogram) => boolean | void;
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
    targetRme = 0.005,
    beforeCycle,
    afterCycle,
  } = options;

  for (let i = 0; i < warmupCycleCount; ++i) {
    beforeCycle?.(i, histogram);
    callback();
    afterCycle?.(i, histogram);
  }

  const startTimestamp = performance.now();

  let endTimestamp = startTimestamp;

  for (let i = 0; endTimestamp - startTimestamp < timeout; ++i) {
    beforeCycle?.(i, histogram);

    const runTimestamp = performance.now();
    callback();
    endTimestamp = performance.now();

    histogram.add(endTimestamp - runTimestamp);

    if (afterCycle?.(i, histogram) === false || i > 2 && histogram.getRme() <= targetRme) {
      break;
    }
  }
}
