import {MeasureOptions} from './test-types';
import {Histogram} from './Histogram';

export function measure(cb: () => unknown, histogram: Histogram, options: MeasureOptions): Promise<void> {
  const {
    testTimeout = 5_000,
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
    beforeBatch?.();
    while (i < warmupIterationCount) {
      beforeIteration?.();
      cb();
      afterIteration?.();
      ++i;
    }
    afterBatch?.();
  }

  afterWarmup?.();

  i = 0;

  const measureTs = Date.now();

  const nextBatch = (): Promise<void> | void => {
    const batchTs = Date.now();

    let j = 0;

    while (true) {
      beforeIteration?.();

      const iterationTs = performance.now();
      cb();
      histogram.add(performance.now() - iterationTs);

      afterIteration?.();

      if (Date.now() - measureTs > testTimeout || i > 2 && histogram.getRme() <= targetRme) {
        return Promise.resolve().then(afterBatch);
      }

      if (Date.now() - batchTs > batchTimeout || j >= batchIterationCount) {
        return Promise.resolve().then(afterBatch).then(beforeBatch).then(nextBatch);
      }

      ++i;
      ++j;
    }
  };

  return Promise.resolve(beforeBatch).then(nextBatch);
}
